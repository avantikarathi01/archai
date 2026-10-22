/**
 * Procedural Floor-Plan Layout Generation Engine
 * 
 * Generates deterministic 2D room layouts respecting plot boundaries,
 * correct floor-level assignments, natural room proportions (no elongated tubes),
 * and vertical staircase access.
 */

import { STANDARD_ROOM_SPECS, ROOM_ZONES } from '../schemas/layoutSchema.js';
import { validateLayout, generateRecommendations, COMPLIANCE_DISCLAIMER } from './architecturalRules.js';

/**
 * Checks minimum buildable area requirement per floor
 */
function checkLayoutFeasibility(requirements, plotWidth, plotLength) {
  const plotArea = plotWidth * plotLength;
  const floorsCount = Math.max(1, requirements.floors || 1);
  const floorMap = requirements.floorRequirements || {};

  for (let lvl = 0; lvl < floorsCount; lvl++) {
    const f = floorMap[lvl];
    if (!f) continue;

    let floorMinArea = 0;
    if (f.parking) floorMinArea += STANDARD_ROOM_SPECS.parking.minArea;
    if (f.livingRoom) floorMinArea += STANDARD_ROOM_SPECS.living_room.minArea;
    if (f.kitchen) floorMinArea += STANDARD_ROOM_SPECS.kitchen.minArea;
    if (f.bedrooms > 0) {
      floorMinArea += STANDARD_ROOM_SPECS.master_bedroom.minArea;
      floorMinArea += Math.max(0, f.bedrooms - 1) * STANDARD_ROOM_SPECS.bedroom.minArea;
    }
    if (f.bathrooms > 0) floorMinArea += f.bathrooms * STANDARD_ROOM_SPECS.bathroom.minArea;
    if (f.poojaRoom) floorMinArea += STANDARD_ROOM_SPECS.pooja_room.minArea;
    if (f.staircase) floorMinArea += 50;

    const floorTotalNeeded = Math.round(floorMinArea * 1.15);

    if (floorTotalNeeded > plotArea) {
      throw new Error(
        `Impossible Layout: Level ${lvl} (${f.name}) requires at least ${floorTotalNeeded} sq ft ` +
        `for requested rooms (${f.bedrooms} bedrooms, ${f.livingRoom ? 'living, ' : ''}${f.kitchen ? 'kitchen, ' : ''}` +
        `${f.parking ? 'parking, ' : ''}etc.), but plot area is only ${plotArea} sq ft (${plotWidth}x${plotLength} ft). ` +
        `Please increase plot size or adjust room requirements.`
      );
    }
  }
}

/**
 * Generates layout tailored to floor-specific room requirements
 */
export function generateProceduralLayout(requirements) {
  let plotWidth = Number(requirements?.plot?.width);
  let plotLength = Number(requirements?.plot?.length);
  const totalAreaSqFt = Number(requirements?.plot?.totalAreaSqFt);
  const isDimensionsExplicit = Boolean(requirements?.plot?.isDimensionsExplicit);
  const warnings = [...(requirements?.warnings || [])];
  const clarifications = [...(requirements?.clarifications || [])];

  // Resolve dimensions if width and length were not explicitly supplied
  if (!plotWidth || !plotLength || isNaN(plotWidth) || isNaN(plotLength)) {
    if (totalAreaSqFt && totalAreaSqFt > 0) {
      // Standard urban ratio 1:1.33
      plotWidth = Math.round(Math.sqrt(totalAreaSqFt / 1.33));
      plotLength = Math.round(totalAreaSqFt / plotWidth);
      warnings.push(
        `PROVISIONAL PREVIEW: Plot width and length were not explicitly provided. Assumed standard ${plotWidth}x${plotLength} ft ` +
        `(${totalAreaSqFt} sq ft) for conceptual preview only. Confirm exact width and length for final layout validation.`
      );
    } else {
      plotWidth = 30;
      plotLength = 40;
      warnings.push(
        `PROVISIONAL PREVIEW: Plot dimensions were not specified. Assumed 30x40 ft (1200 sq ft) for conceptual preview only.`
      );
    }
  }

  const plotArea = plotWidth * plotLength;
  const floorsCount = Math.max(1, parseInt(requirements?.floors, 10) || 1);
  const facing = requirements?.facing && requirements.facing !== 'unspecified' ? requirements.facing : 'east';
  const kitchenType = requirements?.kitchen?.type || 'unspecified';

  // Build or retrieve floorRequirements map
  let floorMap = requirements?.floorRequirements;
  if (!floorMap) {
    floorMap = {};
    for (let i = 0; i < floorsCount; i++) {
      floorMap[i] = {
        level: i,
        name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
        bedrooms: 0,
        bathrooms: 0,
        livingRoom: false,
        kitchen: false,
        parking: false,
        poojaRoom: false,
        balcony: false,
        staircase: floorsCount > 1,
      };
    }

    const totalBeds = parseInt(requirements?.bedrooms, 10) || 2;
    const totalBaths = parseInt(requirements?.bathrooms, 10) || 2;

    if (floorsCount === 1) {
      floorMap[0].bedrooms = totalBeds;
      floorMap[0].bathrooms = totalBaths;
      floorMap[0].livingRoom = true;
      floorMap[0].kitchen = true;
      floorMap[0].parking = Boolean(requirements?.parking?.required);
      floorMap[0].poojaRoom = Boolean(requirements?.poojaRoom?.required);
      floorMap[0].balcony = Boolean(requirements?.balcony?.required);
    } else {
      const gfBeds = Math.min(1, Math.max(0, totalBeds - 2));
      floorMap[0].bedrooms = gfBeds;
      floorMap[0].bathrooms = 1;
      floorMap[0].livingRoom = true;
      floorMap[0].kitchen = true;
      floorMap[0].parking = Boolean(requirements?.parking?.required);
      floorMap[0].poojaRoom = Boolean(requirements?.poojaRoom?.required);

      floorMap[1].bedrooms = totalBeds - gfBeds;
      floorMap[1].bathrooms = Math.max(1, totalBaths - 1);
      floorMap[1].livingRoom = true;
      floorMap[1].kitchen = false;
      floorMap[1].balcony = Boolean(requirements?.balcony?.required);
    }
  }

  // 1. Feasibility & Impossible Layout Check
  checkLayoutFeasibility({ ...requirements, floorRequirements: floorMap, floors: floorsCount }, plotWidth, plotLength);

  // Setbacks for ventilation and daylight
  const frontSetback = plotArea > 1000 ? 3 : (plotArea > 600 ? 2 : 1);
  const rearSetback = plotArea > 1000 ? 2 : 1;
  const sideSetback = plotWidth >= 38 ? 2 : 0;

  const buildableWidth = plotWidth - (sideSetback * 2);
  const buildableLength = plotLength - (frontSetback + rearSetback);
  const startX = sideSetback;
  const startY = frontSetback;

  const rooms = [];
  let roomIdCounter = 1;

  const getKitchenName = () => {
    if (kitchenType === 'open') return 'Open Kitchen';
    if (kitchenType === 'closed') return 'Closed Kitchen';
    if (kitchenType === 'modular') return 'Modular Kitchen';
    return 'Kitchen';
  };

  // ==============================================================
  // Generate each floor level independently according to floorMap
  // ==============================================================
  for (let lvl = 0; lvl < floorsCount; lvl++) {
    const fReq = floorMap[lvl];
    if (!fReq) continue;

    // CASE A: Ground Floor with Parking and NO bedrooms (e.g. user test case)
    if (lvl === 0 && fReq.parking && fReq.bedrooms === 0) {
      const parkingDepth = Math.round(buildableLength * 0.46);
      const remainingDepth = buildableLength - parkingDepth;
      const parkingWidth = Math.round(buildableWidth * 0.52);
      const foyerWidth = buildableWidth - parkingWidth;

      // Car Parking
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'parking',
        name: 'Car Porch / Parking',
        level: 0,
        x: startX,
        y: startY,
        width: parkingWidth,
        length: parkingDepth,
        area: parkingWidth * parkingDepth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.parking.color,
        doors: [{ wall: 'north', offset: parkingWidth / 2, width: 8 }],
        windows: [],
      });

      // Entrance Foyer & Staircase Bay (width >= 10 ft, aligned vertically with 1st floor landing)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'corridor',
        name: 'Entrance Foyer & Staircase to 1st Floor',
        level: 0,
        x: startX + parkingWidth,
        y: startY,
        width: foyerWidth,
        length: parkingDepth,
        area: foyerWidth * parkingDepth,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.corridor.color,
        doors: [
          { wall: 'north', offset: 2, width: 3.5 },
          { wall: 'west', offset: 2, width: 3 },
        ],
        windows: [{ wall: 'east', offset: foyerWidth / 2, width: 3 }],
      });

      // Rear: If living and/or kitchen requested on Ground Floor, allocate them; otherwise utility + verandah
      if (fReq.livingRoom || fReq.kitchen) {
        if (fReq.livingRoom && fReq.kitchen) {
          const livingWidth = Math.round(buildableWidth * 0.6);
          const kitchenWidth = buildableWidth - livingWidth;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'living_room',
            name: 'Living Room / Drawing Lounge',
            level: 0,
            x: startX,
            y: startY + parkingDepth,
            width: livingWidth,
            length: remainingDepth,
            area: livingWidth * remainingDepth,
            zone: ROOM_ZONES.PUBLIC,
            color: STANDARD_ROOM_SPECS.living_room.color,
            doors: [{ wall: 'north', offset: 2, width: 3.5 }],
            windows: [{ wall: 'south', offset: livingWidth / 2, width: 4 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'kitchen',
            name: 'Ground Floor Kitchen',
            level: 0,
            x: startX + livingWidth,
            y: startY + parkingDepth,
            width: kitchenWidth,
            length: remainingDepth,
            area: kitchenWidth * remainingDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.kitchen.color,
            doors: [{ wall: 'west', offset: 2, width: 3 }],
            windows: [{ wall: 'south', offset: kitchenWidth / 2, width: 3.5 }],
          });
        } else if (fReq.livingRoom) {
          const livingWidth = Math.round(buildableWidth * 0.65);
          const gardenWidth = buildableWidth - livingWidth;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'living_room',
            name: 'Living Room / Drawing Lounge',
            level: 0,
            x: startX,
            y: startY + parkingDepth,
            width: livingWidth,
            length: remainingDepth,
            area: livingWidth * remainingDepth,
            zone: ROOM_ZONES.PUBLIC,
            color: STANDARD_ROOM_SPECS.living_room.color,
            doors: [{ wall: 'north', offset: 2, width: 3.5 }],
            windows: [{ wall: 'south', offset: livingWidth / 2, width: 4 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'balcony',
            name: 'Ground Verandah / Garden Space',
            level: 0,
            x: startX + livingWidth,
            y: startY + parkingDepth,
            width: gardenWidth,
            length: remainingDepth,
            area: gardenWidth * remainingDepth,
            zone: ROOM_ZONES.OUTDOOR,
            color: STANDARD_ROOM_SPECS.balcony.color,
            doors: [{ wall: 'north', offset: 2, width: 3 }],
            windows: [],
          });
        } else {
          const kitchenWidth = Math.round(buildableWidth * 0.5);
          const storeWidth = buildableWidth - kitchenWidth;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'kitchen',
            name: 'Ground Floor Kitchen',
            level: 0,
            x: startX,
            y: startY + parkingDepth,
            width: kitchenWidth,
            length: remainingDepth,
            area: kitchenWidth * remainingDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.kitchen.color,
            doors: [{ wall: 'east', offset: 2, width: 3 }],
            windows: [{ wall: 'south', offset: kitchenWidth / 2, width: 3.5 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'utility',
            name: 'Ground Utility / Store Room',
            level: 0,
            x: startX + kitchenWidth,
            y: startY + parkingDepth,
            width: storeWidth,
            length: remainingDepth,
            area: storeWidth * remainingDepth,
            zone: ROOM_ZONES.SERVICE,
            color: '#f97316',
            doors: [{ wall: 'west', offset: 2, width: 2.5 }],
            windows: [{ wall: 'south', offset: storeWidth / 2, width: 3 }],
          });
        }
      } else {
        const storeWidth = Math.round(buildableWidth * 0.4);
        const openAreaWidth = buildableWidth - storeWidth;

        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'utility',
          name: 'Ground Utility / Store Room',
          level: 0,
          x: startX,
          y: startY + parkingDepth,
          width: storeWidth,
          length: remainingDepth,
          area: storeWidth * remainingDepth,
          zone: ROOM_ZONES.SERVICE,
          color: '#f97316',
          doors: [{ wall: 'east', offset: 2, width: 2.5 }],
          windows: [{ wall: 'south', offset: storeWidth / 2, width: 3 }],
        });

        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'balcony',
          name: 'Ground Verandah / Garden Space',
          level: 0,
          x: startX + storeWidth,
          y: startY + parkingDepth,
          width: openAreaWidth,
          length: remainingDepth,
          area: openAreaWidth * remainingDepth,
          zone: ROOM_ZONES.OUTDOOR,
          color: STANDARD_ROOM_SPECS.balcony.color,
          doors: [{ wall: 'north', offset: openAreaWidth / 2, width: 4 }],
          windows: [],
        });
      }

      continue;
    }

    // CASE A.2: Ground Floor Comprehensive Indian Contemporary Residence (G+1)
    // (Parking + Staircase + Living + Dining + Open Kitchen + Master Bed with Attached Bath + Common Washroom)
    const isComprehensiveMultiFloorGround = floorsCount > 1 && (
      fReq.poolRoom ||
      fReq.entertainmentRoom ||
      requirements?.entertainmentRoom ||
      requirements?.poolRoom ||
      fReq.commonWashroom ||
      requirements?.commonWashroom ||
      (fReq.masterBedroom && fReq.parking && (fReq.dining || requirements?.dining))
    );

    if (lvl === 0 && fReq.parking && isComprehensiveMultiFloorGround) {
      const row1Depth = 14;
      const row2Depth = 9;
      const row3Depth = buildableLength - row1Depth - row2Depth;

      const parkW = 12;
      const stairW = 6;
      const livingW = buildableWidth - parkW - stairW;

      // 1. Car Parking (North entry approach)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'parking',
        name: 'Car Porch / Parking',
        level: 0,
        x: startX,
        y: startY,
        width: parkW,
        length: row1Depth,
        area: parkW * row1Depth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.parking.color,
        doors: [{ wall: 'north', offset: parkW / 2, width: 8 }],
        windows: [],
      });

      // 2. Entrance Foyer & Staircase Bay (Dog-leg staircase to 1st floor)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'staircase',
        name: 'Entrance Foyer & Staircase to 1st Floor',
        level: 0,
        x: startX + parkW,
        y: startY,
        width: stairW,
        length: row1Depth,
        area: stairW * row1Depth,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.staircase ? STANDARD_ROOM_SPECS.staircase.color : STANDARD_ROOM_SPECS.corridor.color,
        doors: [
          { wall: 'north', offset: 1.5, width: 3.5 },
          { wall: 'east', offset: 2, width: 3 },
        ],
        windows: [{ wall: 'north', offset: 4.5, width: 2 }],
      });

      // 3. Formal Living Room / Drawing Lounge
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'living_room',
        name: 'Living Room / Drawing Lounge',
        level: 0,
        x: startX + parkW + stairW,
        y: startY,
        width: livingW,
        length: row1Depth,
        area: livingW * row1Depth,
        zone: ROOM_ZONES.PUBLIC,
        color: STANDARD_ROOM_SPECS.living_room.color,
        doors: [
          { wall: 'west', offset: 2, width: 3 },
          { wall: 'south', offset: livingW / 2, width: 4 },
        ],
        windows: [
          { wall: 'north', offset: livingW / 2, width: 4.5 },
          { wall: 'east', offset: row1Depth / 2, width: 4 },
        ],
      });

      // --- ROW 2 (Middle: Dining, Open Kitchen, Common Washroom) ---
      const washW = 5;
      const washL = 6;
      const diningW = 14;
      const kitchenW = buildableWidth - washW - diningW;

      // 4. Small Common Washroom / Powder Room (Near living/foyer circulation)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'bathroom',
        name: 'Common Washroom / Powder Room',
        level: 0,
        x: startX,
        y: startY + row1Depth,
        width: washW,
        length: washL,
        area: washW * washL,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.bathroom.color,
        doors: [{ wall: 'east', offset: 1.5, width: 2.5 }],
        windows: [{ wall: 'west', offset: 1.5, width: 2 }],
      });

      // Circulation lobby connecting foyer to rear master suite
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'corridor',
        name: 'Ground Floor Circulation Lobby',
        level: 0,
        x: startX,
        y: startY + row1Depth + washL,
        width: washW,
        length: row2Depth - washL,
        area: washW * (row2Depth - washL),
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.corridor.color,
        doors: [{ wall: 'south', offset: 1.5, width: 2.5 }],
        windows: [],
      });

      // 5. Dining Area (Directly connected to living area and open kitchen)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'dining',
        name: 'Dining & Family Circulation',
        level: 0,
        x: startX + washW,
        y: startY + row1Depth,
        width: diningW,
        length: row2Depth,
        area: diningW * row2Depth,
        zone: ROOM_ZONES.PUBLIC,
        color: STANDARD_ROOM_SPECS.dining.color,
        doors: [
          { wall: 'north', offset: diningW / 2, width: 4 },
          { wall: 'east', offset: row2Depth / 2, width: 4 },
        ],
        windows: [],
      });

      // 6. Open Kitchen (Facing Dining with breakfast bar)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'kitchen',
        name: getKitchenName(),
        level: 0,
        x: startX + washW + diningW,
        y: startY + row1Depth,
        width: kitchenW,
        length: row2Depth,
        area: kitchenW * row2Depth,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.kitchen.color,
        doors: [{ wall: 'west', offset: 2, width: 3.5 }],
        windows: [{ wall: 'east', offset: row2Depth / 2, width: 4 }],
      });

      // --- ROW 3 (Rear: Master Bedroom, Attached Bathroom, Verandah/Garden) ---
      const masterW = 14;
      const bathW = 6;
      const verandahW = buildableWidth - masterW - bathW;

      // 7. Master Bedroom (Quiet rear zone for privacy and south daylight)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'master_bedroom',
        name: 'Master Bedroom',
        level: 0,
        x: startX,
        y: startY + row1Depth + row2Depth,
        width: masterW,
        length: row3Depth,
        area: masterW * row3Depth,
        zone: ROOM_ZONES.PRIVATE,
        color: STANDARD_ROOM_SPECS.master_bedroom.color,
        doors: [
          { wall: 'north', offset: 2, width: 3 },
          { wall: 'east', offset: 2, width: 2.8 },
        ],
        windows: [
          { wall: 'south', offset: masterW / 2, width: 4.5 },
          { wall: 'west', offset: row3Depth / 2, width: 3.5 },
        ],
      });

      // 8. Attached Master Bathroom & Toilet (Directly accessed from inside Master Bedroom)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'bathroom',
        name: 'Master Attached Bathroom & Toilet',
        level: 0,
        x: startX + masterW,
        y: startY + row1Depth + row2Depth,
        width: bathW,
        length: row3Depth,
        area: bathW * row3Depth,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.bathroom.color,
        doors: [{ wall: 'west', offset: 2, width: 2.8 }],
        windows: [{ wall: 'south', offset: bathW / 2, width: 2.5 }],
      });

      // 9. Ground Verandah / Garden Space
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'balcony',
        name: 'Ground Verandah / Garden Patio',
        level: 0,
        x: startX + masterW + bathW,
        y: startY + row1Depth + row2Depth,
        width: verandahW,
        length: row3Depth,
        area: verandahW * row3Depth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.balcony.color,
        doors: [{ wall: 'north', offset: verandahW / 2, width: 3.5 }],
        windows: [],
      });

      continue;
    }

    // CASE A.3: First Floor Comprehensive Suite (Entertainment Room + Billiards/Pool Room / Upper Suite)
    if (lvl === 1 && (isComprehensiveMultiFloorGround || fReq.poolRoom || fReq.entertainmentRoom)) {
      const row1Depth = 14;
      const row2Depth = 12;
      const row3Depth = buildableLength - row1Depth - row2Depth;

      const entertainW = 12;
      const stairW = 6;
      const balconyW = buildableWidth - entertainW - stairW;
      const balconyL = 6;
      const loungeL = row1Depth - balconyL;

      const isEnt = Boolean(fReq.entertainmentRoom);

      // 1. Multipurpose Entertainment Room / Upper Lounge
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: isEnt ? 'entertainment' : 'living_room',
        name: isEnt ? 'Multipurpose Entertainment Room' : 'Upper Lounge & Media Space',
        level: 1,
        x: startX,
        y: startY,
        width: entertainW,
        length: row1Depth,
        area: entertainW * row1Depth,
        zone: ROOM_ZONES.PUBLIC,
        color: isEnt ? '#6366f1' : STANDARD_ROOM_SPECS.living_room.color,
        doors: [{ wall: 'east', offset: 2, width: 3 }],
        windows: [{ wall: 'north', offset: entertainW / 2, width: 4.5 }],
      });

      // 2. Staircase Landing & Upper Foyer (Exact alignment with L0: x: 12, y: 3, w: 6, l: 14!)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'staircase',
        name: 'Staircase Landing & Upper Foyer',
        level: 1,
        x: startX + entertainW,
        y: startY,
        width: stairW,
        length: row1Depth,
        area: stairW * row1Depth,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.staircase ? STANDARD_ROOM_SPECS.staircase.color : STANDARD_ROOM_SPECS.corridor.color,
        doors: [
          { wall: 'west', offset: 2, width: 3 },
          { wall: 'east', offset: 2, width: 3 },
          { wall: 'south', offset: 2, width: 3 },
        ],
        windows: [{ wall: 'north', offset: 2.5, width: 2 }],
      });

      // 3. North-Facing Front Balcony
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'balcony',
        name: 'Front Balcony',
        level: 1,
        x: startX + entertainW + stairW,
        y: startY,
        width: balconyW,
        length: balconyL,
        area: balconyW * balconyL,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.balcony.color,
        doors: [{ wall: 'south', offset: balconyW / 2, width: 3.5 }],
        windows: [],
      });

      // 4. Upper Family Lounge & Lobby
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'living_room',
        name: 'Upper Family Lounge & Lobby',
        level: 1,
        x: startX + entertainW + stairW,
        y: startY + balconyL,
        width: balconyW,
        length: loungeL,
        area: balconyW * loungeL,
        zone: ROOM_ZONES.PUBLIC,
        color: STANDARD_ROOM_SPECS.living_room.color,
        doors: [
          { wall: 'north', offset: balconyW / 2, width: 3.5 },
          { wall: 'west', offset: 2, width: 3 },
          { wall: 'south', offset: balconyW / 2, width: 3.5 },
        ],
        windows: [{ wall: 'east', offset: loungeL / 2, width: 3.5 }],
      });

      // --- ROW 2 & 3: Bedroom 2, Attached Bath, Billiards Pool Room, Upper Deck ---
      const bed2W = 14;
      const poolW = buildableWidth - bed2W;

      // 5. Bedroom 2 (First Floor Bedroom Suite)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'bedroom',
        name: 'Bedroom 2 (Upper Suite)',
        level: 1,
        x: startX,
        y: startY + row1Depth,
        width: bed2W,
        length: row2Depth,
        area: bed2W * row2Depth,
        zone: ROOM_ZONES.PRIVATE,
        color: STANDARD_ROOM_SPECS.bedroom.color,
        doors: [
          { wall: 'north', offset: 2, width: 3 },
          { wall: 'south', offset: 2, width: 2.8 },
        ],
        windows: [{ wall: 'west', offset: row2Depth / 2, width: 4 }],
      });

      // 6. Attached Bathroom & Toilet for Bedroom 2
      const bath2W = 7;
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'bathroom',
        name: 'Bedroom 2 Attached Bathroom',
        level: 1,
        x: startX,
        y: startY + row1Depth + row2Depth,
        width: bath2W,
        length: row3Depth,
        area: bath2W * row3Depth,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.bathroom.color,
        doors: [{ wall: 'north', offset: 2, width: 2.8 }],
        windows: [{ wall: 'south', offset: bath2W / 2, width: 2.5 }],
      });

      // 7. Upper Terrace / Open Sky Deck
      const deckW = bed2W - bath2W;
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'balcony',
        name: 'Upper Sun Deck / Terrace',
        level: 1,
        x: startX + bath2W,
        y: startY + row1Depth + row2Depth,
        width: deckW,
        length: row3Depth,
        area: deckW * row3Depth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.balcony.color,
        doors: [{ wall: 'east', offset: row3Depth / 2, width: 3 }],
        windows: [],
      });

      // 8. Billiards / Pool-Table Room or Upper Family Lounge
      const poolL = row2Depth + row3Depth;
      const isPool = Boolean(fReq.poolRoom);
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: isPool ? 'pool_room' : 'living_room',
        name: isPool ? 'Billiards / Pool-Table Room' : 'Upper Family Lounge / Study',
        level: 1,
        x: startX + bed2W,
        y: startY + row1Depth,
        width: poolW,
        length: poolL,
        area: poolW * poolL,
        zone: ROOM_ZONES.PUBLIC,
        color: isPool ? '#0284c7' : STANDARD_ROOM_SPECS.living_room.color,
        doors: [
          { wall: 'north', offset: 4, width: 3.5 },
          { wall: 'west', offset: 15, width: 3 },
        ],
        windows: [
          { wall: 'east', offset: poolL / 2, width: 5 },
          { wall: 'south', offset: poolW / 2, width: 4.5 },
        ],
      });

      continue;
    }

    // CASE B: Standard Residential Floor
    // Calculate practical row heights: Front (40%), Middle (28%), Rear (32%)
    const frontRowDepth = Math.round(buildableLength * 0.40);
    const middleRowDepth = Math.round(buildableLength * 0.28);
    const rearRowDepth = buildableLength - frontRowDepth - middleRowDepth;

    // --- FRONT ROW (Y: startY) ---
    const row1Y = startY;
    let curX1 = startX;

    const hasFrontParking = lvl === 0 && fReq.parking;
    const hasFrontBalcony = fReq.balcony;

    if (hasFrontParking) {
      const parkW = Math.min(13, Math.round(buildableWidth * 0.38));
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'parking',
        name: 'Car Porch / Parking',
        level: lvl,
        x: curX1,
        y: row1Y,
        width: parkW,
        length: frontRowDepth,
        area: parkW * frontRowDepth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.parking.color,
        doors: [{ wall: 'north', offset: parkW / 2, width: 8 }],
        windows: [],
      });
      curX1 += parkW;
    } else if (hasFrontBalcony) {
      const balconyW = Math.min(12, Math.round(buildableWidth * 0.35));
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'balcony',
        name: 'Front Balcony',
        level: lvl,
        x: curX1,
        y: row1Y,
        width: balconyW,
        length: frontRowDepth,
        area: balconyW * frontRowDepth,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.balcony.color,
        doors: [{ wall: 'east', offset: 2, width: 3 }],
        windows: [],
      });
      curX1 += balconyW;
    }

    // In a multi-storey upper floor, provide staircase landing in front/middle
    if (lvl > 0 && fReq.staircase && !hasFrontBalcony && !hasFrontParking) {
      // Split front row into Living Hall (65% width) and Staircase Landing (35% width)
      // This prevents the living hall from spanning an unnatural 30-40 ft bowling alley!
      const stairW = Math.max(8, Math.round(buildableWidth * 0.32));
      const livingW = buildableWidth - stairW;

      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'living_room',
        name: 'Family Living Hall',
        level: lvl,
        x: curX1,
        y: row1Y,
        width: livingW,
        length: frontRowDepth,
        area: livingW * frontRowDepth,
        zone: ROOM_ZONES.PUBLIC,
        color: STANDARD_ROOM_SPECS.living_room.color,
        doors: [
          { wall: 'north', offset: 3, width: 3.5 },
          { wall: 'east', offset: 2, width: 3 },
        ],
        windows: [{ wall: 'north', offset: livingW / 2, width: 4 }],
      });
      curX1 += livingW;

      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'corridor',
        name: 'Staircase Landing & Upper Foyer',
        level: lvl,
        x: curX1,
        y: row1Y,
        width: stairW,
        length: frontRowDepth,
        area: stairW * frontRowDepth,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.corridor.color,
        doors: [
          { wall: 'west', offset: 2, width: 3 },
          { wall: 'south', offset: 2, width: 3 },
        ],
        windows: [{ wall: 'east', offset: stairW / 2, width: 3 }],
      });
    } else {
      // Standard Living Room spanning remaining front width
      const livingW = buildableWidth - (curX1 - startX);
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'living_room',
        name: lvl === 0 ? 'Living Room / Drawing Hall' : 'Family Living Hall',
        level: lvl,
        x: curX1,
        y: row1Y,
        width: livingW,
        length: frontRowDepth,
        area: livingW * frontRowDepth,
        zone: ROOM_ZONES.PUBLIC,
        color: STANDARD_ROOM_SPECS.living_room.color,
        doors: [
          { wall: 'north', offset: 2, width: 3.5 },
          { wall: 'south', offset: livingW / 2, width: 3 },
        ],
        windows: [{ wall: 'north', offset: livingW - 4, width: 4 }],
      });
    }

    // --- MIDDLE ROW (Y: row2Y) ---
    const row2Y = startY + frontRowDepth;
    let curX2 = startX;

    // Pooja Room (if requested on this floor)
    if (fReq.poojaRoom) {
      const poojaW = Math.min(6, Math.max(4, Math.round(buildableWidth * 0.16)));
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'pooja_room',
        name: 'Pooja Room / Mandir',
        level: lvl,
        x: curX2,
        y: row2Y,
        width: poojaW,
        length: middleRowDepth,
        area: poojaW * middleRowDepth,
        zone: ROOM_ZONES.SACRED,
        color: STANDARD_ROOM_SPECS.pooja_room.color,
        doors: [{ wall: 'east', offset: 1.5, width: 2.5 }],
        windows: [{ wall: 'west', offset: 1.5, width: 2 }],
      });
      curX2 += poojaW;
    }

    const middleRemainingW = buildableWidth - (curX2 - startX);

    // If kitchen belongs on this floor:
    if (fReq.kitchen) {
      if (fReq.bedrooms >= 3) {
        // Place Bedroom 3 in middle row
        const bed3W = Math.round(middleRemainingW * 0.36);
        const diningW = Math.round(middleRemainingW * 0.28);
        const kitchenW = middleRemainingW - bed3W - diningW;

        // Bedroom 3 (Guest Bedroom / Study)
        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'bedroom',
          name: 'Bedroom 3',
          level: lvl,
          x: curX2,
          y: row2Y,
          width: bed3W,
          length: middleRowDepth,
          area: bed3W * middleRowDepth,
          zone: ROOM_ZONES.PRIVATE,
          color: STANDARD_ROOM_SPECS.bedroom.color,
          doors: [{ wall: 'east', offset: 2, width: 3 }],
          windows: [{ wall: 'west', offset: bed3W / 2, width: 3.5 }],
        });
        curX2 += bed3W;

        // Dining
        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'dining',
          name: 'Dining & Circulation Foyer',
          level: lvl,
          x: curX2,
          y: row2Y,
          width: diningW,
          length: middleRowDepth,
          area: diningW * middleRowDepth,
          zone: ROOM_ZONES.PUBLIC,
          color: STANDARD_ROOM_SPECS.dining.color,
          doors: [{ wall: 'east', offset: diningW / 2, width: 3 }],
          windows: [],
        });
        curX2 += diningW;

        // Kitchen
        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'kitchen',
          name: getKitchenName(),
          level: lvl,
          x: curX2,
          y: row2Y,
          width: kitchenW,
          length: middleRowDepth,
          area: kitchenW * middleRowDepth,
          zone: ROOM_ZONES.SERVICE,
          color: STANDARD_ROOM_SPECS.kitchen.color,
          doors: [{ wall: 'west', offset: 2, width: 3 }],
          windows: [{ wall: 'east', offset: kitchenW / 2, width: 3.5 }],
        });
      } else {
        // 1 or 2 bedrooms on this floor:
        // Split middle row into Kitchen, Dining, and Bathroom (if 2 BHK with 2 bathrooms or upper floor)
        if ((lvl > 0 && fReq.bedrooms === 2) || (fReq.bedrooms === 2 && fReq.bathrooms >= 2)) {
          // Place Bathroom in middle row to avoid cramming 2 bathrooms into rear row!
          const bathW = Math.max(6, Math.min(8, Math.round(middleRemainingW * 0.25)));
          const kitchenW = Math.round((middleRemainingW - bathW) * 0.48);
          const diningW = middleRemainingW - kitchenW - bathW;

          // Kitchen
          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'kitchen',
            name: getKitchenName(),
            level: lvl,
            x: curX2,
            y: row2Y,
            width: kitchenW,
            length: middleRowDepth,
            area: kitchenW * middleRowDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.kitchen.color,
            doors: [{ wall: 'east', offset: 2, width: 3 }],
            windows: [{ wall: 'west', offset: kitchenW / 2, width: 3.5 }],
          });
          curX2 += kitchenW;

          // Dining
          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'dining',
            name: 'Dining & Circulation Foyer',
            level: lvl,
            x: curX2,
            y: row2Y,
            width: diningW,
            length: middleRowDepth,
            area: diningW * middleRowDepth,
            zone: ROOM_ZONES.PUBLIC,
            color: STANDARD_ROOM_SPECS.dining.color,
            doors: [{ wall: 'west', offset: diningW / 2, width: 3 }],
            windows: [],
          });
          curX2 += diningW;

          // Bathroom with comfortable natural dimensions (e.g. 8x10 ft or 7x10 ft)
          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bathroom',
            name: 'Bathroom',
            level: lvl,
            x: curX2,
            y: row2Y,
            width: bathW,
            length: middleRowDepth,
            area: bathW * middleRowDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.bathroom.color,
            doors: [{ wall: 'west', offset: 1.5, width: 2.5 }],
            windows: [{ wall: 'east', offset: 1.5, width: 2 }],
          });
        } else {
          // Standard single floor Kitchen & Dining
          const kitchenW = Math.max(8, Math.round(middleRemainingW * 0.45));
          const diningW = middleRemainingW - kitchenW;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'dining',
            name: 'Dining & Circulation Foyer',
            level: lvl,
            x: curX2,
            y: row2Y,
            width: diningW,
            length: middleRowDepth,
            area: diningW * middleRowDepth,
            zone: ROOM_ZONES.PUBLIC,
            color: STANDARD_ROOM_SPECS.dining.color,
            doors: [{ wall: 'east', offset: diningW / 2, width: 3 }],
            windows: [{ wall: 'west', offset: 2, width: 3 }],
          });
          curX2 += diningW;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'kitchen',
            name: getKitchenName(),
            level: lvl,
            x: curX2,
            y: row2Y,
            width: kitchenW,
            length: middleRowDepth,
            area: kitchenW * middleRowDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.kitchen.color,
            doors: [{ wall: 'west', offset: 2, width: 3 }],
            windows: [{ wall: 'east', offset: kitchenW / 2, width: 3.5 }],
          });
        }
      }
    } else {
      // No kitchen on this floor (e.g. upper floor lounge/study)
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'corridor',
        name: 'Central Passage & Staircase Access',
        level: lvl,
        x: curX2,
        y: row2Y,
        width: middleRemainingW,
        length: middleRowDepth,
        area: middleRemainingW * middleRowDepth,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.corridor.color,
        doors: [{ wall: 'north', offset: 2, width: 3 }],
        windows: [{ wall: 'east', offset: middleRemainingW / 2, width: 3 }],
      });
    }

    // --- REAR ROW (Y: row2Y + middleRowDepth) ---
    const row3Y = row2Y + middleRowDepth;

    if (fReq.bedrooms === 1) {
      // 1 Bedroom on this floor (e.g. 1 BHK)
      const bathW = Math.max(6, Math.min(8, Math.round(buildableWidth * 0.32)));
      const bedW = buildableWidth - bathW;

      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'master_bedroom',
        name: 'Master Bedroom',
        level: lvl,
        x: startX,
        y: row3Y,
        width: bedW,
        length: rearRowDepth,
        area: bedW * rearRowDepth,
        zone: ROOM_ZONES.PRIVATE,
        color: STANDARD_ROOM_SPECS.master_bedroom.color,
        doors: [{ wall: 'north', offset: 2, width: 3 }],
        windows: [{ wall: 'south', offset: bedW / 2, width: 4 }],
      });

      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'bathroom',
        name: 'Bathroom',
        level: lvl,
        x: startX + bedW,
        y: row3Y,
        width: bathW,
        length: rearRowDepth,
        area: bathW * rearRowDepth,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.bathroom.color,
        doors: [{ wall: 'west', offset: 1.5, width: 2.5 }],
        windows: [{ wall: 'east', offset: 1.5, width: 2 }],
      });
    } else if (fReq.bedrooms >= 2) {
      // Check if bathroom was already placed in middle row (e.g. upper floor 2 BHK)
      const hasBathInMiddle = rooms.some((r) => r.level === lvl && r.type === 'bathroom');

      if (hasBathInMiddle) {
        // Divide rear row directly between Master Bedroom and Bedroom 2!
        // This gives natural, comfortable square-like proportions (e.g. 16x11 and 14x11 ft)!
        const masterW = Math.round(buildableWidth * 0.53);
        const bed2W = buildableWidth - masterW;

        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'master_bedroom',
          name: 'Master Bedroom',
          level: lvl,
          x: startX,
          y: row3Y,
          width: masterW,
          length: rearRowDepth,
          area: masterW * rearRowDepth,
          zone: ROOM_ZONES.PRIVATE,
          color: STANDARD_ROOM_SPECS.master_bedroom.color,
          doors: [{ wall: 'north', offset: 2, width: 3 }],
          windows: [{ wall: 'south', offset: masterW / 2, width: 4 }],
        });

        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'bedroom',
          name: 'Bedroom 2',
          level: lvl,
          x: startX + masterW,
          y: row3Y,
          width: bed2W,
          length: rearRowDepth,
          area: bed2W * rearRowDepth,
          zone: ROOM_ZONES.PRIVATE,
          color: STANDARD_ROOM_SPECS.bedroom.color,
          doors: [{ wall: 'north', offset: 1.5, width: 3 }],
          windows: [{ wall: 'south', offset: bed2W / 2, width: 3.5 }],
        });
      } else {
        // Bathroom not in middle row: place in rear row alongside Master Bedroom & Bedroom 2
        const masterW = Math.round(buildableWidth * 0.52);
        const rightW = buildableWidth - masterW;

        rooms.push({
          id: `room-${roomIdCounter++}`,
          type: 'master_bedroom',
          name: 'Master Bedroom',
          level: lvl,
          x: startX,
          y: row3Y,
          width: masterW,
          length: rearRowDepth,
          area: masterW * rearRowDepth,
          zone: ROOM_ZONES.PRIVATE,
          color: STANDARD_ROOM_SPECS.master_bedroom.color,
          doors: [{ wall: 'north', offset: 2, width: 3 }],
          windows: [{ wall: 'south', offset: masterW / 2, width: 4 }],
        });

        if (fReq.bathrooms >= 2) {
          const bathDepth = Math.max(6, Math.round(rearRowDepth * 0.42));
          const bed2Depth = rearRowDepth - bathDepth;
          const bath1W = Math.round(rightW * 0.5);
          const bath2W = rightW - bath1W;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bathroom',
            name: 'Attached Bathroom',
            level: lvl,
            x: startX + masterW,
            y: row3Y,
            width: bath1W,
            length: bathDepth,
            area: bath1W * bathDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.bathroom.color,
            doors: [{ wall: 'west', offset: 1.5, width: 2.5 }],
            windows: [{ wall: 'north', offset: 1, width: 2 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bathroom',
            name: 'Common Bathroom',
            level: lvl,
            x: startX + masterW + bath1W,
            y: row3Y,
            width: bath2W,
            length: bathDepth,
            area: bath2W * bathDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.bathroom.color,
            doors: [{ wall: 'north', offset: 1.5, width: 2.5 }],
            windows: [{ wall: 'east', offset: 1.5, width: 2 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bedroom',
            name: 'Bedroom 2',
            level: lvl,
            x: startX + masterW,
            y: row3Y + bathDepth,
            width: rightW,
            length: bed2Depth,
            area: rightW * bed2Depth,
            zone: ROOM_ZONES.PRIVATE,
            color: STANDARD_ROOM_SPECS.bedroom.color,
            doors: [{ wall: 'north', offset: 1.5, width: 3 }],
            windows: [{ wall: 'east', offset: bed2Depth / 2, width: 3.5 }],
          });
        } else {
          const bathDepth = Math.max(6, Math.round(rearRowDepth * 0.38));
          const bed2Depth = rearRowDepth - bathDepth;

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bathroom',
            name: 'Bathroom',
            level: lvl,
            x: startX + masterW,
            y: row3Y,
            width: rightW,
            length: bathDepth,
            area: rightW * bathDepth,
            zone: ROOM_ZONES.SERVICE,
            color: STANDARD_ROOM_SPECS.bathroom.color,
            doors: [{ wall: 'north', offset: 1.5, width: 2.5 }],
            windows: [{ wall: 'east', offset: 1.5, width: 2 }],
          });

          rooms.push({
            id: `room-${roomIdCounter++}`,
            type: 'bedroom',
            name: 'Bedroom 2',
            level: lvl,
            x: startX + masterW,
            y: row3Y + bathDepth,
            width: rightW,
            length: bed2Depth,
            area: rightW * bed2Depth,
            zone: ROOM_ZONES.PRIVATE,
            color: STANDARD_ROOM_SPECS.bedroom.color,
            doors: [{ wall: 'north', offset: 1.5, width: 3 }],
            windows: [{ wall: 'east', offset: bed2Depth / 2, width: 3.5 }],
          });
        }
      }
    } else {
      rooms.push({
        id: `room-${roomIdCounter++}`,
        type: 'utility',
        name: 'Utility / Multi-Purpose Space',
        level: lvl,
        x: startX,
        y: row3Y,
        width: buildableWidth,
        length: rearRowDepth,
        area: buildableWidth * rearRowDepth,
        zone: ROOM_ZONES.SERVICE,
        color: '#f97316',
        doors: [{ wall: 'north', offset: buildableWidth / 2, width: 3 }],
        windows: [{ wall: 'south', offset: buildableWidth / 2, width: 4 }],
      });
    }
  }

  // --- Compute Summary Statistics ---
  let roomAreaSumSqFt = 0;
  let groundFloorOccupiedArea = 0;
  const roomCounts = {};
  const floorBreakdown = {};

  for (const r of rooms) {
    roomAreaSumSqFt += r.area;
    if (r.level === 0) groundFloorOccupiedArea += r.area;
    roomCounts[r.type] = (roomCounts[r.type] || 0) + 1;

    floorBreakdown[r.level] = floorBreakdown[r.level] || {
      level: r.level,
      roomCount: 0,
      totalArea: 0,
      carpetArea: 0,
      outdoorArea: 0,
      circulationArea: 0,
      bedrooms: 0,
    };
    floorBreakdown[r.level].roomCount += 1;
    floorBreakdown[r.level].totalArea += r.area;
    if (r.type === 'parking' || r.type === 'balcony') {
      floorBreakdown[r.level].outdoorArea += r.area;
    } else if (r.type === 'corridor') {
      floorBreakdown[r.level].circulationArea += r.area;
      floorBreakdown[r.level].carpetArea += r.area;
    } else {
      floorBreakdown[r.level].carpetArea += r.area;
    }
    if (r.type === 'master_bedroom' || r.type === 'bedroom') {
      floorBreakdown[r.level].bedrooms += 1;
    }
  }

  const builtUpAreaSqFt = Math.round(roomAreaSumSqFt * 1.15);
  const carpetAreaSqFt = Math.round(
    rooms.filter((r) => r.type !== 'parking' && r.type !== 'balcony').reduce((sum, r) => sum + r.area, 0)
  );
  const outdoorAreaSqFt = rooms
    .filter((r) => r.type === 'parking' || r.type === 'balcony')
    .reduce((sum, r) => sum + r.area, 0);
  const circulationAreaSqFt = rooms
    .filter((r) => r.type === 'corridor')
    .reduce((sum, r) => sum + r.area, 0);
  const usableInteriorCarpetAreaSqFt = carpetAreaSqFt - circulationAreaSqFt;
  const buildingFootprintSqFt = groundFloorOccupiedArea;
  const openOutdoorGroundSqFt = Math.max(0, plotArea - buildingFootprintSqFt);
  const estimatedWallAreaSqFt = Math.round(roomAreaSumSqFt * 0.15);

  const totalBedroomsInLayout = (roomCounts.master_bedroom || 0) + (roomCounts.bedroom || 0);

  const layout = {
    id: `archai-plan-${Date.now()}`,
    status: isDimensionsExplicit ? 'confirmed' : 'provisional',
    isProvisional: !isDimensionsExplicit,
    metadata: {
      title: `${totalBedroomsInLayout > 0 ? `${totalBedroomsInLayout} BHK` : 'Residential'} ${facing.toUpperCase()}-Facing Design (${floorsCount} ${floorsCount === 1 ? 'Floor' : 'Floors'})`,
      createdAt: new Date().toISOString(),
      facing,
      floorsCount,
      unit: 'ft',
    },
    plot: {
      width: plotWidth,
      length: plotLength,
      totalAreaSqFt: plotArea,
      isDimensionsExplicit,
    },
    rooms,
    summary: {
      plotAreaSqFt: plotArea,
      buildingFootprintSqFt,
      openOutdoorGroundSqFt,
      roomAreaSumSqFt,
      totalBuiltUpAreaSqFt: builtUpAreaSqFt,
      totalCarpetAreaSqFt: carpetAreaSqFt,
      usableInteriorCarpetAreaSqFt,
      outdoorAreaSqFt,
      circulationAreaSqFt,
      estimatedWallAreaSqFt,
      groundFloorOccupiedArea,
      groundCoveragePercent: isDimensionsExplicit ? Math.min(100, Math.round((groundFloorOccupiedArea / plotArea) * 100)) : null,
      groundCoverageEstimatedPercent: !isDimensionsExplicit ? Math.min(100, Math.round((groundFloorOccupiedArea / plotArea) * 100)) : null,
      roomCounts,
      totalBedrooms: totalBedroomsInLayout,
      floorBreakdown,
    },
    warnings,
    clarifications,
    disclaimer: COMPLIANCE_DISCLAIMER,
  };

  // Run validation
  const validation = validateLayout(layout);
  const { recommendations } = generateRecommendations(layout);

  return {
    ...layout,
    validation,
    recommendations,
  };
}
