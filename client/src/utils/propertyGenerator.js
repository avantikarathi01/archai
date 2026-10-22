/**
 * ArchAI Phase 6 — Complete Property & Exterior Generator
 *
 * Generates a complete, coherent architectural site around the house:
 * - Perimeter boundary compound walls with top coping
 * - Main vehicular entrance gate and pedestrian wicket gate
 * - Sturdy masonry gate pillars with illuminated lanterns
 * - Paved driveway connecting to parking and entrance
 * - Pedestrian entrance walkway with bollard lights
 * - Lush garden lawns with procedural architectural trees and boxwood hedges
 * - Raised entrance plinth steps and cantilevered porch canopy with recessed spotlights
 * - Accessible roof terrace with perimeter safety parapet / railing
 * - Dynamic collision box specifications for first-person physical simulation
 */

import { convert2DTo3DCoords, getFloorElevation, STORY_HEIGHT, WALL_THICKNESS } from './threeMath.js';
import { getDesignConcept } from './designConcepts.js';

export const PROPERTY_DEFAULTS = {
  frontSetback: 16.0, // 16 ft front yard/driveway
  rearSetback: 7.0,   // 7 ft rear garden
  sideSetback: 5.5,   // 5.5 ft left and right setback
  boundaryWallHeight: 6.0,
  boundaryWallThickness: 0.8,
  copingHeight: 0.35,
  gatePillarWidth: 2.2,
  gatePillarHeight: 7.2,
  vehicularGateWidth: 12.0,
  pedestrianGateWidth: 3.5,
  treeHeight: 12.0,
  porchCanopyDepth: 6.0,
  porchCanopyHeight: 9.8,
  terraceParapetHeight: 3.5
};

/**
 * Calculates complete property site dimensions and offsets based on plot footprint
 */
export function calculateSiteBounds(plotWidth, plotLength, facing = 'East') {
  const plotW = Number(plotWidth) || 30;
  const plotL = Number(plotLength) || 40;

  const frontSB = PROPERTY_DEFAULTS.frontSetback;
  const rearSB = PROPERTY_DEFAULTS.rearSetback;
  const sideSB = PROPERTY_DEFAULTS.sideSetback;

  const siteWidth = plotW + sideSB * 2;
  const siteLength = plotL + frontSB + rearSB;

  const isNorth = String(facing).toLowerCase().includes('north');

  let siteMinZ, siteMaxZ, siteCenterZ;
  if (isNorth) {
    // Front setback is located along North (-Z), rear setback is along South (+Z)
    siteMinZ = -plotL / 2 - frontSB;
    siteMaxZ = plotL / 2 + rearSB;
    siteCenterZ = (-frontSB + rearSB) / 2;
  } else {
    // Default / South facing: front setback along South (+Z), rear along North (-Z)
    siteMinZ = -plotL / 2 - rearSB;
    siteMaxZ = plotL / 2 + frontSB;
    siteCenterZ = (frontSB - rearSB) / 2;
  }

  const siteMinX = -plotW / 2 - sideSB;
  const siteMaxX = plotW / 2 + sideSB;

  return {
    siteWidth,
    siteLength,
    siteCenterZ,
    siteMinX,
    siteMaxX,
    siteMinZ,
    siteMaxZ,
    plotW,
    plotL,
    frontSB,
    rearSB,
    sideSB,
    isNorth
  };
}

/**
 * Checks if a 3D coordinate point collides with or falls inside any ground-floor room
 */
export function isTreeCollidingWithRooms(tx, tz, groundRooms, plotW, plotL, clearance = 3.5) {
  for (const r of groundRooms) {
    const r3d = convert2DTo3DCoords(r.x, r.y, r.width, r.length, plotW, plotL);
    const minX = r3d.x - r3d.width / 2 - clearance;
    const maxX = r3d.x + r3d.width / 2 + clearance;
    const minZ = r3d.z - r3d.length / 2 - clearance;
    const maxZ = r3d.z + r3d.length / 2 + clearance;
    if (tx >= minX && tx <= maxX && tz >= minZ && tz <= maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Generates property metadata including boundary walls, gates, pillars, landscaping, and collision boxes
 */
export function generatePropertySite(plotWidth, plotLength, rooms = [], facing = 'East', conceptId = 'contemporary_minimalist') {
  const bounds = calculateSiteBounds(plotWidth, plotLength, facing);
  const concept = getDesignConcept(conceptId);

  const {
    siteWidth,
    siteLength,
    siteCenterZ,
    siteMinX,
    siteMaxX,
    siteMinZ,
    siteMaxZ,
    plotW,
    plotL,
    isNorth
  } = bounds;

  const wallH = PROPERTY_DEFAULTS.boundaryWallHeight;
  const wallT = PROPERTY_DEFAULTS.boundaryWallThickness;
  const pillarW = PROPERTY_DEFAULTS.gatePillarWidth;
  const pillarH = PROPERTY_DEFAULTS.gatePillarHeight;
  const vehGateW = PROPERTY_DEFAULTS.vehicularGateWidth;
  const pedGateW = PROPERTY_DEFAULTS.pedestrianGateWidth;

  const collisionBoxes = [];

  // Front boundary coordinate Z where gates and entry occur
  const frontZ = isNorth ? siteMinZ : siteMaxZ;
  const rearZ = isNorth ? siteMaxZ : siteMinZ;

  // 1. Gate Positions along the front boundary (aligned to Car Parking on left and Entrance on right)
  const vehGateCenterX = -siteWidth * 0.22;
  const pedGateCenterX = siteWidth * 0.26;

  const vehGateLeft = vehGateCenterX - vehGateW / 2;
  const vehGateRight = vehGateCenterX + vehGateW / 2;
  const pedGateLeft = pedGateCenterX - pedGateW / 2;
  const pedGateRight = pedGateCenterX + pedGateW / 2;

  // 2. Gate Pillars flanking gates along front boundary
  const pillars = [
    { id: 'pillar_veh_l', x: vehGateLeft - pillarW / 2, y: pillarH / 2, z: frontZ, width: pillarW, height: pillarH, length: pillarW },
    { id: 'pillar_veh_r', x: vehGateRight + pillarW / 2, y: pillarH / 2, z: frontZ, width: pillarW, height: pillarH, length: pillarW },
    { id: 'pillar_ped_l', x: pedGateLeft - pillarW / 2, y: pillarH / 2, z: frontZ, width: pillarW, height: pillarH, length: pillarW },
    { id: 'pillar_ped_r', x: pedGateRight + pillarW / 2, y: pillarH / 2, z: frontZ, width: pillarW, height: pillarH, length: pillarW },
  ];

  pillars.forEach(p => {
    collisionBoxes.push({
      id: p.id,
      type: 'pillar',
      minX: p.x - p.width / 2,
      maxX: p.x + p.width / 2,
      minZ: p.z - p.length / 2,
      maxZ: p.z + p.length / 2,
      minY: 0,
      maxY: p.height
    });
  });

  // 3. Boundary Walls
  const boundaryWalls = [
    // Solid Rear Wall (opposite front gate)
    {
      id: 'boundary_rear',
      x: 0,
      y: wallH / 2,
      z: isNorth ? (siteMaxZ - wallT / 2) : (siteMinZ + wallT / 2),
      width: siteWidth,
      height: wallH,
      length: wallT
    },
    // Left Wall (West, siteMinX)
    {
      id: 'boundary_left',
      x: siteMinX + wallT / 2,
      y: wallH / 2,
      z: siteCenterZ,
      width: wallT,
      height: wallH,
      length: siteLength
    },
    // Right Wall (East, siteMaxX)
    {
      id: 'boundary_right',
      x: siteMaxX - wallT / 2,
      y: wallH / 2,
      z: siteCenterZ,
      width: wallT,
      height: wallH,
      length: siteLength
    },
    // Front Wall Left Segment
    {
      id: 'boundary_front_left',
      x: (siteMinX + (vehGateLeft - pillarW)) / 2,
      y: wallH / 2,
      z: isNorth ? (siteMinZ + wallT / 2) : (siteMaxZ - wallT / 2),
      width: Math.max(0.5, (vehGateLeft - pillarW) - siteMinX),
      height: wallH,
      length: wallT
    },
    // Front Wall Center Segment (between vehicular and pedestrian gates)
    {
      id: 'boundary_front_center',
      x: ((vehGateRight + pillarW) + (pedGateLeft - pillarW)) / 2,
      y: wallH / 2,
      z: isNorth ? (siteMinZ + wallT / 2) : (siteMaxZ - wallT / 2),
      width: Math.max(0.5, (pedGateLeft - pillarW) - (vehGateRight + pillarW)),
      height: wallH,
      length: wallT
    },
    // Front Wall Right Segment
    {
      id: 'boundary_front_right',
      x: ((pedGateRight + pillarW) + siteMaxX) / 2,
      y: wallH / 2,
      z: isNorth ? (siteMinZ + wallT / 2) : (siteMaxZ - wallT / 2),
      width: Math.max(0.5, siteMaxX - (pedGateRight + pillarW)),
      height: wallH,
      length: wallT
    }
  ];

  boundaryWalls.forEach(bw => {
    if (bw.width > 0.5) {
      collisionBoxes.push({
        id: bw.id,
        type: 'boundary_wall',
        minX: bw.x - bw.width / 2,
        maxX: bw.x + bw.width / 2,
        minZ: bw.z - bw.length / 2,
        maxZ: bw.z + bw.length / 2,
        minY: 0,
        maxY: bw.height
      });
    }
  });

  // 4. Interactive Property Gates
  const gates = [
    {
      id: 'gate_vehicular',
      type: 'vehicular_gate',
      name: 'Main Vehicular Gate',
      x: vehGateCenterX,
      y: 2.9,
      z: frontZ,
      width: vehGateW,
      height: 5.8,
      thickness: 0.25,
      isOpen: false,
      hingeLeftX: vehGateLeft,
      hingeRightX: vehGateRight
    },
    {
      id: 'gate_pedestrian',
      type: 'pedestrian_gate',
      name: 'Pedestrian Entrance Gate',
      x: pedGateCenterX,
      y: 2.9,
      z: frontZ,
      width: pedGateW,
      height: 5.8,
      thickness: 0.2,
      isOpen: false,
      hingeX: pedGateLeft
    }
  ];

  // 5. Paved Driveway and Walkway connecting from front gates to house entrance
  const drivewayZ = isNorth ? (siteMinZ - plotL / 2) / 2 : (siteMaxZ + plotL / 2) / 2;
  const driveway = {
    x: vehGateCenterX,
    y: 0.02,
    z: drivewayZ,
    width: vehGateW + 1.5,
    length: bounds.frontSB + 2.0
  };

  const walkwayZ = isNorth ? (siteMinZ - plotL / 2) / 2 : (siteMaxZ + plotL / 2) / 2;
  const walkway = {
    x: pedGateCenterX,
    y: 0.025,
    z: walkwayZ,
    width: pedGateW + 1.2,
    length: bounds.frontSB + 2.0
  };

  // 6. Garden Lawns (surrounding the building footprint)
  const frontLawnZ = isNorth ? (siteMinZ - plotL / 2) / 2 : (siteMaxZ + plotL / 2) / 2;
  const rearLawnZ = isNorth ? (plotL / 2 + siteMaxZ) / 2 : (-plotL / 2 + siteMinZ) / 2;

  const lawns = [
    // Front Lawn Strip
    {
      x: (vehGateCenterX + vehGateW / 2 + pedGateCenterX - pedGateW / 2) / 2,
      y: 0.01,
      z: frontLawnZ,
      width: Math.max(1, (pedGateCenterX - pedGateW / 2) - (vehGateCenterX + vehGateW / 2) - 0.8),
      length: bounds.frontSB
    },
    // Left Garden Strip
    {
      x: (siteMinX + (-plotW / 2)) / 2,
      y: 0.01,
      z: siteCenterZ,
      width: bounds.sideSB - 0.8,
      length: siteLength - 2.0
    },
    // Right Garden Strip
    {
      x: (siteMaxX + (plotW / 2)) / 2,
      y: 0.01,
      z: siteCenterZ,
      width: bounds.sideSB - 0.8,
      length: siteLength - 2.0
    },
    // Rear Garden Lawn
    {
      x: 0,
      y: 0.01,
      z: rearLawnZ,
      width: siteWidth - 2.0,
      length: bounds.rearSB - 0.8
    }
  ];

  // 7. Procedural Architectural Landscaping Trees (Guaranteed in outdoor lawn zones only!)
  const groundRooms = rooms.filter(r => (r.level || 0) === 0);

  const candidateTrees = isNorth ? [
    // Front North-East lawn corner
    { id: 'tree_fne', x: siteMaxX - 3.5, y: 0, z: siteMinZ + 4.5, trunkR: 0.45, trunkH: 5.5, crownR: 3.2, crownH: 8.5 },
    // Front North-West perimeter garden (left of driveway)
    { id: 'tree_fnw', x: siteMinX + 2.5, y: 0, z: siteMinZ + 4.5, trunkR: 0.4, trunkH: 5.0, crownR: 2.8, crownH: 7.5 },
    // Rear South-West garden corner
    { id: 'tree_rsw', x: siteMinX + 3.5, y: 0, z: siteMaxZ - 3.5, trunkR: 0.5, trunkH: 6.0, crownR: 3.5, crownH: 9.0 },
    // Rear South-East garden corner
    { id: 'tree_rse', x: siteMaxX - 3.5, y: 0, z: siteMaxZ - 3.5, trunkR: 0.48, trunkH: 5.5, crownR: 3.3, crownH: 8.5 }
  ] : [
    // Front left lawn corner
    { id: 'tree_fl', x: siteMinX + bounds.sideSB + 2.0, y: 0, z: siteMaxZ - 4.5, trunkR: 0.45, trunkH: 5.5, crownR: 3.2, crownH: 8.5 },
    // Front right lawn corner
    { id: 'tree_fr', x: siteMaxX - 3.5, y: 0, z: siteMaxZ - 4.5, trunkR: 0.4, trunkH: 5.0, crownR: 2.8, crownH: 7.5 },
    // Rear left corner tree
    { id: 'tree_rl', x: siteMinX + 3.5, y: 0, z: siteMinZ + 3.5, trunkR: 0.5, trunkH: 6.0, crownR: 3.5, crownH: 9.0 },
    // Rear right corner tree
    { id: 'tree_rr', x: siteMaxX - 3.5, y: 0, z: siteMinZ + 3.5, trunkR: 0.48, trunkH: 5.5, crownR: 3.3, crownH: 8.5 }
  ];

  // Strictly filter out any trees that would intersect with house geometry!
  const trees = candidateTrees.filter(t => !isTreeCollidingWithRooms(t.x, t.z, groundRooms, plotW, plotL, 3.5));

  trees.forEach(t => {
    collisionBoxes.push({
      id: t.id,
      type: 'tree_trunk',
      minX: t.x - t.trunkR,
      maxX: t.x + t.trunkR,
      minZ: t.z - t.trunkR,
      maxZ: t.z + t.trunkR,
      minY: 0,
      maxY: t.trunkH
    });
  });

  // 8. Boxwood Perimeter Hedges along Boundary Walls
  const hedges = [
    // Along rear wall
    { x: 0, y: 1.0, z: isNorth ? (siteMaxZ - 1.8) : (siteMinZ + 1.8), width: siteWidth - 4.0, height: 2.0, length: 1.2 },
    // Along left wall
    { x: siteMinX + 1.8, y: 1.0, z: siteCenterZ, width: 1.2, height: 2.0, length: siteLength - 6.0 },
    // Along right wall
    { x: siteMaxX - 1.8, y: 1.0, z: siteCenterZ, width: 1.2, height: 2.0, length: siteLength - 6.0 }
  ];

  hedges.forEach((h, idx) => {
    collisionBoxes.push({
      id: `hedge_${idx}`,
      type: 'hedge',
      minX: h.x - h.width / 2,
      maxX: h.x + h.width / 2,
      minZ: h.z - h.length / 2,
      maxZ: h.z + h.length / 2,
      minY: 0,
      maxY: h.height
    });
  });

  // 9. Entrance Steps and Plinth
  const entranceZ = isNorth ? (-plotL / 2 - 1.8) : (plotL / 2 + 1.8);
  const entranceSteps = {
    x: pedGateCenterX,
    y: 0.45,
    z: entranceZ,
    width: 6.0,
    length: 3.6,
    steps: [
      { step: 1, y: 0.22, z: isNorth ? (-plotL / 2 - 2.4) : (plotL / 2 + 2.4), width: 6.0, length: 1.4, height: 0.45 },
      { step: 2, y: 0.45, z: isNorth ? (-plotL / 2 - 1.0) : (plotL / 2 + 1.0), width: 6.0, length: 1.4, height: 0.45 }
    ]
  };

  // 10. Porch Canopy (Floating modern awning above entrance)
  const porchCanopyZ = isNorth ? (-plotL / 2 - 2.8) : (plotL / 2 + 2.8);
  const colZ = isNorth ? (-plotL / 2 - 5.2) : (plotL / 2 + 5.2);
  const porchCanopy = {
    x: pedGateCenterX,
    y: PROPERTY_DEFAULTS.porchCanopyHeight,
    z: porchCanopyZ,
    width: 7.5,
    length: PROPERTY_DEFAULTS.porchCanopyDepth,
    thickness: 0.4,
    columnL: { x: pedGateCenterX - 3.4, y: PROPERTY_DEFAULTS.porchCanopyHeight / 2, z: colZ, radius: 0.18, height: PROPERTY_DEFAULTS.porchCanopyHeight },
    columnR: { x: pedGateCenterX + 3.4, y: PROPERTY_DEFAULTS.porchCanopyHeight / 2, z: colZ, radius: 0.18, height: PROPERTY_DEFAULTS.porchCanopyHeight }
  };

  collisionBoxes.push({
    id: 'porch_col_l',
    type: 'column',
    minX: porchCanopy.columnL.x - 0.3,
    maxX: porchCanopy.columnL.x + 0.3,
    minZ: porchCanopy.columnL.z - 0.3,
    maxZ: porchCanopy.columnL.z + 0.3,
    minY: 0,
    maxY: porchCanopy.columnL.height
  });

  collisionBoxes.push({
    id: 'porch_col_r',
    type: 'column',
    minX: porchCanopy.columnR.x - 0.3,
    maxX: porchCanopy.columnR.x + 0.3,
    minZ: porchCanopy.columnR.z - 0.3,
    maxZ: porchCanopy.columnR.z + 0.3,
    minY: 0,
    maxY: porchCanopy.columnR.height
  });

  // 11. Roof Terrace and Parapet Railing
  const maxFloorLevel = Math.max(...rooms.map(r => r.level || 0), 0);
  const roofElevation = getFloorElevation(maxFloorLevel) + STORY_HEIGHT;
  const terrace = {
    elevation: roofElevation,
    width: plotW,
    length: plotL,
    parapetHeight: PROPERTY_DEFAULTS.terraceParapetHeight,
    parapetSegments: [
      // North parapet
      { x: 0, y: roofElevation + 1.75, z: -plotL / 2 + 0.25, width: plotW, height: 3.5, length: 0.5 },
      // South parapet
      { x: 0, y: roofElevation + 1.75, z: plotL / 2 - 0.25, width: plotW, height: 3.5, length: 0.5 },
      // West parapet
      { x: -plotW / 2 + 0.25, y: roofElevation + 1.75, z: 0, width: 0.5, height: 3.5, length: plotL },
      // East parapet
      { x: plotW / 2 - 0.25, y: roofElevation + 1.75, z: 0, width: 0.5, height: 3.5, length: plotL }
    ]
  };

  terrace.parapetSegments.forEach((p, idx) => {
    collisionBoxes.push({
      id: `terrace_parapet_${idx}`,
      type: 'terrace_parapet',
      minX: p.x - p.width / 2,
      maxX: p.x + p.width / 2,
      minZ: p.z - p.length / 2,
      maxZ: p.z + p.length / 2,
      minY: roofElevation,
      maxY: roofElevation + p.height
    });
  });

  // 12. Exterior Lights (Bollards, Lanterns, Wall Sconces)
  const exteriorLights = [
    // Gate Pillar Lanterns
    { id: 'light_pillar_veh_l', x: vehGateLeft - pillarW / 2, y: pillarH + 0.8, z: siteMaxZ, type: 'pillar_lantern', intensity: 1.2, color: 0xffedd5 },
    { id: 'light_pillar_veh_r', x: vehGateRight + pillarW / 2, y: pillarH + 0.8, z: siteMaxZ, type: 'pillar_lantern', intensity: 1.2, color: 0xffedd5 },
    { id: 'light_pillar_ped_l', x: pedGateLeft - pillarW / 2, y: pillarH + 0.8, z: siteMaxZ, type: 'pillar_lantern', intensity: 1.2, color: 0xffedd5 },
    { id: 'light_pillar_ped_r', x: pedGateRight + pillarW / 2, y: pillarH + 0.8, z: siteMaxZ, type: 'pillar_lantern', intensity: 1.2, color: 0xffedd5 },
    // Pathway Bollard Lights
    { id: 'light_bollard_1', x: pedGateCenterX - pedGateW / 2 - 0.8, y: 2.2, z: siteMaxZ - 4.5, type: 'bollard', intensity: 0.8, color: 0xfef08a },
    { id: 'light_bollard_2', x: pedGateCenterX + pedGateW / 2 + 0.8, y: 2.2, z: siteMaxZ - 9.0, type: 'bollard', intensity: 0.8, color: 0xfef08a },
    { id: 'light_bollard_3', x: pedGateCenterX - pedGateW / 2 - 0.8, y: 2.2, z: plotL / 2 + 3.5, type: 'bollard', intensity: 0.8, color: 0xfef08a },
    // Porch Entrance Downlights
    { id: 'light_porch_1', x: pedGateCenterX - 1.8, y: PROPERTY_DEFAULTS.porchCanopyHeight - 0.2, z: plotL / 2 + 2.8, type: 'downlight', intensity: 1.5, color: 0xfffbeb },
    { id: 'light_porch_2', x: pedGateCenterX + 1.8, y: PROPERTY_DEFAULTS.porchCanopyHeight - 0.2, z: plotL / 2 + 2.8, type: 'downlight', intensity: 1.5, color: 0xfffbeb }
  ];

  // 13. Default Outside Spawn Point for First-Person Exploration
  // Positioned on the front pedestrian walkway/approach facing the house
  const spawnPoint = {
    x: pedGateCenterX,
    y: 5.5, // 5.5 ft human eye level
    z: isNorth ? (siteMinZ - 4.0) : Math.min(siteMaxZ - 3.0, plotL / 2 + 12.0),
    yaw: isNorth ? Math.PI : 0, // Faces into the house: +Z (Math.PI) for North approach, -Z (0) for South approach
    pitch: -0.02
  };

  return {
    bounds,
    concept,
    pillars,
    boundaryWalls,
    gates,
    driveway,
    walkway,
    lawns,
    trees,
    hedges,
    entranceSteps,
    porchCanopy,
    terrace,
    exteriorLights,
    spawnPoint,
    collisionBoxes
  };
}
