import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SCALE,
  DEFAULT_WALL_HEIGHT,
  CUTAWAY_WALL_HEIGHT,
  STORY_HEIGHT,
  convert2DTo3DCoords,
  getFloorElevation,
  generateRoomWallSegments,
  generateStairSteps,
  generateOpeningPlacements,
  generateRoomFurniture,
  calculateLabelSpecs,
  calculateOptimalCameraPosition,
  LIGHTING_PRESETS,
  MATERIAL_STYLES,
  QUALITY_PRESETS,
  VIEWING_MODES,
  generateWalkthroughWaypoints,
  calculateRevealState
} from '../../client/src/utils/threeMath.js';


describe('Phase 4: Three.js 3D House Viewer Transformations & Geometry Tests', () => {

  test('1. 2D to 3D coordinate conversions: correctly centers coordinates around plot center', () => {
    const plotWidth = 30;
    const plotLength = 40;

    // Room in top-left quadrant
    const r1 = convert2DTo3DCoords(0, 0, 15, 20, plotWidth, plotLength);
    assert.equal(r1.x, -7.5);
    assert.equal(r1.z, -10);
    assert.equal(r1.width, 15);
    assert.equal(r1.length, 20);

    // Room in bottom-right quadrant
    const r2 = convert2DTo3DCoords(15, 20, 15, 20, plotWidth, plotLength);
    assert.equal(r2.x, 7.5);
    assert.equal(r2.z, 10);

    // Room covering full plot must center exactly at (0, 0)
    const fullPlot = convert2DTo3DCoords(0, 0, 30, 40, plotWidth, plotLength);
    assert.equal(fullPlot.x, 0);
    assert.equal(fullPlot.z, 0);
  });

  test('2. Floor elevations: calculates correct base Y elevations for floors and exploded view', () => {
    // Level 0 (Ground floor)
    assert.equal(getFloorElevation(0), 0);

    // Level 1 (First floor) standard building view
    assert.equal(getFloorElevation(1), STORY_HEIGHT);
    assert.equal(getFloorElevation(1), 10.0);

    // Level 1 with exploded view gap of 8 ft
    assert.equal(getFloorElevation(1, 8.0), 18.0);

    // Level 2 with exploded gap
    assert.equal(getFloorElevation(2, 5.0), 30.0);
  });

  test('3. Wall segment generation: produces 4 enclosed walls with thickness and height', () => {
    const room = { x: 5, y: 5, width: 14, length: 12, level: 0 };
    const walls = generateRoomWallSegments(room, 30, 40, DEFAULT_WALL_HEIGHT, 0.5);

    assert.equal(walls.length, 4);
    const wallNames = walls.map(w => w.wall);
    assert.ok(wallNames.includes('north'));
    assert.ok(wallNames.includes('south'));
    assert.ok(wallNames.includes('east'));
    assert.ok(wallNames.includes('west'));

    // Verify heights and thickness
    for (const w of walls) {
      assert.equal(w.height, DEFAULT_WALL_HEIGHT);
      assert.ok(w.width === 0.5 || w.length === 0.5);
    }
  });

  test('4. Staircase generation: produces ascending steps connecting Level 0 to Level 1', () => {
    const stairRoom = { x: 14, y: 0, width: 16, length: 14, level: 0 };
    const steps = generateStairSteps(stairRoom, 30, 40, 12, STORY_HEIGHT);

    assert.equal(steps.length, 12);

    // Step heights must strictly increase monotonically
    for (let i = 1; i < steps.length; i++) {
      assert.ok(steps[i].y > steps[i - 1].y, `Step ${i} height must be higher than step ${i - 1}`);
      assert.ok(steps[i].z > steps[i - 1].z, `Step ${i} depth must progress forward`);
    }

    // First step is near ground, last step approaches story height
    assert.ok(steps[0].y < 1.0);
    assert.ok(steps[11].y > 8.5);
  });

  test('5. Door and Window placement generation: creates correct 3D positions', () => {
    const room = {
      x: 0,
      y: 0,
      width: 14,
      length: 14,
      level: 0,
      doors: [{ id: 'd1', wall: 'south', width: 3.0 }],
      windows: [{ id: 'w1', wall: 'north', width: 4.0 }],
    };

    const openings = generateOpeningPlacements(room, 30, 40, 0);
    assert.equal(openings.length, 2);

    const door = openings.find(o => o.type === 'door');
    const window = openings.find(o => o.type === 'window');

    assert.ok(door);
    assert.ok(window);
    assert.equal(door.width, 3.0);
    assert.equal(window.width, 4.0);
    // Door sill starts at floor level (center at height/2 = 3.5)
    assert.equal(door.y, 3.5);
    // Window sill at 3ft + window height/2 = 3 + 2 = 5.0
    assert.equal(window.y, 5.0);
  });

  test('6. Floor visibility and filtering: cleanly filters rooms by floor level', () => {
    const allRooms = [
      { id: 'parking_1', level: 0, name: 'Parking' },
      { id: 'stair_1', level: 0, name: 'Stairs' },
      { id: 'bed_1', level: 1, name: 'Master Bed' },
      { id: 'bed_2', level: 1, name: 'Bed 2' },
      { id: 'living_1', level: 1, name: 'Living' },
    ];

    const groundOnly = allRooms.filter(r => r.level === 0);
    const firstOnly = allRooms.filter(r => r.level === 1);

    assert.equal(groundOnly.length, 2);
    assert.equal(firstOnly.length, 3);
  });

  test('7. Real-time updates: dynamic 2D edits propagate to 3D coordinates immediately', () => {
    const plotWidth = 30;
    const plotLength = 40;

    let room = { x: 0, y: 0, width: 10, length: 10, level: 0 };
    let coords1 = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
    assert.equal(coords1.x, -10);
    assert.equal(coords1.z, -15);

    // Simulate 2D drag move: x changed from 0 to 10
    room = { ...room, x: 10, y: 5 };
    let coords2 = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
    assert.equal(coords2.x, 0);
    assert.equal(coords2.z, -10);

    // Simulate 2D resize: width changed from 10 to 16
    room = { ...room, width: 16 };
    let coords3 = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
    assert.equal(coords3.x, 3);
    assert.equal(coords3.width, 16);
  });

  test('8. Graceful fallbacks: handles missing or undefined dimensions without crashing or NaN', () => {
    const safeCoords = convert2DTo3DCoords(undefined, null, undefined, null, undefined, undefined);
    assert.ok(!Number.isNaN(safeCoords.x));
    assert.ok(!Number.isNaN(safeCoords.z));
    assert.equal(safeCoords.width, 10);
    assert.equal(safeCoords.length, 10);

    const safeElevation = getFloorElevation(undefined, null);
    assert.equal(safeElevation, 0);

    const emptyStairs = generateStairSteps(null);
    assert.deepEqual(emptyStairs, []);
  });

  test('9. Schematic furniture generation: produces valid architectural items sized within room boundaries', () => {
    const plotWidth = 30;
    const plotLength = 40;

    // Test Bedroom furniture
    const bedroom = { id: 'b1', type: 'bedroom', name: 'Master Bedroom', x: 0, y: 0, width: 14, length: 14, level: 1 };
    const bedItems = generateRoomFurniture(bedroom, plotWidth, plotLength, 10.0);
    assert.ok(bedItems.length >= 2, 'Bedroom must have bed and headboard');
    const mattress = bedItems.find(i => i.name === 'bed_mattress');
    assert.ok(mattress);
    assert.ok(mattress.w <= bedroom.width);
    assert.ok(mattress.l <= bedroom.length);

    // Test Living room furniture
    const living = { id: 'l1', type: 'living', name: 'Living Hall', x: 0, y: 0, width: 18, length: 14, level: 1 };
    const livingItems = generateRoomFurniture(living, plotWidth, plotLength, 10.0);
    assert.ok(livingItems.some(i => i.name === 'sofa_base'));
    assert.ok(livingItems.some(i => i.name === 'coffee_table'));

    // Test Parking markings
    const parking = { id: 'p1', type: 'parking', name: 'Car Parking', x: 0, y: 0, width: 14, length: 18, level: 0 };
    const parkingItems = generateRoomFurniture(parking, plotWidth, plotLength, 0.0);
    assert.ok(parkingItems.some(i => i.name === 'park_line'));
    assert.ok(parkingItems.some(i => i.name === 'wheel_stop'));
  });

  test('10. Smart label placement: scales label size proportionally and staggers vertical elevation to avoid collision', () => {
    const plotWidth = 30;
    const plotLength = 40;

    const largeRoom = { id: 'r1', x: 0, y: 0, width: 18, length: 16, level: 0 };
    const smallRoom = { id: 'r2', x: 18, y: 0, width: 6, length: 6, level: 0 };

    const specLarge = calculateLabelSpecs(largeRoom, plotWidth, plotLength, 4.5, 0.0, 0);
    const specSmall = calculateLabelSpecs(smallRoom, plotWidth, plotLength, 4.5, 0.0, 1);

    // Small room label must be scaled smaller than large room label
    assert.ok(specSmall.scaleX < specLarge.scaleX, 'Small room label must be scaled down to prevent overflow');
    assert.ok(specSmall.isSmallRoom === true);
    assert.ok(specLarge.isSmallRoom === false);

    // Staggered Y elevation to prevent adjacent label collision
    assert.notEqual(specLarge.y, specSmall.y, 'Adjacent labels must have staggered vertical heights');
  });

  test('11. Dynamic camera auto-framing calculation: calculates valid distance and center target', () => {
    const plotWidth = 30;
    const plotLength = 40;

    const isoFraming = calculateOptimalCameraPosition(plotWidth, plotLength, 'all', 8, 'iso');
    assert.ok(isoFraming.position.x > 0);
    assert.ok(isoFraming.position.y > 0);
    assert.ok(isoFraming.position.z > 0);
    assert.equal(isoFraming.target.x, 0);
    assert.equal(isoFraming.target.z, 0);
    assert.ok(isoFraming.radius > 20);

    // Exploded mode height must elevate the camera target appropriately
    const explodedFraming = calculateOptimalCameraPosition(plotWidth, plotLength, 'exploded', 12, 'iso');
    assert.ok(explodedFraming.target.y > isoFraming.target.y);
  });

  test('12. Deterministic Reveal Animation State: maps progress 0.0 to 1.0 into discrete architectural phases', () => {
    // Stage 0: Initial state (p = 0.0)
    const s0 = calculateRevealState(0.0);
    assert.equal(s0.progress, 0.0);
    assert.equal(s0.isComplete, false);
    assert.equal(s0.groundSlabY, -8.0);
    assert.equal(s0.l0WallScale, 0);
    assert.equal(s0.l0FurnitureOpacity, 0);
    assert.equal(s0.l1StructureProgress, 0);
    assert.equal(s0.cameraOrbitAngle, 0.5);

    // Stage 1 complete (p = 0.2): Ground slab seated, walls just about to start
    const s1 = calculateRevealState(0.2);
    assert.equal(s1.groundSlabY, 0);
    assert.equal(s1.l0WallScale, 0);

    // Stage 2 mid-point (p = 0.31): Ground walls extruding
    const s2 = calculateRevealState(0.31);
    assert.equal(s2.groundSlabY, 0);
    assert.equal(s2.l0WallScale, 0.5);
    assert.equal(s2.l0FurnitureOpacity, 0);

    // Stage 3 mid-point (p = 0.50): Ground walls fully up, furniture fading in
    const s3 = calculateRevealState(0.50);
    assert.equal(s3.l0WallScale, 1.0);
    assert.equal(s3.l0FurnitureOpacity, 0.5);
    assert.equal(s3.l1StructureProgress, 0);

    // Stage 4 mid-point (p = 0.70): First floor descending / constructing
    const s4 = calculateRevealState(0.70);
    assert.equal(s4.l0WallScale, 1.0);
    assert.equal(s4.l0FurnitureOpacity, 1.0);
    assert.equal(s4.l1StructureProgress, 0.5);

    // Stage 5 complete (p = 1.0): Fully revealed
    const s5 = calculateRevealState(1.0);
    assert.equal(s5.progress, 1.0);
    assert.equal(s5.isComplete, true);
    assert.equal(s5.groundSlabY, 0);
    assert.equal(s5.l0WallScale, 1.0);
    assert.equal(s5.l0FurnitureOpacity, 1.0);
    assert.equal(s5.l1StructureProgress, 1.0);
    assert.equal(s5.cameraOrbitAngle, 0);

    // Clamping checks for out-of-bounds progress values
    const sNeg = calculateRevealState(-0.5);
    assert.equal(sNeg.progress, 0.0);
    assert.equal(sNeg.groundSlabY, -8.0);

    const sOver = calculateRevealState(1.8);
    assert.equal(sOver.progress, 1.0);
    assert.equal(sOver.isComplete, true);
  });

  test('13. Walkthrough Tour Waypoint Generation: sets 5.5 ft human eye level and orders rooms logically', () => {
    // Empty rooms check
    assert.deepEqual(generateWalkthroughWaypoints([]), []);
    assert.deepEqual(generateWalkthroughWaypoints(null), []);

    const testRooms = [
      { id: 'bath_1', name: 'Bath', type: 'bathroom', level: 1, x: 0, y: 15, width: 6, length: 7 },
      { id: 'park_1', name: 'Car Parking', type: 'parking', level: 0, x: 0, y: 0, width: 14, length: 18 },
      { id: 'bed_1', name: 'Master Bed', type: 'master_bedroom', level: 1, x: 10, y: 0, width: 14, length: 14 },
      { id: 'stair_1', name: 'Stairs', type: 'staircase', level: 0, x: 14, y: 0, width: 16, length: 12 },
      { id: 'liv_1', name: 'Living Room', type: 'living', level: 1, x: 0, y: 0, width: 16, length: 14 },
    ];

    const waypoints = generateWalkthroughWaypoints(testRooms, 30, 40);
    assert.equal(waypoints.length, 5);

    // Verify ordering: Level 0 rooms come before Level 1 rooms
    assert.equal(waypoints[0].level, 0);
    assert.equal(waypoints[1].level, 0);
    assert.equal(waypoints[2].level, 1);
    assert.equal(waypoints[3].level, 1);
    assert.equal(waypoints[4].level, 1);

    // Level 0 parking must precede staircase
    assert.equal(waypoints[0].type, 'parking');
    assert.equal(waypoints[1].type, 'staircase');

    // Verify eye-level height: Level 0 is at 5.5 ft, Level 1 is at 10.0 + 5.5 = 15.5 ft
    assert.equal(waypoints[0].cameraPosition.y, 5.5);
    assert.equal(waypoints[1].cameraPosition.y, 5.5);
    assert.equal(waypoints[2].cameraPosition.y, 15.5);
    assert.equal(waypoints[3].cameraPosition.y, 15.5);
    assert.equal(waypoints[4].cameraPosition.y, 15.5);

    // Verify target elevation: Level 0 is at 4.8 ft, Level 1 is at 14.8 ft
    assert.equal(waypoints[0].targetPosition.y, 4.8);
    assert.equal(waypoints[2].targetPosition.y, 14.8);

    // Check complete room metadata fields
    for (const wp of waypoints) {
      assert.ok(wp.name);
      assert.ok(wp.dimensions.includes('×'));
      assert.ok(wp.area > 0);
      assert.ok(!Number.isNaN(wp.cameraPosition.x));
      assert.ok(!Number.isNaN(wp.cameraPosition.z));
      assert.ok(!Number.isNaN(wp.targetPosition.x));
      assert.ok(!Number.isNaN(wp.targetPosition.z));
    }
  });

  test('14. Cinematic Lighting Presets: defines 5 distinct atmospheres with valid sun and exposure parameters', () => {
    const presetKeys = Object.keys(LIGHTING_PRESETS);
    assert.equal(presetKeys.length, 5);
    assert.ok(presetKeys.includes('warm_daylight'));
    assert.ok(presetKeys.includes('neutral_daylight'));
    assert.ok(presetKeys.includes('golden_hour'));
    assert.ok(presetKeys.includes('evening_dusk'));
    assert.ok(presetKeys.includes('night_interior'));

    for (const key of presetKeys) {
      const p = LIGHTING_PRESETS[key];
      assert.ok(p.id);
      assert.ok(p.name);
      assert.ok(typeof p.sunIntensity === 'number' && p.sunIntensity > 0);
      assert.ok(typeof p.ambientIntensity === 'number' && p.ambientIntensity > 0);
      assert.ok(typeof p.exposure === 'number' && p.exposure > 0);
      assert.ok(Array.isArray(p.sunPosition) && p.sunPosition.length === 3);
    }

    // Evening dusk and night interior must activate interior warm point lights
    assert.equal(LIGHTING_PRESETS.golden_hour.interiorLights, true);
    assert.equal(LIGHTING_PRESETS.evening_dusk.interiorLights, true);
    assert.equal(LIGHTING_PRESETS.night_interior.interiorLights, true);
    assert.equal(LIGHTING_PRESETS.neutral_daylight.interiorLights, false);
    assert.equal(LIGHTING_PRESETS.warm_daylight.interiorLights, false);
  });

  test('15. Architectural Material Styles: provides 4 palettes with wall colors and floor materials', () => {
    const styleKeys = Object.keys(MATERIAL_STYLES);
    assert.equal(styleKeys.length, 4);
    assert.ok(styleKeys.includes('modern_scandi'));
    assert.ok(styleKeys.includes('warm_japandi'));
    assert.ok(styleKeys.includes('luxury_marble'));
    assert.ok(styleKeys.includes('industrial_loft'));

    for (const key of styleKeys) {
      const s = MATERIAL_STYLES[key];
      assert.ok(s.id);
      assert.ok(s.name);
      assert.ok(typeof s.wallColor === 'number');
      assert.ok(typeof s.wallRoughness === 'number' && s.wallRoughness >= 0 && s.wallRoughness <= 1);
      assert.ok(typeof s.bedroomFloor === 'number');
      assert.ok(typeof s.livingFloor === 'number');
      assert.ok(typeof s.kitchenFloor === 'number');
      assert.ok(typeof s.bathFloor === 'number');
      assert.ok(typeof s.woodTrim === 'number');
      assert.ok(typeof s.metalTrim === 'number');
    }
  });

  test('16. Quality Presets: provides performance, balanced, and high quality presets with real shadow map & light limits', () => {
    const qKeys = Object.keys(QUALITY_PRESETS);
    assert.equal(qKeys.length, 3);
    assert.ok(qKeys.includes('performance'));
    assert.ok(qKeys.includes('balanced'));
    assert.ok(qKeys.includes('high'));

    const perf = QUALITY_PRESETS.performance;
    const bal = QUALITY_PRESETS.balanced;
    const high = QUALITY_PRESETS.high;

    // Shadow map sizes must increase with quality
    assert.ok(perf.shadowMapSize < bal.shadowMapSize);
    assert.ok(bal.shadowMapSize < high.shadowMapSize);

    // Max point lights must scale appropriately
    assert.ok(perf.maxPointLights < bal.maxPointLights);
    assert.ok(bal.maxPointLights < high.maxPointLights);

    // Pixel ratio scaling
    assert.equal(perf.pixelRatioMax, 1.0);
    assert.ok(high.pixelRatioMax >= 2.0);
  });

  test('17. Architectural Viewing Modes: defines 7 viewing modes with proper camera framings', () => {
    assert.equal(VIEWING_MODES.length, 7);
    const modeIds = VIEWING_MODES.map(m => m.id);
    assert.ok(modeIds.includes('all'));
    assert.ok(modeIds.includes('ground'));
    assert.ok(modeIds.includes('first'));
    assert.ok(modeIds.includes('cutaway'));
    assert.ok(modeIds.includes('exploded'));
    assert.ok(modeIds.includes('topdown'));
    assert.ok(modeIds.includes('exterior'));

    // Top-down camera framing must place camera overhead looking down
    const topCam = calculateOptimalCameraPosition(30, 40, 'topdown', 6, 'top');
    assert.equal(topCam.position.x, 0);
    assert.ok(topCam.position.y > 40);
    assert.ok(Math.abs(topCam.position.z) <= 0.1);

    // Exterior camera framing must frame from an exterior distance
    const extCam = calculateOptimalCameraPosition(30, 40, 'exterior', 6, 'exterior');
    assert.ok(extCam.position.x > 0);
    assert.ok(extCam.position.z > 0);
  });

  test('18. Walkthrough camera safety: guarantees valid eye-level, forward targets, and non-zero distances', () => {
    const complexRooms = [
      { id: 'p1', name: 'Parking', type: 'parking', level: 0, x: 0, y: 0, width: 14, length: 18 },
      { id: 's1', name: 'Stairs', type: 'staircase', level: 0, x: 14, y: 0, width: 16, length: 12 },
      { id: 'l1', name: 'Living Hall', type: 'living', level: 1, x: 0, y: 0, width: 18, length: 14 },
      { id: 'b1', name: 'Master Bed', type: 'master_bedroom', level: 1, x: 0, y: 14, width: 14, length: 14 },
      { id: 't1', name: 'Bath', type: 'bathroom', level: 1, x: 14, y: 14, width: 6, length: 8 }
    ];

    const wps = generateWalkthroughWaypoints(complexRooms, 30, 40);
    assert.equal(wps.length, 5);

    for (const wp of wps) {
      const cam = wp.cameraPosition;
      const target = wp.targetPosition;

      // Distance from camera to target must be at least 3 ft to prevent OrbitControls collapse
      const dx = cam.x - target.x;
      const dy = cam.y - target.y;
      const dz = cam.z - target.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      assert.ok(dist >= 3.0, `Room ${wp.name} camera-to-target distance (${dist.toFixed(2)}) must be >= 3 ft`);

      // No NaN or undefined in any waypoint
      assert.ok(!Number.isNaN(cam.x) && !Number.isNaN(cam.y) && !Number.isNaN(cam.z));
      assert.ok(!Number.isNaN(target.x) && !Number.isNaN(target.y) && !Number.isNaN(target.z));

      // Eye level elevation check: Level 0 = 5.5, Level 1 = 15.5
      const expectedY = wp.level === 0 ? 5.5 : 15.5;
      assert.equal(cam.y, expectedY);
    }
  });

});


