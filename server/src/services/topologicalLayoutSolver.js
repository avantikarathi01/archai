/**
 * ArchAI Constraint-Aware Topological Floor Plan Solver
 * 
 * Generates residential floor plans using topological adjacency graphs,
 * functional zoning, circulation spines, and geometric constraint satisfaction.
 * 
 * -----------------------------------------------------------------------------
 * COPYRIGHT & LICENSE NOTICES:
 * 
 * Portions of the topological adjacency logic and relationship constraints are
 * derived from ArchiGen (https://github.com/Dropio12/archigen).
 * Copyright (c) 2025 Anass El Hallaoui
 * Licensed under the MIT License.
 * 
 * Portions of the vector wall, opening, and multi-floor representation are derived
 * from openPlan3D (https://github.com/laanlabs/openPlan3D).
 * Copyright (c) 2026 theLodgeStudio / Laan Labs
 * Licensed under the MIT License.
 * -----------------------------------------------------------------------------
 */

import {
  ROOM_STANDARDS,
  ARCHITECTURAL_ZONES,
  ADJACENCY_RELATIONSHIPS
} from '../schemas/canonicalArchitecturalSchema.js';
import { validateLayout, generateRecommendations, COMPLIANCE_DISCLAIMER } from './architecturalRules.js';

export class InfeasibleLayoutError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InfeasibleLayoutError';
    this.details = details;
  }
}

/**
 * Geometric helper: computes 2D AABB overlap area between two rectangles
 */
export function computeAABBOverlapArea(r1, r2) {
  const xOverlap = Math.max(0, Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x));
  const yOverlap = Math.max(0, Math.min(r1.y + r1.length, r2.y + r2.length) - Math.max(r1.y, r2.y));
  return xOverlap * yOverlap;
}

/**
 * Checks if two rectangles share an edge (adjacency)
 */
export function getSharedBoundary(r1, r2, tolerance = 0.2) {
  // Check horizontal adjacency (touching along X, overlapping in Y)
  const touchLeftRight = Math.abs(r1.x + r1.width - r2.x) < tolerance || Math.abs(r2.x + r2.width - r1.x) < tolerance;
  const yOverlap = Math.min(r1.y + r1.length, r2.y + r2.length) - Math.max(r1.y, r2.y);
  if (touchLeftRight && yOverlap > tolerance) {
    return { touches: true, orientation: 'vertical', length: yOverlap };
  }

  // Check vertical adjacency (touching along Y, overlapping in X)
  const touchUpDown = Math.abs(r1.y + r1.length - r2.y) < tolerance || Math.abs(r2.y + r2.length - r1.y) < tolerance;
  const xOverlap = Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x);
  if (touchUpDown && xOverlap > tolerance) {
    return { touches: true, orientation: 'horizontal', length: xOverlap };
  }

  return { touches: false, length: 0 };
}

/**
 * Main Topological Floor Plan Layout Generator
 * 
 * @param {object} requirements - Structured requirements or extracted intent
 * @returns {object} Canonical floor plan design with floors, walls, doors, windows, stairs
 */
export function generateTopologicalLayout(requirements) {
  let plotWidth = Number(requirements?.plot?.width);
  let plotLength = Number(requirements?.plot?.length);
  const totalAreaSqFt = Number(requirements?.plot?.totalAreaSqFt);
  const isDimensionsExplicit = Boolean(requirements?.plot?.isDimensionsExplicit);
  const facing = requirements?.facing && requirements.facing !== 'unspecified' ? requirements.facing.toLowerCase() : 'east';
  const warnings = [...(requirements?.warnings || [])];
  const clarifications = [...(requirements?.clarifications || [])];

  // Proportional resolution if dimensions omitted
  if (!plotWidth || !plotLength || isNaN(plotWidth) || isNaN(plotLength)) {
    if (totalAreaSqFt && totalAreaSqFt > 0) {
      plotWidth = Math.round(Math.sqrt(totalAreaSqFt / 1.33));
      plotLength = Math.round(totalAreaSqFt / plotWidth);
      warnings.push(`PROVISIONAL: Plot dimensions estimated as ${plotWidth}x${plotLength} ft (${totalAreaSqFt} sq ft).`);
    } else {
      plotWidth = 30;
      plotLength = 40;
      warnings.push(`PROVISIONAL: Plot dimensions defaulted to standard 30x40 ft (1200 sq ft).`);
    }
  }

  const plotArea = plotWidth * plotLength;
  const floorsCount = Math.max(1, parseInt(requirements?.floors, 10) || 1);
  const kitchenType = requirements?.kitchen?.type || 'closed';
  const hasParking = Boolean(requirements?.parking?.required);
  const totalBedrooms = parseInt(requirements?.bedrooms, 10) || (floorsCount > 1 ? 3 : 2);
  const totalBathrooms = parseInt(requirements?.bathrooms, 10) || (totalBedrooms >= 3 ? 2 : 1);

  // Setback buffers: front for entry/driveway, rear for light/ventilation, sides
  const frontSetback = plotLength >= 50 ? 5 : (plotLength >= 35 ? 3 : 2);
  const rearSetback = plotLength >= 50 ? 4 : (plotLength >= 35 ? 3 : 2);
  const sideSetback = plotWidth >= 40 ? 3 : (plotWidth >= 28 ? 1.5 : 0);

  const buildableWidth = plotWidth - (sideSetback * 2);
  const buildableLength = plotLength - (frontSetback + rearSetback);

  if (buildableWidth < 18 || buildableLength < 20) {
    throw new InfeasibleLayoutError(
      `Plot dimensions (${plotWidth}x${plotLength} ft) leave a buildable envelope of only ` +
      `${buildableWidth}x${buildableLength} ft after municipal setbacks. Minimum 18x20 ft required.`,
      { plotWidth, plotLength, buildableWidth, buildableLength }
    );
  }

  const buildableEnvelopeArea = buildableWidth * buildableLength;

  // Infeasibility check: total requested program vs buildable envelope
  let minProgramArea = 0;
  if (hasParking) minProgramArea += ROOM_STANDARDS.parking.minArea;
  if (floorsCount > 1) minProgramArea += ROOM_STANDARDS.staircase.minArea;
  minProgramArea += ROOM_STANDARDS.living_room.minArea;
  minProgramArea += ROOM_STANDARDS.kitchen.minArea;
  minProgramArea += totalBedrooms * ROOM_STANDARDS.bedroom.minArea;
  minProgramArea += totalBathrooms * ROOM_STANDARDS.common_bathroom.minArea;

  const totalCapacity = buildableEnvelopeArea * floorsCount;
  if (minProgramArea > totalCapacity) {
    throw new InfeasibleLayoutError(
      `Infeasible Program: Requested program requires minimum ${Math.round(minProgramArea)} sq ft, ` +
      `but total capacity across ${floorsCount} ${floorsCount === 1 ? 'floor' : 'floors'} is only ${Math.round(totalCapacity)} sq ft.`,
      { minProgramArea, totalCapacity, buildableEnvelopeArea }
    );
  }

  const X0 = sideSetback;
  const Y0 = frontSetback;
  const W = buildableWidth;
  const L = buildableLength;

  const allFloors = [];
  let roomId = 1;

  for (let lvl = 0; lvl < floorsCount; lvl++) {
    const rooms = [];

    if (floorsCount === 1) {
      // =======================================================================
      // SINGLE-FLOOR DISJOINT PARTITION
      // =======================================================================
      if (hasParking) {
        // Front Zone: Parking (Left) + Foyer (Right)
        const parkW = Math.max(9.5, Math.min(13.0, Math.round(W * 0.42)));
        const parkL = Math.max(15.0, Math.min(18.0, Math.round(L * 0.38)));
        const foyerW = W - parkW;

        rooms.push({
          id: `room-${roomId++}`,
          type: 'parking',
          name: 'Car Parking / Porch',
          level: 0,
          x: X0,
          y: Y0,
          width: parkW,
          length: parkL,
          area: parkW * parkL,
          zone: ARCHITECTURAL_ZONES.OUTDOOR,
          color: '#10b981',
          doors: [{ wall: 'north', offset: parkW / 2, width: 8.5, label: 'Driveway Access' }],
          windows: [],
        });

        rooms.push({
          id: `room-${roomId++}`,
          type: 'foyer',
          name: 'Main Entrance Foyer',
          level: 0,
          x: X0 + parkW,
          y: Y0,
          width: foyerW,
          length: parkL,
          area: foyerW * parkL,
          zone: ARCHITECTURAL_ZONES.CIRCULATION,
          color: '#64748b',
          doors: [
            { wall: 'front', offset: foyerW / 2, width: 3.5, label: 'Main Entrance Door' },
            { wall: 'south', offset: foyerW / 2, width: 3.2, label: 'Entry to Living' }
          ],
          windows: [],
        });

        // Rear Zone (disjoint from Front Zone: y starts at Y0 + parkL)
        const rearY = Y0 + parkL;
        const rearL = L - parkL;
        const leftW = Math.round(W * 0.50);
        const rightW = W - leftW;

        if (totalBedrooms <= 2) {
          // Master Suite in Left Column
          const bathL = Math.max(5.5, Math.min(7.5, Math.round(rearL * 0.38)));
          const masterBedL = rearL - bathL;

          const mBed = {
            id: `room-${roomId++}`,
            type: 'master_bedroom',
            name: 'Master Bedroom',
            level: 0,
            x: X0,
            y: rearY,
            width: leftW,
            length: masterBedL,
            area: leftW * masterBedL,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#a855f7',
            doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Bedroom Entry' }],
            windows: [{ wall: 'west', offset: masterBedL / 2, width: 4.0, label: 'Bedroom Window' }],
          };
          rooms.push(mBed);

          const attBath = {
            id: `room-${roomId++}`,
            type: 'bathroom',
            name: 'Master Attached Bathroom (Ensuite)',
            level: 0,
            x: X0,
            y: rearY + masterBedL,
            width: leftW,
            length: bathL,
            area: leftW * bathL,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            isAttached: true,
            attachedToRoomId: mBed.id,
            doors: [{ wall: 'north', offset: leftW / 2, width: 2.5, label: 'Private Ensuite Door' }],
            windows: [{ wall: 'west', offset: bathL / 2, width: 2.0, label: 'Ventilator' }],
          };
          rooms.push(attBath);

          if (totalBedrooms === 2) {
            // Right Column: Living (top), Bedroom 2 (mid), Kitchen (bottom)
            const kL = Math.max(7.0, Math.min(9.0, Math.round(rearL * 0.32)));
            const b2L = Math.max(9.0, Math.min(11.0, Math.round(rearL * 0.36)));
            const livL = rearL - (kL + b2L);

            rooms.push({
              id: `room-${roomId++}`,
              type: 'living_room',
              name: 'Living Room / Drawing Lounge',
              level: 0,
              x: X0 + leftW,
              y: rearY,
              width: rightW,
              length: livL,
              area: rightW * livL,
              zone: ARCHITECTURAL_ZONES.PUBLIC,
              color: '#38bdf8',
              doors: [{ wall: 'north', offset: 2.0, width: 3.2, label: 'From Foyer' }],
              windows: [{ wall: 'east', offset: livL / 2, width: 4.5, label: 'Lounge Window' }],
            });

            rooms.push({
              id: `room-${roomId++}`,
              type: 'bedroom',
              name: 'Bedroom 2',
              level: 0,
              x: X0 + leftW,
              y: rearY + livL,
              width: rightW,
              length: b2L,
              area: rightW * b2L,
              zone: ARCHITECTURAL_ZONES.PRIVATE,
              color: '#818cf8',
              doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Bedroom 2 Door' }],
              windows: [{ wall: 'east', offset: b2L / 2, width: 4.0, label: 'Bedroom 2 Window' }],
            });

            rooms.push({
              id: `room-${roomId++}`,
              type: 'kitchen',
              name: kitchenType === 'open' ? 'Open Modular Kitchen' : 'Kitchen',
              level: 0,
              x: X0 + leftW,
              y: rearY + livL + b2L,
              width: rightW,
              length: kL,
              area: rightW * kL,
              zone: ARCHITECTURAL_ZONES.SERVICE,
              color: '#fb923c',
              kitchenType,
              doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Kitchen Door' }],
              windows: [{ wall: 'south', offset: rightW / 2, width: 3.5, label: 'Exhaust & Daylight' }],
            });
          } else {
            // 1 BHK: Living (top) + Kitchen (bottom)
            const kL = Math.max(7.5, Math.min(10.0, Math.round(rearL * 0.42)));
            const livL = rearL - kL;

            rooms.push({
              id: `room-${roomId++}`,
              type: 'living_room',
              name: 'Living Room & Dining Area',
              level: 0,
              x: X0 + leftW,
              y: rearY,
              width: rightW,
              length: livL,
              area: rightW * livL,
              zone: ARCHITECTURAL_ZONES.PUBLIC,
              color: '#38bdf8',
              doors: [{ wall: 'north', offset: rightW / 2, width: 3.2, label: 'From Foyer' }],
              windows: [{ wall: 'east', offset: livL / 2, width: 4.5, label: 'Lounge Window' }],
            });

            rooms.push({
              id: `room-${roomId++}`,
              type: 'kitchen',
              name: kitchenType === 'open' ? 'Open Modular Kitchen' : 'Kitchen',
              level: 0,
              x: X0 + leftW,
              y: rearY + livL,
              width: rightW,
              length: kL,
              area: rightW * kL,
              zone: ARCHITECTURAL_ZONES.SERVICE,
              color: '#fb923c',
              kitchenType,
              doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Kitchen Door' }],
              windows: [{ wall: 'south', offset: rightW / 2, width: 3.5, label: 'Exhaust & Daylight' }],
            });
          }
        } else {
          // 3 BHK or 4 BHK Single-Floor Villa (e.g. 40x60 plot)
          const row1L = Math.round(rearL * 0.52);
          const row2L = rearL - row1L;

          // Left Row 1: Master Bed + Attached Bath
          const bathW = Math.max(5.0, Math.min(7.0, Math.round(leftW * 0.35)));
          const bedW = leftW - bathW;

          const mBed = {
            id: `room-${roomId++}`,
            type: 'master_bedroom',
            name: 'Master Bed',
            level: 0,
            x: X0,
            y: rearY,
            width: bedW,
            length: row1L,
            area: bedW * row1L,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#a855f7',
            doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Master Suite Door' }],
            windows: [{ wall: 'west', offset: row1L / 2, width: 4.0, label: 'Master Window' }],
          };
          rooms.push(mBed);

          const attBath = {
            id: `room-${roomId++}`,
            type: 'bathroom',
            name: 'Master Attached Bathroom (Ensuite)',
            level: 0,
            x: X0 + bedW,
            y: rearY,
            width: bathW,
            length: row1L,
            area: bathW * row1L,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            isAttached: true,
            attachedToRoomId: mBed.id,
            doors: [{ wall: 'west', offset: row1L / 2, width: 2.5, label: 'Private Ensuite Door' }],
            windows: [{ wall: 'north', offset: bathW / 2, width: 2.0, label: 'Ventilator' }],
          };
          rooms.push(attBath);

          // Right Row 1: Living & Dining Lounge
          rooms.push({
            id: `room-${roomId++}`,
            type: 'living_room',
            name: 'Living Lounge & Dining Hall',
            level: 0,
            x: X0 + leftW,
            y: rearY,
            width: rightW,
            length: row1L,
            area: rightW * row1L,
            zone: ARCHITECTURAL_ZONES.PUBLIC,
            color: '#38bdf8',
            doors: [{ wall: 'north', offset: rightW / 2, width: 3.2, label: 'From Foyer' }],
            windows: [{ wall: 'east', offset: row1L / 2, width: 4.5, label: 'Lounge Window' }],
          });

          // Left Row 2: Bedroom 3 & Bedroom 4
          if (totalBedrooms >= 4) {
            const b3W = Math.round(leftW * 0.55);
            const b4W = leftW - b3W;
            rooms.push({
              id: `room-${roomId++}`,
              type: 'bedroom',
              name: 'Bedroom 3',
              level: 0,
              x: X0,
              y: rearY + row1L,
              width: b3W,
              length: row2L,
              area: b3W * row2L,
              zone: ARCHITECTURAL_ZONES.PRIVATE,
              color: '#818cf8',
              doors: [{ wall: 'north', offset: 2.0, width: 3.0 }],
              windows: [{ wall: 'west', offset: row2L / 2, width: 3.5 }],
            });
            rooms.push({
              id: `room-${roomId++}`,
              type: 'bedroom',
              name: 'Bedroom 4',
              level: 0,
              x: X0 + b3W,
              y: rearY + row1L,
              width: b4W,
              length: row2L,
              area: b4W * row2L,
              zone: ARCHITECTURAL_ZONES.PRIVATE,
              color: '#818cf8',
              doors: [{ wall: 'north', offset: 2.0, width: 3.0 }],
              windows: [{ wall: 'south', offset: b4W / 2, width: 3.5 }],
            });
          } else {
            rooms.push({
              id: `room-${roomId++}`,
              type: 'bedroom',
              name: 'Bedroom 3',
              level: 0,
              x: X0,
              y: rearY + row1L,
              width: leftW,
              length: row2L,
              area: leftW * row2L,
              zone: ARCHITECTURAL_ZONES.PRIVATE,
              color: '#818cf8',
              doors: [{ wall: 'north', offset: 2.0, width: 3.0 }],
              windows: [{ wall: 'west', offset: row2L / 2, width: 4.0 }],
            });
          }

          // Right Row 2: Bedroom 2 + Kitchen + Common Bath
          const b2W = Math.round(rightW * 0.52);
          const remW = rightW - b2W;
          const kL = Math.round(row2L * 0.65);
          const cBathL = row2L - kL;

          rooms.push({
            id: `room-${roomId++}`,
            type: 'bedroom',
            name: 'Bedroom 2',
            level: 0,
            x: X0 + leftW,
            y: rearY + row1L,
            width: b2W,
            length: row2L,
            area: b2W * row2L,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#818cf8',
            doors: [{ wall: 'north', offset: 2.0, width: 3.0 }],
            windows: [{ wall: 'south', offset: b2W / 2, width: 4.0 }],
          });

          rooms.push({
            id: `room-${roomId++}`,
            type: 'kitchen',
            name: kitchenType === 'open' ? 'Open Modular Kitchen' : 'Kitchen',
            level: 0,
            x: X0 + leftW + b2W,
            y: rearY + row1L,
            width: remW,
            length: kL,
            area: remW * kL,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#fb923c',
            kitchenType,
            doors: [{ wall: 'west', offset: 2.0, width: 3.0 }],
            windows: [{ wall: 'east', offset: kL / 2, width: 3.5, label: 'Kitchen Window' }],
          });

          rooms.push({
            id: `room-${roomId++}`,
            type: 'bathroom',
            name: 'Common Washroom',
            level: 0,
            x: X0 + leftW + b2W,
            y: rearY + row1L + kL,
            width: remW,
            length: cBathL,
            area: remW * cBathL,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            doors: [{ wall: 'west', offset: 1.5, width: 2.5 }],
            windows: [{ wall: 'south', offset: remW / 2, width: 2.0 }],
          });
        }

      } else {
        // No Parking: Horizontal Banding
        const frontL = Math.max(11.0, Math.round(L * 0.48));
        const rearL = L - frontL;

        // Front Band: Foyer (Left) + Living Room (Right)
        const foyerW = Math.max(6.0, Math.round(W * 0.32));
        const livingW = W - foyerW;

        rooms.push({
          id: `room-${roomId++}`,
          type: 'foyer',
          name: 'Main Entrance Foyer',
          level: 0,
          x: X0,
          y: Y0,
          width: foyerW,
          length: frontL,
          area: foyerW * frontL,
          zone: ARCHITECTURAL_ZONES.CIRCULATION,
          color: '#64748b',
          doors: [
            { wall: 'front', offset: foyerW / 2, width: 3.5, label: 'Main Entrance Door' },
            { wall: 'east', offset: frontL / 2, width: 3.2, label: 'To Living Room' }
          ],
          windows: [],
        });

        rooms.push({
          id: `room-${roomId++}`,
          type: 'living_room',
          name: 'Living Room / Drawing Lounge',
          level: 0,
          x: X0 + foyerW,
          y: Y0,
          width: livingW,
          length: frontL,
          area: livingW * frontL,
          zone: ARCHITECTURAL_ZONES.PUBLIC,
          color: '#38bdf8',
          doors: [{ wall: 'west', offset: frontL / 2, width: 3.2, label: 'From Foyer' }],
          windows: [{ wall: 'east', offset: frontL / 2, width: 4.5, label: 'Lounge Window' }],
        });

        // Rear Band: Master Bed (Left) + Attached Bath (Middle) + Kitchen (Right)
        const bedW = Math.max(10.0, Math.round(W * 0.48));
        const bathW = Math.max(4.5, Math.min(6.5, Math.round(W * 0.22)));
        const kitchenW = W - (bedW + bathW);

        const masterBed = {
          id: `room-${roomId++}`,
          type: 'master_bedroom',
          name: 'Master Bedroom',
          level: 0,
          x: X0,
          y: Y0 + frontL,
          width: bedW,
          length: rearL,
          area: bedW * rearL,
          zone: ARCHITECTURAL_ZONES.PRIVATE,
          color: '#a855f7',
          doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Bedroom Entry' }],
          windows: [{ wall: 'west', offset: rearL / 2, width: 4.0, label: 'Bedroom Window' }],
        };
        rooms.push(masterBed);

        const attachedBath = {
          id: `room-${roomId++}`,
          type: 'bathroom',
          name: 'Attached Master Bathroom (Ensuite)',
          level: 0,
          x: X0 + bedW, // Docked directly adjacent to master bed along X
          y: Y0 + frontL,
          width: bathW,
          length: rearL,
          area: bathW * rearL,
          zone: ARCHITECTURAL_ZONES.SERVICE,
          color: '#06b6d4',
          isAttached: true,
          attachedToRoomId: masterBed.id,
          doors: [{ wall: 'west', offset: rearL / 2, width: 2.5, label: 'Private Ensuite Door' }],
          windows: [{ wall: 'south', offset: bathW / 2, width: 2.0, label: 'Ventilator' }],
        };
        rooms.push(attachedBath);

        const kitchenRoom = {
          id: `room-${roomId++}`,
          type: 'kitchen',
          name: kitchenType === 'open' ? 'Open Modular Kitchen' : 'Kitchen',
          level: 0,
          x: X0 + bedW + bathW,
          y: Y0 + frontL,
          width: kitchenW,
          length: rearL,
          area: kitchenW * rearL,
          zone: ARCHITECTURAL_ZONES.SERVICE,
          color: '#fb923c',
          kitchenType,
          doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Kitchen Door' }],
          windows: [{ wall: 'south', offset: kitchenW / 2, width: 3.5, label: 'Exhaust & Daylight' }],
        };
        rooms.push(kitchenRoom);
      }

    } else {
      // =======================================================================
      // MULTI-FLOOR (G+1) DISJOINT PARTITION
      // =======================================================================
      const parkW = Math.max(9.5, Math.min(13.0, Math.round(W * 0.44)));
      const parkL = Math.max(15.0, Math.min(17.5, Math.round(L * 0.40)));
      const leftW = parkW;
      const rightW = W - leftW;
      const rearY = Y0 + parkL;
      const rearL = L - parkL;
      const stairL_actual = Math.min(10.0, Math.round(rearL * 0.45));
      const mid2L = rearL - stairL_actual;

      const gfReq = requirements?.floorRequirements?.[0] || {};
      const ffReq = requirements?.floorRequirements?.[1] || {};

      const hasGfStorage = Boolean(gfReq.underStairStorage || requirements?.underStairStorage?.required);
      const hasGfPlungePool = Boolean(gfReq.plungePool || (requirements?.plungePool?.required && !ffReq.plungePool));
      const hasFfPlungePool = Boolean(ffReq.plungePool || (requirements?.plungePool?.required && floorsCount > 1));
      const reqFfBeds = typeof ffReq.bedrooms === 'number' && ffReq.bedrooms > 0 ? ffReq.bedrooms : Math.max(1, totalBedrooms - 1);

      // Dedicated stair flight width (if storage is requested under/beside stairs)
      const stairW = hasGfStorage ? Math.max(6.5, Math.round(leftW * 0.65)) : leftW;
      const storageW = leftW - stairW;

      if (hasFfPlungePool && lvl === 1) {
        warnings.push(
          'STRUCTURAL & WATERPROOFING ADVISORY: First-floor plunge pool imposes substantial live and dead loads (~62.4 lbs/cu ft of water) requiring reinforced concrete slab design, structural column load transfers, and dual-layer waterproof membrane containment. Consult a certified structural engineer.'
        );
      }

      if (lvl === 0) {
        // LEVEL 0: GROUND FLOOR
        // Front Zone:
        const driveDoorW = Math.min(8.5, parkW - 1.0);
        const driveDoorOffset = Math.max(0.5, Math.round(((parkW - driveDoorW) / 2) * 10) / 10);

        rooms.push({
          id: `room-${roomId++}`,
          type: 'parking',
          name: 'Car Parking / Porch',
          level: 0,
          x: X0,
          y: Y0,
          width: parkW,
          length: parkL,
          area: parkW * parkL,
          zone: ARCHITECTURAL_ZONES.OUTDOOR,
          color: '#10b981',
          doors: [{ wall: 'north', offset: driveDoorOffset, width: driveDoorW, label: 'Driveway Entry' }],
          windows: [],
        });

        const foyerDoorW = 3.5;
        const foyerDoorOffset = Math.max(0.5, Math.round(((rightW - foyerDoorW) / 2) * 10) / 10);

        rooms.push({
          id: `room-${roomId++}`,
          type: 'foyer',
          name: 'Main Entrance Foyer',
          level: 0,
          x: X0 + parkW,
          y: Y0,
          width: rightW,
          length: parkL,
          area: rightW * parkL,
          zone: ARCHITECTURAL_ZONES.CIRCULATION,
          color: '#64748b',
          doors: [
            { wall: 'front', offset: foyerDoorOffset, width: foyerDoorW, label: 'Main Entrance Door' },
            { wall: 'south', offset: foyerDoorOffset, width: 3.2, label: 'To Living Lounge' }
          ],
          windows: [],
        });

        // Middle Zone: Left Column -> Staircase (+ Under-Stair Storage if requested)
        rooms.push({
          id: `room-${roomId++}`,
          type: 'staircase',
          name: 'Staircase to Upper Floor',
          level: 0,
          x: X0,
          y: rearY,
          width: stairW,
          length: stairL_actual,
          area: stairW * stairL_actual,
          zone: ARCHITECTURAL_ZONES.CIRCULATION,
          color: '#64748b',
          doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Stair Access' }],
          windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.25) * 10) / 10), width: 2.5 }],
        });

        if (hasGfStorage) {
          rooms.push({
            id: `room-${roomId++}`,
            type: 'storage',
            name: 'Enclosed Under-Stair Storage',
            level: 0,
            x: X0 + stairW,
            y: rearY,
            width: storageW,
            length: stairL_actual,
            area: storageW * stairL_actual,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#64748b',
            doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.2) * 10) / 10), width: 2.4, label: 'Storage Door' }],
            windows: [],
          });
        }

        // Rear Zone: Left Column -> Ground Floor Plunge Pool Room or Dining Room
        if (hasGfPlungePool) {
          const poolBasinW = Math.max(4.0, Math.round((leftW - 3.0) * 10) / 10);
          const poolBasinL = Math.max(5.0, Math.round((mid2L - 3.0) * 10) / 10);

          rooms.push({
            id: `room-${roomId++}`,
            type: 'plunge_pool',
            name: 'Ground Floor Plunge Pool Room',
            level: 0,
            x: X0,
            y: rearY + stairL_actual,
            width: leftW,
            length: mid2L,
            area: leftW * mid2L,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            basin: {
              width: poolBasinW,
              length: poolBasinL,
              depth: 4.0,
              waterColor: '#06b6d4',
            },
            doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((mid2L / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Pool Room Door' }],
            windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((mid2L / 2 - 2.0) * 10) / 10), width: 4.0, label: 'Pool Ventilation' }],
          });
        } else {
          rooms.push({
            id: `room-${roomId++}`,
            type: 'dining',
            name: 'Dining Room',
            level: 0,
            x: X0,
            y: rearY + stairL_actual,
            width: leftW,
            length: mid2L,
            area: leftW * mid2L,
            zone: ARCHITECTURAL_ZONES.PUBLIC,
            color: '#38bdf8',
            doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((mid2L / 2 - 1.5) * 10) / 10), width: 3.0, label: 'To Kitchen' }],
            windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((mid2L / 2 - 1.75) * 10) / 10), width: 3.5 }],
          });
        }

        // Right Column: Living Lounge (top) + Kitchen (bottom)
        const kitchenL = Math.max(7.0, Math.min(10.0, Math.round(rearL * 0.42)));
        const livingL = rearL - kitchenL;

        rooms.push({
          id: `room-${roomId++}`,
          type: 'living_room',
          name: 'Living Room / Drawing Lounge',
          level: 0,
          x: X0 + leftW,
          y: rearY,
          width: rightW,
          length: livingL,
          area: rightW * livingL,
          zone: ARCHITECTURAL_ZONES.PUBLIC,
          color: '#38bdf8',
          doors: [{ wall: 'north', offset: 2.0, width: 3.2, label: 'From Foyer' }],
          windows: [{ wall: 'east', offset: Math.max(0.5, Math.round((livingL / 2 - 2.25) * 10) / 10), width: 4.5, label: 'Lounge Window' }],
        });

        rooms.push({
          id: `room-${roomId++}`,
          type: 'kitchen',
          name: kitchenType === 'open' ? 'Open Modular Kitchen' : 'Kitchen',
          level: 0,
          x: X0 + leftW,
          y: rearY + livingL,
          width: rightW,
          length: kitchenL,
          area: rightW * kitchenL,
          zone: ARCHITECTURAL_ZONES.SERVICE,
          color: '#fb923c',
          kitchenType,
          doors: [{ wall: 'west', offset: 2.0, width: 3.0, label: 'Kitchen Door' }],
          windows: [{ wall: 'south', offset: Math.max(0.5, Math.round((rightW / 2 - 1.75) * 10) / 10), width: 3.5, label: 'Exhaust & Daylight' }],
        });

      } else {
        // LEVEL 1: FIRST FLOOR
        const balcL = Math.min(6.0, parkL);

        // Front Left: Balcony (+ Bedroom 2 if 2+ bedrooms requested)
        rooms.push({
          id: `room-${roomId++}`,
          type: 'balcony',
          name: 'Front Balcony',
          level: 1,
          x: X0,
          y: Y0,
          width: leftW,
          length: balcL,
          area: leftW * balcL,
          zone: ARCHITECTURAL_ZONES.OUTDOOR,
          color: '#34d399',
          doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((balcL / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Glass Sliding Door' }],
          windows: [],
        });

        if (hasFfPlungePool && reqFfBeds >= 2) {
          // Dedicated Bedroom 2 in the front left zone beneath the balcony
          const b2L = parkL - balcL;
          rooms.push({
            id: `room-${roomId++}`,
            type: 'bedroom',
            name: 'Bedroom 2',
            level: 1,
            x: X0,
            y: Y0 + balcL,
            width: leftW,
            length: b2L,
            area: leftW * b2L,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#818cf8',
            doors: [{ wall: 'east', offset: 2.0, width: 3.0, label: 'Bedroom 2 Entry' }],
            windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((b2L / 2 - 1.75) * 10) / 10), width: 3.5, label: 'Window' }],
          });

          // Front Right: Master Bedroom Suite
          rooms.push({
            id: `room-${roomId++}`,
            type: 'master_bedroom',
            name: 'Master Bedroom Suite',
            level: 1,
            x: X0 + leftW,
            y: Y0,
            width: rightW,
            length: parkL,
            area: rightW * parkL,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#a855f7',
            doors: [{ wall: 'south', offset: 2.0, width: 3.0, label: 'Master Suite Door' }],
            windows: [{ wall: 'east', offset: Math.max(0.5, Math.round((parkL / 2 - 2.25) * 10) / 10), width: 4.5, label: 'Window' }],
          });
        } else {
          // Standard front right: Family Lounge
          rooms.push({
            id: `room-${roomId++}`,
            type: 'living_room',
            name: 'Family Lounge & Study',
            level: 1,
            x: X0 + leftW,
            y: Y0,
            width: rightW,
            length: parkL,
            area: rightW * parkL,
            zone: ARCHITECTURAL_ZONES.PUBLIC,
            color: '#38bdf8',
            doors: [{ wall: 'south', offset: Math.max(0.5, Math.round((rightW / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Hallway Entry' }],
            windows: [{ wall: 'east', offset: Math.max(0.5, Math.round((parkL / 2 - 2.25) * 10) / 10), width: 4.5, label: 'Balcony Window' }],
          });
        }

        // Middle Zone: Left Column -> Staircase Landing (EXACT SAME x, y, width, length as Level 0!)
        rooms.push({
          id: `room-${roomId++}`,
          type: 'staircase',
          name: 'Staircase Landing',
          level: 1,
          x: X0,
          y: rearY,
          width: stairW,
          length: stairL_actual,
          area: stairW * stairL_actual,
          zone: ARCHITECTURAL_ZONES.CIRCULATION,
          color: '#64748b',
          doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Upper Landing Entry' }],
          windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.25) * 10) / 10), width: 2.5 }],
        });

        if (hasGfStorage) {
          rooms.push({
            id: `room-${roomId++}`,
            type: 'corridor',
            name: 'Upper Hallway Nook',
            level: 1,
            x: X0 + stairW,
            y: rearY,
            width: storageW,
            length: stairL_actual,
            area: storageW * stairL_actual,
            zone: ARCHITECTURAL_ZONES.CIRCULATION,
            color: '#64748b',
            doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((stairL_actual / 2 - 1.2) * 10) / 10), width: 2.4 }],
            windows: [],
          });
        }

        if (hasFfPlungePool) {
          // Rear Left: Separate Enclosed Plunge Pool Room
          const poolBasinW = Math.max(4.0, Math.round((leftW - 3.0) * 10) / 10);
          const poolBasinL = Math.max(5.0, Math.round((mid2L - 3.0) * 10) / 10);

          rooms.push({
            id: `room-${roomId++}`,
            type: 'plunge_pool',
            name: 'First Floor Plunge Pool Room',
            level: 1,
            x: X0,
            y: rearY + stairL_actual,
            width: leftW,
            length: mid2L,
            area: leftW * mid2L,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            basin: {
              width: poolBasinW,
              length: poolBasinL,
              depth: 4.0,
              waterColor: '#06b6d4',
            },
            doors: [{ wall: 'east', offset: Math.max(0.5, Math.round((mid2L / 2 - 1.5) * 10) / 10), width: 3.0, label: 'Pool Room Door' }],
            windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((mid2L / 2 - 2.0) * 10) / 10), width: 4.0, label: 'Pool Ventilation' }],
          });

          // Middle & Rear Right: Upper Lounge/Passage (top) + Attached Bathroom (bottom)
          const bathL = Math.max(5.5, Math.min(7.5, Math.round(rearL * 0.38)));
          const loungeL = rearL - bathL;

          rooms.push({
            id: `room-${roomId++}`,
            type: 'living_room',
            name: 'Family Lounge & Corridor',
            level: 1,
            x: X0 + leftW,
            y: rearY,
            width: rightW,
            length: loungeL,
            area: rightW * loungeL,
            zone: ARCHITECTURAL_ZONES.PUBLIC,
            color: '#38bdf8',
            doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'From Master Suite' }],
            windows: [{ wall: 'east', offset: Math.max(0.5, Math.round((loungeL / 2 - 2.0) * 10) / 10), width: 4.0 }],
          });

          rooms.push({
            id: `room-${roomId++}`,
            type: 'bathroom',
            name: 'Master Attached Bathroom (Ensuite)',
            level: 1,
            x: X0 + leftW,
            y: rearY + loungeL,
            width: rightW,
            length: bathL,
            area: rightW * bathL,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            isAttached: true,
            doors: [{ wall: 'north', offset: 2.0, width: 2.8, label: 'Bathroom Door' }],
            windows: [{ wall: 'south', offset: Math.max(0.5, Math.round((rightW / 2 - 1.5) * 10) / 10), width: 3.0 }],
          });

        } else {
          // Standard Level 1 layout without plunge pool
          rooms.push({
            id: `room-${roomId++}`,
            type: 'bedroom',
            name: 'Bedroom 2',
            level: 1,
            x: X0,
            y: rearY + stairL_actual,
            width: leftW,
            length: mid2L,
            area: leftW * mid2L,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#818cf8',
            doors: [{ wall: 'east', offset: 2.0, width: 3.0, label: 'Bedroom 2 Entry' }],
            windows: [{ wall: 'west', offset: Math.max(0.5, Math.round((mid2L / 2 - 2.0) * 10) / 10), width: 4.0, label: 'Window' }],
          });

          const bathL = Math.max(5.5, Math.min(7.5, Math.round(rearL * 0.38)));
          const masterBedL = rearL - bathL;

          const masterBedF1 = {
            id: `room-${roomId++}`,
            type: 'master_bedroom',
            name: 'Master Bedroom Suite',
            level: 1,
            x: X0 + leftW,
            y: rearY,
            width: rightW,
            length: masterBedL,
            area: rightW * masterBedL,
            zone: ARCHITECTURAL_ZONES.PRIVATE,
            color: '#a855f7',
            doors: [{ wall: 'north', offset: 2.0, width: 3.0, label: 'Master Suite Door' }],
            windows: [{ wall: 'east', offset: Math.max(0.5, Math.round((masterBedL / 2 - 2.25) * 10) / 10), width: 4.5, label: 'Window' }],
          };
          rooms.push(masterBedF1);

          rooms.push({
            id: `room-${roomId++}`,
            type: 'bathroom',
            name: 'Master Attached Bathroom (Ensuite)',
            level: 1,
            x: X0 + leftW,
            y: rearY + masterBedL,
            width: rightW,
            length: bathL,
            area: rightW * bathL,
            zone: ARCHITECTURAL_ZONES.SERVICE,
            color: '#06b6d4',
            isAttached: true,
            attachedToRoomId: masterBedF1.id,
            doors: [{ wall: 'north', offset: rightW / 2, width: 2.5, label: 'Private Ensuite Door' }],
            windows: [{ wall: 'south', offset: rightW / 2, width: 2.0, label: 'Ventilator' }],
          });
        }
      }
    }

    allFloors.push({
      level: lvl,
      name: lvl === 0 ? 'Ground Floor' : `Floor ${lvl}`,
      elevation: lvl * 10.0,
      slabThickness: 0.5,
      rooms,
    });
  }

  // Flatten rooms across floors for canonical layout model
  const allRooms = allFloors.flatMap(fl => fl.rooms);

  // Derive Canonical OpenPlan3D-Compatible Walls, Doors, Windows, and Stairs
  const canonicalData = deriveCanonicalGeometry(allFloors, plotWidth, plotLength, facing);

  // Compute standard summary metrics for full downstream compatibility
  const totalRoomAreaSum = allRooms.reduce((acc, r) => acc + r.area, 0);
  const gfRooms = allRooms.filter(r => r.level === 0);
  const gfOccupiedArea = gfRooms.reduce((acc, r) => acc + r.area, 0);
  const totalBedroomsCount = allRooms.filter(r => r.type === 'bedroom' || r.type === 'master_bedroom').length;

  const floorBreakdown = {};
  for (let l = 0; l < floorsCount; l++) {
    const lRooms = allRooms.filter(r => r.level === l);
    floorBreakdown[l] = {
      level: l,
      name: l === 0 ? 'Ground Floor' : `Floor ${l}`,
      roomCount: lRooms.length,
      carpetAreaSqFt: lRooms.reduce((acc, r) => acc + r.area, 0),
    };
  }

  const baseLayout = {
    id: `archai-topo-${Date.now()}`,
    status: isDimensionsExplicit ? 'confirmed' : 'provisional',
    isProvisional: !isDimensionsExplicit,
    engine: 'topological_solver_v1',
    metadata: {
      title: `${totalBedroomsCount > 0 ? `${totalBedroomsCount} BHK` : 'Residential'} ${facing.toUpperCase()}-Facing Design (${floorsCount} ${floorsCount === 1 ? 'Floor' : 'Floors'})`,
      createdAt: new Date().toISOString(),
      facing,
      floorsCount,
      unit: 'ft',
      solver: 'topological_constraint_engine',
    },
    plot: {
      width: plotWidth,
      length: plotLength,
      totalAreaSqFt: plotArea,
      isDimensionsExplicit,
      facing,
      buildableEnvelope: {
        width: buildableWidth,
        length: buildableLength,
        frontSetback,
        rearSetback,
        sideSetback,
      },
    },
    rooms: allRooms,
    floorsCount,
    floors: allFloors,
    requirements: requirements,
    floorRequirements: requirements?.floorRequirements,
    walls: canonicalData.walls,
    doors: canonicalData.doors,
    windows: canonicalData.windows,
    stairs: canonicalData.stairs,
    circulation: canonicalData.circulation,
    summary: {
      plotAreaSqFt: plotArea,
      buildingFootprintSqFt: gfOccupiedArea,
      roomAreaSumSqFt: totalRoomAreaSum,
      totalBuiltUpAreaSqFt: Math.round(totalRoomAreaSum * 1.15),
      totalCarpetAreaSqFt: totalRoomAreaSum,
      usableInteriorCarpetAreaSqFt: allRooms.filter(r => r.zone !== ARCHITECTURAL_ZONES.OUTDOOR).reduce((acc, r) => acc + r.area, 0),
      outdoorAreaSqFt: allRooms.filter(r => r.zone === ARCHITECTURAL_ZONES.OUTDOOR).reduce((acc, r) => acc + r.area, 0),
      circulationAreaSqFt: allRooms.filter(r => r.zone === ARCHITECTURAL_ZONES.CIRCULATION).reduce((acc, r) => acc + r.area, 0),
      groundFloorOccupiedArea: gfOccupiedArea,
      groundCoveragePercent: Math.min(100, Math.round((gfOccupiedArea / plotArea) * 100)),
      roomCounts: {
        bedrooms: totalBedroomsCount,
        bathrooms: allRooms.filter(r => r.type === 'bathroom').length,
        kitchens: allRooms.filter(r => r.type === 'kitchen').length,
        livingRooms: allRooms.filter(r => r.type === 'living_room').length,
      },
      totalBedrooms: totalBedroomsCount,
      floorBreakdown,
    },
    warnings,
    clarifications,
    disclaimer: COMPLIANCE_DISCLAIMER,
  };

  // Run geometric validation
  const validation = validateLayout(baseLayout);
  const topologicalValidation = runTopologicalValidation(allFloors, plotWidth, plotLength);
  const { recommendations } = generateRecommendations(baseLayout);

  return {
    ...baseLayout,
    validation,
    topologicalValidation,
    recommendations,
  };
}

/**
 * Derives OpenPlan3D-compatible vector walls, door cutouts, windows, and stairs
 */
function deriveCanonicalGeometry(floors, plotWidth, plotLength, facing) {
  const walls = [];
  const doors = [];
  const windows = [];
  const stairs = [];
  let wallIdCounter = 1;
  let doorIdCounter = 1;
  let winIdCounter = 1;
  let stairIdCounter = 1;

  for (const floor of floors) {
    const floorLvl = floor.level;
    const floorElevation = floor.elevation || (floorLvl * 10);

    for (const r of floor.rooms) {
      // Create 4 enclosing walls per room
      const p1 = { x: r.x, y: r.y };
      const p2 = { x: r.x + r.width, y: r.y };
      const p3 = { x: r.x + r.width, y: r.y + r.length };
      const p4 = { x: r.x, y: r.y + r.length };

      const segments = [
        { start: p1, end: p2, orientation: 'north' },
        { start: p2, end: p3, orientation: 'east' },
        { start: p3, end: p4, orientation: 'south' },
        { start: p4, end: p1, orientation: 'west' },
      ];

      for (const seg of segments) {
        const wallId = `wall-${wallIdCounter++}`;
        const isExterior = (
          Math.abs(seg.start.x) < 0.5 || Math.abs(seg.end.x - plotWidth) < 0.5 ||
          Math.abs(seg.start.y) < 0.5 || Math.abs(seg.end.y - plotLength) < 0.5
        );

        walls.push({
          id: wallId,
          floorLevel: floorLvl,
          roomId: r.id,
          start: seg.start,
          end: seg.end,
          thickness: isExterior ? 0.75 : 0.38, // feet (9" exterior, 4.5" interior)
          height: 10.0,
          isExterior,
        });

        // Map doors on this room onto wall
        if (r.doors && r.doors.length > 0) {
          for (const d of r.doors) {
            if (d.wall === seg.orientation || (d.wall === 'front' && seg.orientation === 'north') || (d.wall === 'rear' && seg.orientation === 'south') || (d.wall === 'left' && seg.orientation === 'west') || (d.wall === 'right' && seg.orientation === 'east')) {
              doors.push({
                id: `door-${doorIdCounter++}`,
                wallId,
                floorLevel: floorLvl,
                roomId: r.id,
                position: 0.5,
                width: d.width || 3.0,
                height: 7.0,
                type: d.width > 5 ? 'double' : (d.width >= 7 ? 'garage' : 'single'),
                swingDirection: 'right',
                flipSide: false,
                label: d.label || `${r.name} Door`,
              });
            }
          }
        }

        // Map windows on this room onto wall
        if (r.windows && r.windows.length > 0) {
          for (const w of r.windows) {
            if (w.wall === seg.orientation || (w.wall === 'front' && seg.orientation === 'north') || (w.wall === 'rear' && seg.orientation === 'south') || (w.wall === 'left' && seg.orientation === 'west') || (w.wall === 'right' && seg.orientation === 'east')) {
              windows.push({
                id: `window-${winIdCounter++}`,
                wallId,
                floorLevel: floorLvl,
                roomId: r.id,
                position: 0.5,
                width: w.width || 4.0,
                height: 4.5,
                sillHeight: 2.5,
                type: 'casement',
                label: w.label || `${r.name} Window`,
              });
            }
          }
        }
      }

      // If room is staircase, register 3D stair entity
      if (r.type === 'staircase') {
        stairs.push({
          id: `stair-${stairIdCounter++}`,
          floorLevel: floorLvl,
          position: { x: r.x, y: r.y },
          rotation: 0,
          width: r.width,
          depth: r.length,
          riserCount: 16,
          direction: floorLvl === 0 ? 'up' : 'down',
          stairType: 'straight',
          elevation: floorElevation,
        });
      }
    }
  }

  return {
    walls,
    doors,
    windows,
    stairs,
    circulation: { spineWidth: 4.0 },
  };
}

/**
 * Validates topological constraints, overlaps, boundary adherence, and circulation
 */
export function runTopologicalValidation(floors, plotWidth, plotLength) {
  const issues = [];
  let totalCheckedRooms = 0;
  let overlapCount = 0;

  for (const fl of floors) {
    const rooms = fl.rooms;
    totalCheckedRooms += rooms.length;

    // 1. Boundary containment
    for (const r of rooms) {
      if (r.x < 0 || r.y < 0 || (r.x + r.width) > plotWidth + 0.1 || (r.y + r.length) > plotLength + 0.1) {
        issues.push({
          type: 'BOUNDARY_VIOLATION',
          message: `Room "${r.name}" (${r.id}) on Floor ${fl.level} extends beyond plot boundaries.`,
          roomId: r.id,
          level: fl.level,
        });
      }

      // Aspect ratio check
      const ratio = Math.max(r.width, r.length) / Math.min(r.width, r.length);
      if (ratio > 3.2 && r.type !== 'balcony' && r.type !== 'corridor') {
        issues.push({
          type: 'EXCESSIVE_ASPECT_RATIO',
          message: `Room "${r.name}" has an elongated aspect ratio of ${ratio.toFixed(1)}:1.`,
          roomId: r.id,
          level: fl.level,
        });
      }
    }

    // 2. Pairwise Overlap Check on the same floor
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const r1 = rooms[i];
        const r2 = rooms[j];

        const overlap = computeAABBOverlapArea(r1, r2);
        if (overlap > 0.05) {
          overlapCount++;
          issues.push({
            type: 'ROOM_OVERLAP',
            message: `Overlap between "${r1.name}" and "${r2.name}" on Floor ${fl.level}: ${overlap.toFixed(1)} sq ft.`,
            rooms: [r1.id, r2.id],
            level: fl.level,
          });
        }
      }
    }
  }

  // 3. Multi-Floor Vertical Stair Alignment Check
  if (floors.length > 1) {
    const gfStair = floors[0].rooms.find(r => r.type === 'staircase');
    const f1Stair = floors[1].rooms.find(r => r.type === 'staircase');
    if (gfStair && f1Stair) {
      const dx = Math.abs(gfStair.x - f1Stair.x);
      const dy = Math.abs(gfStair.y - f1Stair.y);
      if (dx > 0.05 || dy > 0.05) {
        issues.push({
          type: 'STAIR_MISALIGNMENT',
          message: `Vertical stair shafts do not align: Level 0 (${gfStair.x}, ${gfStair.y}) vs Level 1 (${f1Stair.x}, ${f1Stair.y}).`,
        });
      }
    }
  }

  return {
    isValid: issues.length === 0,
    totalRoomsChecked: totalCheckedRooms,
    overlapCount,
    issuesCount: issues.length,
    issues,
  };
}
