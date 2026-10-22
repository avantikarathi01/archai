import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PIXELS_PER_FOOT,
  feetToPixels,
  pixelsToFeet,
  snapToGrid,
  clamp,
  doRoomsOverlap,
  isRoomWithinBounds,
  findRoomOverlaps,
  recalculateLayoutMetrics,
  generateUniqueRoomId,
  ROOM_TYPE_DEFAULTS
} from '../../client/src/utils/canvasMath.js';

describe('Phase 3: 2D Floor Plan Canvas Geometry, Math & State Tests', () => {

  // 1. Math and coordinate conversions
  test('1. Coordinate conversions: feet to pixels and pixels to feet', () => {
    assert.equal(feetToPixels(10, 20), 200);
    assert.equal(feetToPixels(15.5, 20), 310);
    assert.equal(pixelsToFeet(200, 20), 10);
    assert.equal(pixelsToFeet(310, 20), 15.5);

    // Roundtrip consistency
    const testValues = [5, 12, 17.5, 30, 42.25];
    for (const val of testValues) {
      const px = feetToPixels(val, DEFAULT_PIXELS_PER_FOOT);
      const ft = pixelsToFeet(px, DEFAULT_PIXELS_PER_FOOT);
      assert.equal(ft, val);
    }
  });

  // 2. Snapping and bounds checks
  test('2. Snapping increments and bounds clamping', () => {
    // 1.0 ft snap
    assert.equal(snapToGrid(10.2, 1.0), 10.0);
    assert.equal(snapToGrid(10.6, 1.0), 11.0);
    assert.equal(snapToGrid(10.5, 1.0), 11.0);

    // 0.5 ft snap
    assert.equal(snapToGrid(10.2, 0.5), 10.0);
    assert.equal(snapToGrid(10.3, 0.5), 10.5);
    assert.equal(snapToGrid(10.74, 0.5), 10.5);
    assert.equal(snapToGrid(10.76, 0.5), 11.0);

    // 0.25 ft snap
    assert.equal(snapToGrid(10.12, 0.25), 10.0);
    assert.equal(snapToGrid(10.18, 0.25), 10.25);

    // Clamping
    assert.equal(clamp(5, 0, 30), 5);
    assert.equal(clamp(-3, 0, 30), 0);
    assert.equal(clamp(35, 0, 30), 30);
  });

  test('3. Room boundary validation within plot footprint', () => {
    const plotWidth = 30;
    const plotLength = 40;

    const validRoom = { id: 'r1', x: 0, y: 0, width: 14, length: 12, level: 0 };
    assert.equal(isRoomWithinBounds(validRoom, plotWidth, plotLength), true);

    const cornerRoom = { id: 'r2', x: 16, y: 28, width: 14, length: 12, level: 0 };
    assert.equal(isRoomWithinBounds(cornerRoom, plotWidth, plotLength), true);

    // Negative coordinates
    const negativeX = { id: 'r3', x: -1, y: 5, width: 10, length: 10, level: 0 };
    assert.equal(isRoomWithinBounds(negativeX, plotWidth, plotLength), false);

    // Exceeds width
    const exceedWidth = { id: 'r4', x: 22, y: 5, width: 10, length: 10, level: 0 };
    assert.equal(isRoomWithinBounds(exceedWidth, plotWidth, plotLength), false);

    // Exceeds length
    const exceedLength = { id: 'r5', x: 5, y: 35, width: 10, length: 10, level: 0 };
    assert.equal(isRoomWithinBounds(exceedLength, plotWidth, plotLength), false);
  });

  // 3. Move, resize, and overlap detection
  test('4. 2D AABB overlap detection: handles overlap, wall sharing, and multi-floor isolation', () => {
    // Intersecting rooms on Level 0
    const roomA = { id: 'a', x: 0, y: 0, width: 14, length: 14, level: 0 };
    const roomB = { id: 'b', x: 10, y: 10, width: 14, length: 14, level: 0 };
    assert.equal(doRoomsOverlap(roomA, roomB), true);

    // Perfectly adjacent rooms sharing a wall (touching, not overlapping)
    const roomC = { id: 'c', x: 14, y: 0, width: 16, length: 14, level: 0 };
    assert.equal(doRoomsOverlap(roomA, roomC), false, 'Rooms sharing a wall must not be flagged as overlapping');

    // Identical coordinates on DIFFERENT floors (Level 0 vs Level 1)
    const roomFloor0 = { id: 'f0', x: 0, y: 0, width: 14, length: 14, level: 0 };
    const roomFloor1 = { id: 'f1', x: 0, y: 0, width: 14, length: 14, level: 1 };
    assert.equal(doRoomsOverlap(roomFloor0, roomFloor1), false, 'Cross-floor rooms must never be flagged as overlapping');

    // Self comparison must be false
    assert.equal(doRoomsOverlap(roomA, roomA), false);
  });

  test('5. findRoomOverlaps correctly finds multiple colliding rooms', () => {
    const r1 = { id: 'r1', x: 5, y: 5, width: 10, length: 10, level: 0 };
    const r2 = { id: 'r2', x: 8, y: 8, width: 10, length: 10, level: 0 }; // overlaps r1
    const r3 = { id: 'r3', x: 12, y: 12, width: 10, length: 10, level: 0 }; // overlaps r2
    const r4 = { id: 'r4', x: 5, y: 5, width: 10, length: 10, level: 1 }; // different floor

    const all = [r1, r2, r3, r4];
    const overlapsWithR2 = findRoomOverlaps(r2, all);
    const overlappingIds = overlapsWithR2.map(r => r.id).sort();

    assert.deepEqual(overlappingIds, ['r1', 'r3']);
  });

  // 4. Undo and redo transitions
  test('6. Undo and Redo transitions correctly manipulate history stack', () => {
    let currentRooms = [{ id: 'bed_1', x: 0, y: 0, width: 10, length: 10, level: 0 }];
    const history = [];
    const future = [];

    // Helper: commit edit
    const commit = (newRooms) => {
      history.push(JSON.parse(JSON.stringify(currentRooms)));
      future.length = 0; // clear future
      currentRooms = JSON.parse(JSON.stringify(newRooms));
    };

    // Helper: undo
    const undo = () => {
      if (history.length === 0) return;
      const prev = history.pop();
      future.unshift(JSON.parse(JSON.stringify(currentRooms)));
      currentRooms = prev;
    };

    // Helper: redo
    const redo = () => {
      if (future.length === 0) return;
      const next = future.shift();
      history.push(JSON.parse(JSON.stringify(currentRooms)));
      currentRooms = next;
    };

    // 1st Edit: Move room to x=5, y=5
    commit([{ id: 'bed_1', x: 5, y: 5, width: 10, length: 10, level: 0 }]);
    assert.equal(currentRooms[0].x, 5);
    assert.equal(history.length, 1);
    assert.equal(future.length, 0);

    // 2nd Edit: Resize room to width=14
    commit([{ id: 'bed_1', x: 5, y: 5, width: 14, length: 10, level: 0 }]);
    assert.equal(currentRooms[0].width, 14);
    assert.equal(history.length, 2);

    // Undo 2nd edit
    undo();
    assert.equal(currentRooms[0].width, 10);
    assert.equal(currentRooms[0].x, 5);
    assert.equal(future.length, 1);

    // Undo 1st edit
    undo();
    assert.equal(currentRooms[0].x, 0);
    assert.equal(future.length, 2);

    // Redo 1st edit
    redo();
    assert.equal(currentRooms[0].x, 5);
    assert.equal(currentRooms[0].width, 10);

    // Redo 2nd edit
    redo();
    assert.equal(currentRooms[0].width, 14);
    assert.equal(future.length, 0);
  });

  // 5. Floor switching and provisional status handling
  test('7. Floor switching: filters active floor rooms and separates floor metrics', () => {
    const rooms = [
      { id: 'parking_1', name: 'Car Parking', type: 'parking', level: 0, x: 0, y: 0, width: 14, length: 18 },
      { id: 'foyer_1', name: 'Foyer & Stairs', type: 'foyer', level: 0, x: 14, y: 0, width: 16, length: 18 },
      { id: 'living_1', name: 'Living Hall', type: 'living', level: 1, x: 0, y: 0, width: 20, length: 14 },
      { id: 'bed_1', name: 'Master Bedroom', type: 'master_bedroom', level: 1, x: 0, y: 14, width: 15, length: 14 },
      { id: 'bed_2', name: 'Bedroom 2', type: 'bedroom', level: 1, x: 15, y: 14, width: 15, length: 14 },
    ];

    const level0Rooms = rooms.filter(r => r.level === 0);
    const level1Rooms = rooms.filter(r => r.level === 1);

    assert.equal(level0Rooms.length, 2);
    assert.equal(level1Rooms.length, 3);

    const metrics = recalculateLayoutMetrics(rooms, 1200, true);
    assert.equal(metrics.totalBedrooms, 2);
    assert.equal(metrics.floorBreakdown[0].roomCount, 2);
    assert.equal(metrics.floorBreakdown[1].roomCount, 3);
    assert.equal(metrics.floorBreakdown[1].bedrooms, 2);
  });

  test('8. Provisional status handling: distinguishes confirmed from estimated plot area', () => {
    const rooms = [
      { id: 'living_1', name: 'Living', type: 'living', level: 0, x: 0, y: 0, width: 15, length: 20 }, // 300 sq ft
    ];

    // Case A: Unconfirmed / provisional dimensions (user only supplied area)
    const provisionalMetrics = recalculateLayoutMetrics(rooms, 1200, false);
    assert.equal(provisionalMetrics.groundCoveragePercent, null, 'Provisional layout must NOT have confirmed groundCoveragePercent');
    assert.equal(provisionalMetrics.groundCoverageEstimatedPercent, 25);

    // Case B: Explicit / confirmed plot dimensions
    const confirmedMetrics = recalculateLayoutMetrics(rooms, 1200, true);
    assert.equal(confirmedMetrics.groundCoveragePercent, 25);
    assert.equal(confirmedMetrics.groundCoverageEstimatedPercent, null);
  });

  // 6. Unique ID Generation and Presets
  test('9. Unique room ID generation and type defaults', () => {
    const existing = [
      { id: 'bedroom_1' },
      { id: 'bedroom_2' },
      { id: 'bathroom_1' },
    ];

    assert.equal(generateUniqueRoomId('bedroom', existing), 'bedroom_3');
    assert.equal(generateUniqueRoomId('kitchen', existing), 'kitchen_1');
    assert.equal(generateUniqueRoomId('bathroom', existing), 'bathroom_2');

    // Presets exist
    assert.ok(ROOM_TYPE_DEFAULTS.master_bedroom);
    assert.ok(ROOM_TYPE_DEFAULTS.staircase);
    assert.equal(ROOM_TYPE_DEFAULTS.staircase.zone, 'circulation');
  });

});
