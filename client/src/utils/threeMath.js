/**
 * 3D Geometry & Math Transformation Helpers for ArchAI Three.js House Viewer
 *
 * Coordinate Convention:
 * - 1 Three.js world unit = 1 foot (1:1 architectural scaling)
 * - X-axis: Width (left-to-right), centered at plot center
 * - Z-axis: Length / Depth (front-to-back), centered at plot center
 * - Y-axis: Vertical elevation (height above ground)
 */

export const WORLD_SCALE = 1.0; // 1 Three.js unit = 1 foot
export const DEFAULT_WALL_HEIGHT = 8.5; // Standard 8.5 ft ceiling clearance
export const CUTAWAY_WALL_HEIGHT = 4.5; // 4.5 ft architectural dollhouse cutaway
export const WALL_THICKNESS = 0.5; // 6 inches = 0.5 ft wall thickness
export const SLAB_THICKNESS = 0.5; // 6 inches concrete slab
export const STORY_HEIGHT = 10.0; // 10 ft vertical floor-to-floor distance
export const DOOR_HEIGHT = 7.0; // 7 ft door clearance
export const WINDOW_HEIGHT = 4.0; // 4 ft window height
export const WINDOW_SILL_HEIGHT = 3.0; // 3 ft sill height above floor

/**
 * Converts 2D room position and dimensions (origin at top-left of plot)
 * into centered 3D coordinates (origin at center of plot footprint).
 */
export function convert2DTo3DCoords(x2d, y2d, width, length, plotWidth, plotLength) {
  const plotW = Number(plotWidth) || 30;
  const plotL = Number(plotLength) || 40;
  const w = Number(width) || 10;
  const l = Number(length) || 10;
  const x = Number(x2d) || 0;
  const y = Number(y2d) || 0;

  // Center of room in 2D
  const centerX = x + w / 2;
  const centerY = y + l / 2;

  // Center of room in 3D relative to plot center
  const x3d = Number((centerX - plotW / 2).toFixed(3));
  const z3d = Number((centerY - plotL / 2).toFixed(3));

  return {
    x: x3d,
    z: z3d,
    width: w,
    length: l,
  };
}

/**
 * Calculates base Y elevation for a floor level, supporting an exploded gap
 */
export function getFloorElevation(level, explodedGap = 0) {
  const lvl = Math.max(0, Number(level) || 0);
  const gap = Math.max(0, Number(explodedGap) || 0);
  return lvl * (STORY_HEIGHT + gap);
}

/**
 * Generates wall segment bounding boxes for a room in 3D
 * Returns four wall specifications: North, South, East, West
 */
export function generateRoomWallSegments(room, plotWidth, plotLength, wallHeight = DEFAULT_WALL_HEIGHT, wallThickness = WALL_THICKNESS) {
  const { x: cx, z: cz, width: w, length: l } = convert2DTo3DCoords(
    room.x,
    room.y,
    room.width,
    room.length,
    plotWidth,
    plotLength
  );

  const halfW = w / 2;
  const halfL = l / 2;
  const halfT = wallThickness / 2;

  return [
    // North Wall (back)
    {
      wall: 'north',
      x: cx,
      z: cz - halfL + halfT,
      width: w,
      length: wallThickness,
      height: wallHeight,
    },
    // South Wall (front)
    {
      wall: 'south',
      x: cx,
      z: cz + halfL - halfT,
      width: w,
      length: wallThickness,
      height: wallHeight,
    },
    // West Wall (left)
    {
      wall: 'west',
      x: cx - halfW + halfT,
      z: cz,
      width: wallThickness,
      length: l,
      height: wallHeight,
    },
    // East Wall (right)
    {
      wall: 'east',
      x: cx + halfW - halfT,
      z: cz,
      width: wallThickness,
      length: l,
      height: wallHeight,
    },
  ];
}

/**
 * Generates 3D step blocks for a staircase room connecting Level 0 to Level 1
 */
export function generateStairSteps(stairRoom, plotWidth, plotLength, stepCount = 12, storyHeight = STORY_HEIGHT) {
  if (!stairRoom) return [];

  const { x: cx, z: cz, width: w, length: l } = convert2DTo3DCoords(
    stairRoom.x,
    stairRoom.y,
    stairRoom.width,
    stairRoom.length,
    plotWidth,
    plotLength
  );

  const steps = [];
  const stepHeight = storyHeight / stepCount;
  const stepLength = l / stepCount;

  for (let i = 0; i < stepCount; i++) {
    const stepY = (i + 0.5) * stepHeight;
    // Step forward along length
    const stepZ = cz - l / 2 + (i + 0.5) * stepLength;

    steps.push({
      index: i + 1,
      x: cx,
      y: Number(stepY.toFixed(2)),
      z: Number(stepZ.toFixed(2)),
      width: Number((w * 0.9).toFixed(2)),
      length: Number((stepLength * 0.95).toFixed(2)),
      height: Number(stepHeight.toFixed(2)),
    });
  }

  return steps;
}

/**
 * Generates door and window 3D placement metadata
 */
export function generateOpeningPlacements(room, plotWidth, plotLength, baseY = 0) {
  const { x: cx, z: cz, width: w, length: l } = convert2DTo3DCoords(
    room.x,
    room.y,
    room.width,
    room.length,
    plotWidth,
    plotLength
  );

  const halfW = w / 2;
  const halfL = l / 2;
  const openings = [];

  // Doors
  if (Array.isArray(room.doors)) {
    for (const d of room.doors) {
      const doorW = Number(d.width) || 3.0;
      let dx = cx;
      let dz = cz + halfL; // default south
      let rot = 0;

      if (d.wall === 'north') {
        dz = cz - halfL;
      } else if (d.wall === 'east') {
        dx = cx + halfW;
        dz = cz;
        rot = Math.PI / 2;
      } else if (d.wall === 'west') {
        dx = cx - halfW;
        dz = cz;
        rot = Math.PI / 2;
      }

      openings.push({
        type: 'door',
        id: d.id || `door_${openings.length}`,
        x: dx,
        y: baseY + DOOR_HEIGHT / 2,
        z: dz,
        width: doorW,
        height: DOOR_HEIGHT,
        rotation: rot,
      });
    }
  }

  // Windows
  if (Array.isArray(room.windows)) {
    for (const win of room.windows) {
      const winW = Number(win.width) || 4.0;
      let wx = cx;
      let wz = cz - halfL; // default north
      let rot = 0;

      if (win.wall === 'south') {
        wz = cz + halfL;
      } else if (win.wall === 'east') {
        wx = cx + halfW;
        wz = cz;
        rot = Math.PI / 2;
      } else if (win.wall === 'west') {
        wx = cx - halfW;
        wz = cz;
        rot = Math.PI / 2;
      }

      openings.push({
        type: 'window',
        id: win.id || `win_${openings.length}`,
        x: wx,
        y: baseY + WINDOW_SILL_HEIGHT + WINDOW_HEIGHT / 2,
        z: wz,
        width: winW,
        height: WINDOW_HEIGHT,
        rotation: rot,
      });
    }
  }

  return openings;
}

/**
 * Architectural Materials & Color Palette
 */
export const ARCHITECTURAL_PALETTE = {
  wallPlaster: 0xf1f5f9,      // Clean off-white architectural plaster
  wallTopRim: 0x94a3b8,       // Subtle darker wall top edge
  slabGround: 0x182235,       // Ground floor structural slab
  slabUpper: 0x1e293b,        // Upper floor structural slab
  groundTerrain: 0x090d16,    // Dark architectural terrain
  gridLines: 0x27354f,        // Subtle architectural grid lines
  furnitureWood: 0xa16207,    // Warm architectural timber
  furnitureFabric: 0x475569,  // Modern charcoal/slate fabric
  furnitureWhite: 0xf8fafc,   // White linen / sanitary porcelain
  metalTrim: 0x64748b,        // Satin brushed aluminum/metal
  glassTranslucent: 0x38bdf8, // Pale architectural glass

  // Floor finishes by room type
  floors: {
    master_bedroom: 0xcbb59d, // Warm natural timber plank
    bedroom: 0xcbb59d,        // Warm natural timber plank
    living: 0xe2e8f0,         // Polished architectural terrazzo
    dining: 0xe2e8f0,         // Polished stone
    kitchen: 0x475569,        // Matte dark slate tile
    bathroom: 0x94a3b8,       // Ceramic tile
    parking: 0x334155,        // Vehicular paving stone
    balcony: 0x64748b,        // Exterior slate deck
    staircase: 0xcfd8dc,      // Stone treads
    foyer: 0xe2e8f0,          // Entry stone
    pooja: 0xfef08a,          // Warm sandstone
    utility: 0x94a3b8,        // Wash tile
    default: 0xdde3ea,
  }
};

/**
 * Generates rich architectural procedural furniture for a room.
 * Multi-component realistic models sized strictly within room boundaries.
 */
export function generateRoomFurniture(room, plotWidth, plotLength, baseY = 0) {
  const { x: cx, z: cz, width: w, length: l } = convert2DTo3DCoords(
    room.x,
    room.y,
    room.width,
    room.length,
    plotWidth,
    plotLength
  );

  const type = (room.type || '').toLowerCase();
  const name = (room.name || '').toLowerCase();
  const items = [];

  // =========================================================================
  // 1. BEDROOM: Platform Bed + Headboard + Pillows + Duvet + Nightstands + Lamps + Wardrobe
  // =========================================================================
  if (type.includes('bedroom') || name.includes('bed')) {
    const isMaster = type.includes('master') || name.includes('master');
    const bedW = isMaster ? Math.min(6.5, w - 2.0) : Math.min(5.2, w - 2.0);
    const bedL = Math.min(6.6, l - 2.0);
    const bedH = 1.5;
    const bedZ = cz - l / 2 + bedL / 2 + 1.2;

    // A. Bed Wooden Plinth Base / Frame
    items.push({
      name: 'bed_frame',
      type: 'box',
      x: cx,
      y: baseY + 0.25,
      z: bedZ,
      w: bedW + 0.3,
      l: bedL + 0.3,
      h: 0.5,
      color: 0x451a03,
      roughness: 0.6,
      metalness: 0.1
    });

    // B. Beveled Mattress (Required for existing tests)
    items.push({
      name: 'bed_mattress',
      type: 'box',
      x: cx,
      y: baseY + 0.5 + bedH / 2,
      z: bedZ,
      w: bedW,
      l: bedL,
      h: bedH,
      color: ARCHITECTURAL_PALETTE.furnitureWhite,
      metalness: 0.05,
      roughness: 0.85
    });

    // C. Architectural Headboard (Required for existing tests)
    items.push({
      name: 'bed_headboard',
      type: 'box',
      x: cx,
      y: baseY + 1.8,
      z: cz - l / 2 + 1.0,
      w: bedW + 0.4,
      l: 0.35,
      h: 3.4,
      color: ARCHITECTURAL_PALETTE.furnitureWood,
      metalness: 0.1,
      roughness: 0.5
    });

    // D. Soft Pillows (Left and Right, angled)
    const pillowW = bedW * 0.38;
    const pillowL = 1.4;
    [-1, 1].forEach((dir, i) => {
      items.push({
        name: `bed_pillow_${i === 0 ? 'left' : 'right'}`,
        type: 'box',
        x: cx + dir * (bedW * 0.24),
        y: baseY + 0.5 + bedH + 0.18,
        z: bedZ - bedL / 2 + 0.9,
        w: pillowW,
        l: pillowL,
        h: 0.35,
        color: 0xf1f5f9,
        roughness: 0.9,
        metalness: 0.0
      });
    });

    // E. Folded Duvet / Quilt Layer (Covers bottom 60% of mattress)
    items.push({
      name: 'bed_duvet',
      type: 'box',
      x: cx,
      y: baseY + 0.5 + bedH + 0.08,
      z: bedZ + bedL * 0.15,
      w: bedW + 0.08,
      l: bedL * 0.65,
      h: 0.22,
      color: 0x334155, // Slate blue designer quilt
      roughness: 0.9,
      metalness: 0.05
    });

    // F. Bedside Nightstands + Lamps
    if (w >= 10.5) {
      [-1, 1].forEach((dir, i) => {
        const nsX = cx + dir * (bedW / 2 + 1.15);
        const nsZ = cz - l / 2 + 1.6;

        items.push({
          name: 'nightstand',
          type: 'box',
          x: nsX,
          y: baseY + 0.75,
          z: nsZ,
          w: 1.6,
          l: 1.5,
          h: 1.5,
          color: ARCHITECTURAL_PALETTE.furnitureWood,
          metalness: 0.1,
          roughness: 0.6
        });

        // Nightstand Lamp (Stem + Shade)
        items.push({
          name: `lamp_shade_${i}`,
          type: 'box',
          x: nsX,
          y: baseY + 1.85,
          z: nsZ,
          w: 0.75,
          l: 0.75,
          h: 0.7,
          color: 0xfef08a,
          roughness: 0.4,
          metalness: 0.2
        });
      });
    }

    // G. Wardrobe Closet (if room depth allows)
    if (l >= 11 && w >= 11) {
      items.push({
        name: 'wardrobe_cabinet',
        type: 'box',
        x: cx + w / 2 - 1.2,
        y: baseY + 3.5,
        z: cz,
        w: 1.8,
        l: Math.min(l * 0.45, 6.0),
        h: 7.0,
        color: 0x292524,
        roughness: 0.5,
        metalness: 0.15
      });
    }
  }

  // =========================================================================
  // 2. LIVING ROOM: Plush Sofa + Coffee Table + Media Credenza + TV + Plant
  // =========================================================================
  else if (type.includes('living') || name.includes('living') || name.includes('hall')) {
    const sofaW = Math.min(w * 0.55, 7.5);
    const sofaZ = cz + l / 4;

    // A. Sofa Wooden Base Frame + Legs (Required for existing tests)
    items.push({
      name: 'sofa_base',
      type: 'box',
      x: cx,
      y: baseY + 0.8,
      z: sofaZ,
      w: sofaW,
      l: 2.8,
      h: 1.6,
      color: ARCHITECTURAL_PALETTE.furnitureFabric,
      metalness: 0.05,
      roughness: 0.9
    });

    // B. Sofa Plush Backrest (Required for existing tests)
    items.push({
      name: 'sofa_back',
      type: 'box',
      x: cx,
      y: baseY + 1.7,
      z: sofaZ + 1.1,
      w: sofaW,
      l: 0.6,
      h: 2.2,
      color: ARCHITECTURAL_PALETTE.furnitureFabric,
      metalness: 0.05,
      roughness: 0.9
    });

    // C. Individual Seat Cushions (3 cushions)
    const cushionW = (sofaW - 1.2) / 3;
    for (let c = 0; c < 3; c++) {
      items.push({
        name: `sofa_cushion_${c}`,
        type: 'box',
        x: cx - (sofaW - 1.2) / 2 + (c + 0.5) * cushionW,
        y: baseY + 1.1,
        z: sofaZ - 0.2,
        w: cushionW * 0.92,
        l: 2.0,
        h: 0.45,
        color: 0x334155,
        roughness: 0.95,
        metalness: 0.0
      });
    }

    // D. Left and Right Armrests
    [-1, 1].forEach((dir, i) => {
      items.push({
        name: `sofa_arm_${i === 0 ? 'left' : 'right'}`,
        type: 'box',
        x: cx + dir * (sofaW / 2 - 0.3),
        y: baseY + 1.35,
        z: sofaZ,
        w: 0.6,
        l: 2.8,
        h: 1.5,
        color: ARCHITECTURAL_PALETTE.furnitureFabric,
        roughness: 0.9,
        metalness: 0.05
      });
    });

    // E. Coffee Table (Required for existing tests)
    items.push({
      name: 'coffee_table',
      type: 'box',
      x: cx,
      y: baseY + 0.65,
      z: sofaZ - 2.6,
      w: 3.6,
      l: 2.2,
      h: 1.3,
      color: ARCHITECTURAL_PALETTE.furnitureWood,
      metalness: 0.1,
      roughness: 0.6
    });

    // Coffee table marble top slab
    items.push({
      name: 'coffee_table_top',
      type: 'box',
      x: cx,
      y: baseY + 1.35,
      z: sofaZ - 2.6,
      w: 3.8,
      l: 2.4,
      h: 0.12,
      color: 0xf1f5f9,
      metalness: 0.2,
      roughness: 0.3
    });

    // F. TV Media Credenza along North Wall
    const tvZ = cz - l / 2 + 1.1;
    items.push({
      name: 'tv_credenza',
      type: 'box',
      x: cx,
      y: baseY + 0.8,
      z: tvZ,
      w: Math.min(w * 0.45, 6.0),
      l: 1.3,
      h: 1.6,
      color: ARCHITECTURAL_PALETTE.furnitureWood,
      metalness: 0.1,
      roughness: 0.5
    });

    // TV Flat Screen
    items.push({
      name: 'tv_screen',
      type: 'box',
      x: cx,
      y: baseY + 2.7,
      z: tvZ,
      w: Math.min(w * 0.38, 4.8),
      l: 0.15,
      h: 2.5,
      color: 0x090d16,
      roughness: 0.2,
      metalness: 0.8
    });

    // Potted Floor Plant
    items.push({
      name: 'living_plant_pot',
      type: 'box',
      x: cx - w / 2 + 1.6,
      y: baseY + 0.7,
      z: tvZ,
      w: 1.2,
      l: 1.2,
      h: 1.4,
      color: 0xd97706,
      roughness: 0.8
    });
  }

  // =========================================================================
  // 3. DINING ROOM: Dining Table + 4 Chairs with Legs & Backrests
  // =========================================================================
  else if (type.includes('dining') || name.includes('dining')) {
    // A. Dining Table (Required for existing tests)
    items.push({
      name: 'dining_table',
      type: 'box',
      x: cx,
      y: baseY + 1.35,
      z: cz,
      w: 5.2,
      l: 3.4,
      h: 2.7,
      color: ARCHITECTURAL_PALETTE.furnitureWood,
      metalness: 0.1,
      roughness: 0.5
    });

    // B. Table Beveled Top Slab
    items.push({
      name: 'dining_table_top',
      type: 'box',
      x: cx,
      y: baseY + 2.75,
      z: cz,
      w: 5.4,
      l: 3.6,
      h: 0.15,
      color: 0x854d0e,
      roughness: 0.4,
      metalness: 0.1
    });

    // C. 4 Individual Dining Chairs (Required for existing tests)
    [
      { dx: -2.1, dz: -2.1 },
      { dx: 2.1, dz: -2.1 },
      { dx: -2.1, dz: 2.1 },
      { dx: 2.1, dz: 2.1 }
    ].forEach((chair, i) => {
      // Chair Seat Pad
      items.push({
        name: `chair_${i}`,
        type: 'box',
        x: cx + chair.dx,
        y: baseY + 0.9,
        z: cz + chair.dz,
        w: 1.5,
        l: 1.5,
        h: 1.8,
        color: ARCHITECTURAL_PALETTE.furnitureFabric,
        metalness: 0.05,
        roughness: 0.9
      });

      // Chair Backrest
      items.push({
        name: `chair_back_${i}`,
        type: 'box',
        x: cx + chair.dx,
        y: baseY + 2.1,
        z: cz + chair.dz + (chair.dz > 0 ? 0.6 : -0.6),
        w: 1.5,
        l: 0.2,
        h: 1.6,
        color: ARCHITECTURAL_PALETTE.furnitureWood,
        roughness: 0.6
      });
    });
  }

  // =========================================================================
  // 4. KITCHEN: Base Cabinets + Quartz Top + Sink + Chrome Faucet + Cooktop + Fridge
  // =========================================================================
  else if (type.includes('kitchen') || name.includes('kitchen')) {
    const counterW = Math.max(4.5, w - 2.0);
    const counterZ = cz - l / 2 + 1.2;

    // A. Main Base Cabinetry (Required for existing tests)
    items.push({
      name: 'kitchen_counter',
      type: 'box',
      x: cx,
      y: baseY + 1.4,
      z: counterZ,
      w: counterW,
      l: 2.1,
      h: 2.8,
      color: 0x1e293b, // Dark charcoal modular cabinet
      metalness: 0.2,
      roughness: 0.6
    });

    // B. Quartz / Granite Countertop Slab (Required for existing tests)
    items.push({
      name: 'kitchen_top',
      type: 'box',
      x: cx,
      y: baseY + 2.85,
      z: counterZ,
      w: counterW + 0.15,
      l: 2.25,
      h: 0.18,
      color: 0xf8fafc, // Polished white quartz
      metalness: 0.1,
      roughness: 0.25
    });

    // C. Undermount Stainless Steel Sink
    items.push({
      name: 'kitchen_sink',
      type: 'box',
      x: cx - counterW * 0.22,
      y: baseY + 2.88,
      z: counterZ,
      w: 1.8,
      l: 1.4,
      h: 0.08,
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3
    });

    // D. Chrome Goose-neck Faucet Spout
    items.push({
      name: 'kitchen_faucet',
      type: 'box',
      x: cx - counterW * 0.22,
      y: baseY + 3.3,
      z: counterZ - 0.5,
      w: 0.2,
      l: 0.4,
      h: 0.8,
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1
    });

    // E. 4-Burner Glass Cooktop
    items.push({
      name: 'kitchen_cooktop',
      type: 'box',
      x: cx + counterW * 0.22,
      y: baseY + 2.96,
      z: counterZ,
      w: 2.2,
      l: 1.6,
      h: 0.06,
      color: 0x090d16,
      metalness: 0.7,
      roughness: 0.2
    });

    // F. Refrigerator Appliance Tower
    items.push({
      name: 'refrigerator_tower',
      type: 'box',
      x: cx + counterW / 2 + 1.2,
      y: baseY + 3.4,
      z: counterZ,
      w: 2.2,
      l: 2.4,
      h: 6.8,
      color: 0xcbd5e1, // Satin stainless steel
      metalness: 0.75,
      roughness: 0.35
    });
  }

  // =========================================================================
  // 5. BATHROOM: Modern Porcelain Toilet Suite + Floating Vanity + LED Mirror + Glass Shower
  // =========================================================================
  else if (type.includes('bath') || name.includes('bath') || name.includes('toilet')) {
    // A. Vanity Sink Cabinet (Required for existing tests)
    items.push({
      name: 'vanity_sink',
      type: 'box',
      x: cx - w / 2 + 1.4,
      y: baseY + 1.3,
      z: cz,
      w: 1.8,
      l: 2.4,
      h: 2.6,
      color: ARCHITECTURAL_PALETTE.furnitureWood,
      metalness: 0.1,
      roughness: 0.5
    });

    // Ceramic Washbasin
    items.push({
      name: 'vanity_basin',
      type: 'box',
      x: cx - w / 2 + 1.4,
      y: baseY + 2.65,
      z: cz,
      w: 1.6,
      l: 1.8,
      h: 0.25,
      color: ARCHITECTURAL_PALETTE.furnitureWhite,
      metalness: 0.05,
      roughness: 0.2
    });

    // Backlit Vanity Mirror
    items.push({
      name: 'vanity_mirror',
      type: 'box',
      x: cx - w / 2 + 0.2,
      y: baseY + 4.2,
      z: cz,
      w: 0.1,
      l: 2.0,
      h: 2.5,
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1
    });

    // B. Porcelain Toilet Suite
    const toiletZ = cz - l / 2 + 1.2;
    // Toilet Pan Bowl
    items.push({
      name: 'toilet_bowl',
      type: 'box',
      x: cx,
      y: baseY + 0.8,
      z: toiletZ + 0.8,
      w: 1.3,
      l: 1.8,
      h: 1.5,
      color: ARCHITECTURAL_PALETTE.furnitureWhite,
      roughness: 0.2,
      metalness: 0.05
    });

    // Toilet Cistern Tank
    items.push({
      name: 'toilet_tank',
      type: 'box',
      x: cx,
      y: baseY + 1.8,
      z: toiletZ,
      w: 1.4,
      l: 0.7,
      h: 1.8,
      color: ARCHITECTURAL_PALETTE.furnitureWhite,
      roughness: 0.2,
      metalness: 0.05
    });

    // C. Shower Glass Partition (Required for existing tests)
    items.push({
      name: 'shower_screen',
      type: 'box',
      x: cx + w / 2 - 1.6,
      y: baseY + 2.5,
      z: cz,
      w: 0.1,
      l: 2.8,
      h: 5.0,
      color: ARCHITECTURAL_PALETTE.glassTranslucent,
      transparent: true,
      opacity: 0.45,
      metalness: 0.1,
      roughness: 0.1
    });

    // Shower Tray
    items.push({
      name: 'shower_tray',
      type: 'box',
      x: cx + w / 2 - 1.6,
      y: baseY + 0.1,
      z: cz,
      w: 2.6,
      l: 2.8,
      h: 0.2,
      color: 0xf1f5f9,
      roughness: 0.3
    });
  }

  // =========================================================================
  // 6. CAR PARKING: Painted Slot Lines + Wheel Stop + Architectural Vehicle
  // =========================================================================
  else if (type.includes('parking') || name.includes('parking') || name.includes('garage')) {
    const parkW = Math.min(w * 0.8, 9.0);
    const parkL = Math.min(l * 0.85, 16.0);

    // A. Left and Right White Parking Lines (Required for existing tests)
    [-1, 1].forEach((dir) => {
      items.push({
        name: 'park_line',
        type: 'box',
        x: cx + (dir * parkW) / 2,
        y: baseY + 0.42,
        z: cz,
        w: 0.35,
        l: parkL,
        h: 0.04,
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.5
      });
    });

    // B. Wheel Stop Block (Required for existing tests)
    items.push({
      name: 'wheel_stop',
      type: 'box',
      x: cx,
      y: baseY + 0.55,
      z: cz - parkL / 2 + 1.5,
      w: parkW * 0.7,
      l: 0.6,
      h: 0.35,
      color: 0xf59e0b, // High-visibility yellow
      metalness: 0.1,
      roughness: 0.7
    });

    // C. Architectural Contemporary Automobile (Sedan / SUV)
    const carW = Math.min(5.8, parkW - 1.2);
    const carL = Math.min(13.5, parkL - 2.0);
    const carBaseY = baseY + 0.45;

    // Car Lower Chassis
    items.push({
      name: 'car_chassis',
      type: 'box',
      x: cx,
      y: carBaseY + 1.1,
      z: cz + 0.5,
      w: carW,
      l: carL,
      h: 1.6,
      color: 0x1e3a8a, // Deep metallic sapphire blue
      metalness: 0.85,
      roughness: 0.25
    });

    // Car Passenger Cabin Greenhouse
    items.push({
      name: 'car_cabin',
      type: 'box',
      x: cx,
      y: carBaseY + 2.3,
      z: cz - 0.2,
      w: carW * 0.84,
      l: carL * 0.55,
      h: 1.35,
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.2
    });

    // Car Windshield Glass
    items.push({
      name: 'car_windshield',
      type: 'box',
      x: cx,
      y: carBaseY + 2.2,
      z: cz + carL * 0.28,
      w: carW * 0.82,
      l: 0.8,
      h: 1.1,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      metalness: 0.9,
      roughness: 0.1
    });

    // Car Dual Headlights
    [-1, 1].forEach((dir) => {
      items.push({
        name: `car_headlight_${dir}`,
        type: 'box',
        x: cx + dir * (carW * 0.38),
        y: carBaseY + 1.2,
        z: cz + carL / 2 + 0.52,
        w: 0.7,
        l: 0.1,
        h: 0.45,
        color: 0xffffff,
        metalness: 0.9,
        roughness: 0.1
      });
    });

    // Car Dual Taillights
    [-1, 1].forEach((dir) => {
      items.push({
        name: `car_taillight_${dir}`,
        type: 'box',
        x: cx + dir * (carW * 0.38),
        y: carBaseY + 1.2,
        z: cz - carL / 2 + 0.48,
        w: 0.7,
        l: 0.1,
        h: 0.45,
        color: 0xdc2626, // Ruby red
        metalness: 0.8,
        roughness: 0.2
      });
    });

    // 4 Wheels
    [
      { dx: -carW / 2 - 0.1, dz: carL * 0.3 },
      { dx: carW / 2 + 0.1, dz: carL * 0.3 },
      { dx: -carW / 2 - 0.1, dz: -carL * 0.3 },
      { dx: carW / 2 + 0.1, dz: -carL * 0.3 }
    ].forEach((wheel, i) => {
      items.push({
        name: `car_wheel_${i}`,
        type: 'box',
        x: cx + wheel.dx,
        y: carBaseY + 0.75,
        z: cz + wheel.dz + 0.5,
        w: 0.45,
        l: 1.5,
        h: 1.5,
        color: 0x111827, // Dark rubber
        metalness: 0.2,
        roughness: 0.8
      });
    });
  }

  // =========================================================================
  // 7. BALCONY: Perimeter Railing + Glass Balustrade
  // =========================================================================
  else if (type.includes('balcony') || name.includes('balcony')) {
    // Outer Top Handrail (Required for existing tests)
    items.push({
      name: 'balcony_rail',
      type: 'box',
      x: cx,
      y: baseY + 3.1,
      z: cz + l / 2 - 0.2,
      w: w,
      l: 0.2,
      h: 0.2,
      color: ARCHITECTURAL_PALETTE.metalTrim,
      metalness: 0.8,
      roughness: 0.3
    });

    // Glass Infill Balustrade
    items.push({
      name: 'balcony_glass',
      type: 'box',
      x: cx,
      y: baseY + 1.6,
      z: cz + l / 2 - 0.2,
      w: w - 0.2,
      l: 0.08,
      h: 2.8,
      color: ARCHITECTURAL_PALETTE.glassTranslucent,
      transparent: true,
      opacity: 0.55,
      metalness: 0.2,
      roughness: 0.1
    });
  }

  // =========================================================================
  // 8. BILLIARDS / POOL ROOM: Tournament Slate Table + Felt + Rails + Pockets + Balls + Cues
  // =========================================================================
  else if (type.includes('pool') || type.includes('billiard') || name.includes('pool') || name.includes('billiard')) {
    // Standard 8ft or 9ft pool table (8.5 x 4.5 ft)
    const tableW = Math.min(w - 4.0, 5.0);
    const tableL = Math.min(l - 4.0, 9.0);
    const tableH = 2.6;

    // A. Solid Wood Apron & Heavy Legs Frame
    items.push({
      name: 'pool_table_frame',
      type: 'box',
      x: cx,
      y: baseY + tableH * 0.45,
      z: cz,
      w: tableW,
      l: tableL,
      h: tableH * 0.9,
      color: 0x3f1d0b, // Rich mahogany / dark walnut
      roughness: 0.5,
      metalness: 0.15
    });

    // B. Vibrant Tournament Green Wool Felt Playing Surface
    items.push({
      name: 'pool_table_felt',
      type: 'box',
      x: cx,
      y: baseY + tableH + 0.05,
      z: cz,
      w: tableW - 0.7,
      l: tableL - 0.7,
      h: 0.1,
      color: 0x15803d, // Classic tournament green felt
      roughness: 0.95,
      metalness: 0.0
    });

    // C. Raised Mahogany Cushioned Rail Perimeter (Bumpers)
    // Left & Right rails
    [-1, 1].forEach((dir, i) => {
      items.push({
        name: `pool_rail_side_${i}`,
        type: 'box',
        x: cx + dir * (tableW / 2 - 0.2),
        y: baseY + tableH + 0.15,
        z: cz,
        w: 0.4,
        l: tableL,
        h: 0.22,
        color: 0x271307,
        roughness: 0.4,
        metalness: 0.2
      });
    });
    // Top & Bottom rails
    [-1, 1].forEach((dir, i) => {
      items.push({
        name: `pool_rail_end_${i}`,
        type: 'box',
        x: cx,
        y: baseY + tableH + 0.15,
        z: cz + dir * (tableL / 2 - 0.2),
        w: tableW,
        l: 0.4,
        h: 0.22,
        color: 0x271307,
        roughness: 0.4,
        metalness: 0.2
      });
    });

    // D. 6 Corner and Side Pockets (Dark chrome / leather pocket castings)
    [
      { dx: -(tableW / 2 - 0.25), dz: -(tableL / 2 - 0.25) },
      { dx: (tableW / 2 - 0.25), dz: -(tableL / 2 - 0.25) },
      { dx: -(tableW / 2 - 0.25), dz: 0 },
      { dx: (tableW / 2 - 0.25), dz: 0 },
      { dx: -(tableW / 2 - 0.25), dz: (tableL / 2 - 0.25) },
      { dx: (tableW / 2 - 0.25), dz: (tableL / 2 - 0.25) }
    ].forEach((pocket, i) => {
      items.push({
        name: `pool_pocket_${i}`,
        type: 'box',
        x: cx + pocket.dx,
        y: baseY + tableH + 0.18,
        z: cz + pocket.dz,
        w: 0.42,
        l: 0.42,
        h: 0.26,
        color: 0x1c1917,
        roughness: 0.3,
        metalness: 0.7
      });
    });

    // E. Billiard Cue Ball & Racked Balls cluster on the felt
    items.push({
      name: 'billiard_balls_cluster',
      type: 'box',
      x: cx,
      y: baseY + tableH + 0.18,
      z: cz - tableL * 0.2,
      w: 0.8,
      l: 0.9,
      h: 0.18,
      color: 0xd97706, // Golden yellow racked balls
      roughness: 0.2,
      metalness: 0.8
    });
    items.push({
      name: 'billiard_cue_ball',
      type: 'box',
      x: cx,
      y: baseY + tableH + 0.18,
      z: cz + tableL * 0.25,
      w: 0.25,
      l: 0.25,
      h: 0.18,
      color: 0xffffff, // White cue ball
      roughness: 0.15,
      metalness: 0.9
    });

    // F. Wall-Mounted Cue Rack & Player Cues along side wall
    const rackX = cx - w / 2 + 0.4;
    items.push({
      name: 'cue_rack_stand',
      type: 'box',
      x: rackX,
      y: baseY + 3.2,
      z: cz,
      w: 0.3,
      l: 2.5,
      h: 4.5,
      color: 0x451a03,
      roughness: 0.5,
      metalness: 0.1
    });

    // G. High Spectator Bench / Lounge Stool
    if (w >= 14) {
      items.push({
        name: 'spectator_bench',
        type: 'box',
        x: cx + w / 2 - 1.2,
        y: baseY + 1.6,
        z: cz,
        w: 1.6,
        l: 4.8,
        h: 2.2,
        color: 0x1e293b,
        roughness: 0.8,
        metalness: 0.2
      });
    }
  }

  // =========================================================================
  // 9. ENTERTAINMENT / MEDIA ROOM: Cinema Screen + Backlight + Sectional + Audio Towers
  // =========================================================================
  else if (type.includes('entertainment') || type.includes('media') || name.includes('entertainment') || name.includes('media') || name.includes('theatre')) {
    // A. Large Projection Display / 85" Television on North Wall
    const tvZ = cz - l / 2 + 0.4;
    items.push({
      name: 'cinema_screen_panel',
      type: 'box',
      x: cx,
      y: baseY + 4.2,
      z: tvZ,
      w: Math.min(w * 0.72, 8.5),
      l: 0.2,
      h: 4.2,
      color: 0x020617, // Pitch black screen surface
      roughness: 0.15,
      metalness: 0.9
    });

    // Ambient backlighting glow panel behind screen
    items.push({
      name: 'cinema_screen_backlight',
      type: 'box',
      x: cx,
      y: baseY + 4.2,
      z: tvZ - 0.1,
      w: Math.min(w * 0.72, 8.5) + 0.4,
      l: 0.08,
      h: 4.5,
      color: 0x0284c7, // Cool cyan ambient architectural glow
      roughness: 0.3,
      metalness: 0.5
    });

    // B. Sleek Floating Media Credenza with Audiophile Equipment
    items.push({
      name: 'media_credenza',
      type: 'box',
      x: cx,
      y: baseY + 0.9,
      z: tvZ + 0.8,
      w: Math.min(w * 0.65, 7.5),
      l: 1.5,
      h: 1.6,
      color: 0x18181b, // Dark matte finish
      roughness: 0.4,
      metalness: 0.3
    });

    // C. Dual Audiophile Acoustic Tower Speakers
    [-1, 1].forEach((dir, i) => {
      items.push({
        name: `sound_tower_${i}`,
        type: 'box',
        x: cx + dir * (Math.min(w * 0.72, 8.5) / 2 + 0.8),
        y: baseY + 2.2,
        z: tvZ + 0.6,
        w: 1.0,
        l: 1.1,
        h: 4.2,
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.7
      });
    });

    // D. Plush Deep Sectional Lounge Sofa
    const sofaZ = cz + l / 4;
    const sofaW = Math.min(w * 0.75, 9.0);
    items.push({
      name: 'entertainment_sectional_sofa',
      type: 'box',
      x: cx,
      y: baseY + 0.85,
      z: sofaZ,
      w: sofaW,
      l: 3.4,
      h: 1.7,
      color: 0x334155, // Charcoal / slate plush fabric
      roughness: 0.95,
      metalness: 0.05
    });

    // Sectional Plush Backrest
    items.push({
      name: 'entertainment_sofa_back',
      type: 'box',
      x: cx,
      y: baseY + 1.8,
      z: sofaZ + 1.3,
      w: sofaW,
      l: 0.8,
      h: 2.2,
      color: 0x334155,
      roughness: 0.95,
      metalness: 0.05
    });

    // E. Modern Low Coffee Table
    items.push({
      name: 'entertainment_coffee_table',
      type: 'box',
      x: cx,
      y: baseY + 0.6,
      z: sofaZ - 2.8,
      w: 4.2,
      l: 2.4,
      h: 1.2,
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.5
    });
  }

  return items;
}

/**
 * Calculates smart 3D room label positioning, scaling, and anti-overlap vertical staggering
 */
export function calculateLabelSpecs(room, plotWidth, plotLength, wallHeight = DEFAULT_WALL_HEIGHT, baseY = 0, index = 0) {
  const { x: cx, z: cz, width: w, length: l } = convert2DTo3DCoords(
    room.x,
    room.y,
    room.width,
    room.length,
    plotWidth,
    plotLength
  );

  const minDim = Math.min(w, l);
  const isSmallRoom = minDim < 8.0;

  // Scale label card proportional to room size (compact for small rooms, bounded for large ones)
  const scaleX = Number(Math.min(Math.max(w * 0.38, 2.4), 4.8).toFixed(2));
  const scaleY = Number((scaleX * 0.48).toFixed(2));

  // Stagger Y elevation slightly (0.4 ft intervals) to prevent adjacent room label collisions
  const staggerY = (index % 3) * 0.45;
  const posY = Number((baseY + wallHeight + 1.0 + staggerY).toFixed(2));

  return {
    x: cx,
    y: posY,
    z: cz,
    scaleX,
    scaleY,
    isSmallRoom,
    roomArea: Math.round(w * l)
  };
}

/**
 * Quality Performance Presets
 */
export const QUALITY_PRESETS = {
  performance: {
    id: 'performance',
    name: 'Performance',
    shadowMapSize: 1024,
    pixelRatioMax: 1.0,
    antialias: false,
    pcfSoft: false,
    maxPointLights: 3,
    description: 'Fastest frame rate for laptops & battery saving'
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    shadowMapSize: 2048,
    pixelRatioMax: 1.5,
    antialias: true,
    pcfSoft: true,
    maxPointLights: 8,
    description: 'Optimal balance of visual fidelity and smooth 60 FPS'
  },
  high: {
    id: 'high',
    name: 'High Quality',
    shadowMapSize: 4096,
    pixelRatioMax: 2.0,
    antialias: true,
    pcfSoft: true,
    maxPointLights: 16,
    description: 'Maximum resolution, crisp contact shadows, and glass refractions'
  }
};

/**
 * The 7 Architectural Viewing Modes
 */
export const VIEWING_MODES = [
  { id: 'all', name: 'Full Building', desc: 'All floors assembled' },
  { id: 'ground', name: 'Ground Floor Only', desc: 'Isolates Level 0 with open top' },
  { id: 'first', name: 'First Floor Only', desc: 'Isolates Level 1 at ground height' },
  { id: 'cutaway', name: 'Interior Cutaway', desc: '4.5 ft dollhouse cutaway walls' },
  { id: 'exploded', name: 'Exploded Floors', desc: 'Separates floors vertically with guides' },
  { id: 'topdown', name: 'Top-Down Plan', desc: 'Orthogonal 3D architectural plan' },
  { id: 'exterior', name: 'Exterior View', desc: 'Full height walls with facade & parapet' },
];

/**
 * Calculates optimal camera framing distance and target based on active plot dimensions & mode
 */
export function calculateOptimalCameraPosition(
  plotWidth = 30,
  plotLength = 40,
  floorMode = 'all',
  explodedGap = 6,
  preset = 'iso',
  facing = 'South'
) {
  const w = Number(plotWidth) || 30;
  const l = Number(plotLength) || 40;

  let totalHeight = STORY_HEIGHT;
  if (floorMode === 'all' || floorMode === 'exterior') {
    totalHeight = STORY_HEIGHT * 2;
  } else if (floorMode === 'exploded') {
    totalHeight = STORY_HEIGHT * 2 + explodedGap;
  } else if (floorMode === 'ground' || floorMode === 'first') {
    totalHeight = STORY_HEIGHT;
  }

  const centerY = totalHeight / 2;
  const target = { x: 0, y: Number(centerY.toFixed(1)), z: 0 };

  // Calculate bounding sphere radius
  const radius = Math.sqrt(Math.pow(w / 2, 2) + Math.pow(l / 2, 2) + Math.pow(totalHeight / 2, 2));
  const dist = radius * 1.75;

  let position = { x: dist * 0.75, y: centerY + dist * 0.55, z: dist * 0.8 };

  if (preset === 'top' || floorMode === 'topdown') {
    position = { x: 0, y: centerY + dist * 1.55, z: 0.001 };
  } else if (preset === 'front') {
    const fLower = String(facing).toLowerCase();
    if (fLower.includes('east')) {
      position = { x: dist * 1.25, y: centerY + dist * 0.25, z: 0.001 };
    } else if (fLower.includes('west')) {
      position = { x: -dist * 1.25, y: centerY + dist * 0.25, z: 0.001 };
    } else if (fLower.includes('north')) {
      position = { x: 0.001, y: centerY + dist * 0.25, z: -dist * 1.25 };
    } else {
      // South or default front approach
      position = { x: 0.001, y: centerY + dist * 0.25, z: dist * 1.25 };
    }
  } else if (preset === 'frame') {
    position = { x: dist * 0.8, y: centerY + dist * 0.65, z: dist * 0.85 };
  } else if (preset === 'exterior' || floorMode === 'exterior') {
    position = { x: dist * 0.85, y: totalHeight * 0.45 + dist * 0.25, z: dist * 1.15 };
  }

  return {
    position: {
      x: Number(position.x.toFixed(1)),
      y: Number(position.y.toFixed(1)),
      z: Number(position.z.toFixed(1))
    },
    target,
    radius: Number(radius.toFixed(1))
  };
}

/**
 * Cinematic Lighting Presets
 */
export const LIGHTING_PRESETS = {
  warm_daylight: {
    id: 'warm_daylight',
    name: 'Warm Daylight',
    background: '#070b13',
    fogColor: '#070b13',
    fogDensity: 0.005,
    sunColor: 0xfffbeb,
    sunIntensity: 1.5,
    sunPosition: [35, 55, 40],
    ambientColor: 0xffffff,
    ambientIntensity: 0.85,
    hemiSky: 0x38bdf8,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.45,
    exposure: 1.05,
    interiorLights: false,
  },
  neutral_daylight: {
    id: 'neutral_daylight',
    name: 'Neutral Studio',
    background: '#090d16',
    fogColor: '#090d16',
    fogDensity: 0.005,
    sunColor: 0xffffff,
    sunIntensity: 1.35,
    sunPosition: [25, 60, 25],
    ambientColor: 0xf8fafc,
    ambientIntensity: 0.95,
    hemiSky: 0xe2e8f0,
    hemiGround: 0x334155,
    hemiIntensity: 0.4,
    exposure: 1.0,
    interiorLights: false,
  },
  golden_hour: {
    id: 'golden_hour',
    name: 'Golden Hour (Sunset)',
    background: '#120d1c',
    fogColor: '#120d1c',
    fogDensity: 0.006,
    sunColor: 0xfb923c,
    sunIntensity: 1.85,
    sunPosition: [55, 24, 30],
    ambientColor: 0xfde047,
    ambientIntensity: 0.65,
    hemiSky: 0xc084fc,
    hemiGround: 0x1e1b4b,
    hemiIntensity: 0.5,
    exposure: 1.15,
    interiorLights: true,
  },
  evening_dusk: {
    id: 'evening_dusk',
    name: 'Dusk Twilight',
    background: '#050714',
    fogColor: '#050714',
    fogDensity: 0.007,
    sunColor: 0x818cf8,
    sunIntensity: 0.65,
    sunPosition: [-30, 20, -35],
    ambientColor: 0x312e81,
    ambientIntensity: 0.5,
    hemiSky: 0x4338ca,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.35,
    exposure: 1.25,
    interiorLights: true,
  },
  night_interior: {
    id: 'night_interior',
    name: 'Night Architecture',
    background: '#030509',
    fogColor: '#030509',
    fogDensity: 0.008,
    sunColor: 0x1e293b,
    sunIntensity: 0.25,
    sunPosition: [10, 40, 10],
    ambientColor: 0x0f172a,
    ambientIntensity: 0.35,
    hemiSky: 0x1e1b4b,
    hemiGround: 0x020617,
    hemiIntensity: 0.2,
    exposure: 1.35,
    interiorLights: true,
  },
};

/**
 * Architectural Material Styles & Finishes
 */
export const MATERIAL_STYLES = {
  modern_scandi: {
    id: 'modern_scandi',
    name: 'Scandinavian Contemporary',
    wallColor: 0xf8fafc,
    wallRoughness: 0.65,
    bedroomFloor: 0xd7c4b7,
    livingFloor: 0xe2e8f0,
    kitchenFloor: 0x334155,
    bathFloor: 0x94a3b8,
    woodTrim: 0xa16207,
    metalTrim: 0x475569,
  },
  warm_japandi: {
    id: 'warm_japandi',
    name: 'Warm Japandi Wood',
    wallColor: 0xf1f0ea,
    wallRoughness: 0.8,
    bedroomFloor: 0xb48a58,
    livingFloor: 0xddcbaf,
    kitchenFloor: 0x524636,
    bathFloor: 0xb8a898,
    woodTrim: 0x854d0e,
    metalTrim: 0x292524,
  },
  luxury_marble: {
    id: 'luxury_marble',
    name: 'Luxury Stone & Walnut',
    wallColor: 0xffffff,
    wallRoughness: 0.5,
    bedroomFloor: 0x6b4423,
    livingFloor: 0xf1f5f9,
    kitchenFloor: 0x1e293b,
    bathFloor: 0xe2e8f0,
    woodTrim: 0x451a03,
    metalTrim: 0xd97706,
  },
  industrial_loft: {
    id: 'industrial_loft',
    name: 'Industrial Concrete',
    wallColor: 0xe2e8f0,
    wallRoughness: 0.85,
    bedroomFloor: 0x78716c,
    livingFloor: 0x94a3b8,
    kitchenFloor: 0x1e293b,
    bathFloor: 0x64748b,
    woodTrim: 0x57534e,
    metalTrim: 0x0f172a,
  },
};

/**
 * Generates an ordered sequence of walkthrough tour waypoints
 * Visiting each room at human eye level (5.5 ft above floor)
 */
export function generateWalkthroughWaypoints(rooms = [], plotWidth = 30, plotLength = 40) {
  if (!rooms || rooms.length === 0) return [];

  // Sort rooms logically: Level 0 entries/public first, then stairs, then Level 1 private
  const sorted = [...rooms].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const priority = {
      foyer: 1,
      parking: 2,
      living: 3,
      dining: 4,
      kitchen: 5,
      staircase: 6,
      master_bedroom: 7,
      bedroom: 8,
      balcony: 9,
      bathroom: 10,
    };
    return (priority[a.type] || 50) - (priority[b.type] || 50);
  });

  return sorted.map((room, idx) => {
    const coords = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
    const floorY = getFloorElevation(room.level, 0);
    const eyeLevelY = Number((floorY + 5.5).toFixed(2));

    // Stand slightly offset from center towards entrance
    const camX = Number((coords.x).toFixed(2));
    const camZ = Number((coords.z + room.length * 0.22).toFixed(2));

    // Look towards the center of room
    const targetX = Number((coords.x).toFixed(2));
    const targetY = Number((floorY + 4.8).toFixed(2));
    const targetZ = Number((coords.z - room.length * 0.25).toFixed(2));

    return {
      index: idx,
      id: room.id,
      name: room.name,
      type: room.type,
      zone: room.zone || 'public',
      level: room.level,
      dimensions: `${room.width} × ${room.length} ft`,
      area: Math.round(room.width * room.length),
      cameraPosition: { x: camX, y: eyeLevelY, z: camZ },
      targetPosition: { x: targetX, y: targetY, z: targetZ }
    };
  });
}

/**
 * Calculates deterministic reveal animation parameters based on playback progress (0.0 to 1.0)
 */
export function calculateRevealState(progress = 0) {
  const p = Math.max(0, Math.min(1.0, progress));

  // Stage 1: Ground Slab (0.0 to 0.2)
  const slabProgress = Math.min(1.0, p / 0.2);
  const groundSlabY = slabProgress < 1.0 ? -8.0 * (1.0 - slabProgress) : 0;

  // Stage 2: Level 0 Walls Scale (0.2 to 0.42)
  const l0WallProgress = p < 0.2 ? 0 : Math.min(1.0, (p - 0.2) / 0.22);

  // Stage 3: Level 0 Furniture & Interior (0.42 to 0.58)
  const l0FurnitureProgress = p < 0.42 ? 0 : Math.min(1.0, (p - 0.42) / 0.16);

  // Stage 4: Level 1 Structure & Walls (0.58 to 0.82)
  const l1StructureProgress = p < 0.58 ? 0 : Math.min(1.0, (p - 0.58) / 0.24);

  // Stage 5: Final Settle Camera Orbit Angle (0.0 to 1.0)
  const cameraOrbitAngle = (1.0 - p) * 0.5;

  return {
    progress: p,
    isComplete: p >= 1.0,
    groundSlabY,
    l0WallScale: Number(l0WallProgress.toFixed(3)),
    l0FurnitureOpacity: Number(l0FurnitureProgress.toFixed(3)),
    l1StructureProgress: Number(l1StructureProgress.toFixed(3)),
    cameraOrbitAngle: Number(cameraOrbitAngle.toFixed(3))
  };
}


