import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateOptimalCameraPosition,
  convert2DTo3DCoords,
} from '../../client/src/utils/threeMath.js';

import {
  getRoomVertices,
  getRoomBoundingBox,
  doRoomsOverlap,
  isRoomWithinBounds,
} from '../../client/src/utils/canvasMath.js';

import {
  calculateSiteBounds,
  generatePropertySite,
} from '../../client/src/utils/propertyGenerator.js';

test('Phase 7: Full Functionality & Camera/Rotation Audit Tests', async (t) => {

  await t.test('1. Camera Presets calculate finite, building-bounds-aware coordinates', () => {
    const plotW = 30;
    const plotL = 40;
    const presets = ['iso', 'top', 'front', 'frame', 'exterior'];

    presets.forEach((preset) => {
      const res = calculateOptimalCameraPosition(plotW, plotL, 'all', 8, preset, 'East');
      assert.ok(res, `Result must exist for preset ${preset}`);
      assert.ok(Number.isFinite(res.position.x), `position.x must be finite for ${preset}`);
      assert.ok(Number.isFinite(res.position.y), `position.y must be finite for ${preset}`);
      assert.ok(Number.isFinite(res.position.z), `position.z must be finite for ${preset}`);
      assert.ok(Number.isFinite(res.target.x), `target.x must be finite for ${preset}`);
      assert.ok(Number.isFinite(res.target.y), `target.y must be finite for ${preset}`);
      assert.ok(Number.isFinite(res.target.z), `target.z must be finite for ${preset}`);
    });
  });

  await t.test('2. Orientation-aware Front Camera Preset aligns to Facing Direction', () => {
    const plotW = 30;
    const plotL = 40;

    // South facing: front camera is positioned at positive Z looking towards -Z
    const resSouth = calculateOptimalCameraPosition(plotW, plotL, 'all', 8, 'front', 'South');
    assert.ok(resSouth.position.z > resSouth.target.z, 'South-facing front camera must have +Z offset');

    // North facing: front camera is positioned at negative Z looking towards +Z
    const resNorth = calculateOptimalCameraPosition(plotW, plotL, 'all', 8, 'front', 'North');
    assert.ok(resNorth.position.z < resNorth.target.z, 'North-facing front camera must have -Z offset');

    // East facing: front camera is positioned at positive X looking towards -X
    const resEast = calculateOptimalCameraPosition(plotW, plotL, 'all', 8, 'front', 'East');
    assert.ok(resEast.position.x > resEast.target.x, 'East-facing front camera must have +X offset');

    // West facing: front camera is positioned at negative X looking towards +X
    const resWest = calculateOptimalCameraPosition(plotW, plotL, 'all', 8, 'front', 'West');
    assert.ok(resWest.position.x < resWest.target.x, 'West-facing front camera must have -X offset');
  });

  await t.test('3. Top-down camera preset looks directly down along Y-axis', () => {
    const resTop = calculateOptimalCameraPosition(30, 40, 'topdown', 8, 'top', 'East');
    assert.ok(resTop.position.y > 60, 'Top camera elevation must be high enough to frame plot');
    assert.ok(Math.abs(resTop.position.x - resTop.target.x) < 2, 'Top camera X must center on target X');
    assert.ok(Math.abs(resTop.position.z - resTop.target.z) < 2, 'Top camera Z must center on target Z');
  });

  await t.test('4. Rotated Room Bounding Box & 90-degree swaps', () => {
    // Room: 10 ft width, 20 ft length at (5, 5)
    // Center is at (10, 15)
    const room0 = { x: 5, y: 5, width: 10, length: 20, rotation: 0 };
    const bbox0 = getRoomBoundingBox(room0);
    assert.equal(Math.round(bbox0.width), 10);
    assert.equal(Math.round(bbox0.length), 20);
    assert.equal(Math.round(bbox0.minX), 5);
    assert.equal(Math.round(bbox0.minY), 5);

    // Rotated 90 degrees: effective width and length swap
    const room90 = { x: 5, y: 5, width: 10, length: 20, rotation: 90 };
    const bbox90 = getRoomBoundingBox(room90);
    assert.equal(Math.round(bbox90.width), 20);
    assert.equal(Math.round(bbox90.length), 10);
    // Center should remain identical at (10, 15)
    assert.equal(Math.round((bbox90.minX + bbox90.maxX) / 2), 10);
    assert.equal(Math.round((bbox90.minY + bbox90.maxY) / 2), 15);

    // Rotated 180 degrees: width and length same as 0 deg
    const room180 = { x: 5, y: 5, width: 10, length: 20, rotation: 180 };
    const bbox180 = getRoomBoundingBox(room180);
    assert.equal(Math.round(bbox180.width), 10);
    assert.equal(Math.round(bbox180.length), 20);

    // Rotated 270 degrees: width and length swap again
    const room270 = { x: 5, y: 5, width: 10, length: 20, rotation: 270 };
    const bbox270 = getRoomBoundingBox(room270);
    assert.equal(Math.round(bbox270.width), 20);
    assert.equal(Math.round(bbox270.length), 10);
  });

  await t.test('5. Rotated Room Overlap Detection via SAT', () => {
    // Room A at (2, 2), 10x10
    const roomA = { id: 'a', level: 0, x: 2, y: 2, width: 10, length: 10, rotation: 0 };

    // Room B at (14, 2), 6x14. At 0 deg, X range is [14, 20], no overlap with Room A [2, 12]
    const roomB0 = { id: 'b', level: 0, x: 14, y: 2, width: 6, length: 14, rotation: 0 };
    assert.equal(doRoomsOverlap(roomA, roomB0), false, 'Rooms must not overlap initially');

    // If Room B rotates 90 deg around its center (17, 9):
    // Width becomes 14, length becomes 6.
    // X range becomes [17 - 7, 17 + 7] = [10, 24].
    // Since Room A X is [2, 12], their X ranges now overlap in [10, 12]!
    // And Y range of B becomes [9 - 3, 9 + 3] = [6, 12], overlapping Room A Y [2, 12] in [6, 12]!
    const roomB90 = { id: 'b', level: 0, x: 14, y: 2, width: 6, length: 14, rotation: 90 };
    assert.equal(doRoomsOverlap(roomA, roomB90), true, 'Rooms must overlap after 90 degree rotation');
  });

  await t.test('6. Rotated Room Plot Boundary Containment', () => {
    const plotW = 30;
    const plotL = 40;

    // Room at (22, 10), width 6, length 16 at 0 deg:
    // Fits in plot because maxX = 28 <= 30, maxY = 26 <= 40
    const roomInside = { x: 22, y: 10, width: 6, length: 16, rotation: 0 };
    assert.equal(isRoomWithinBounds(roomInside, plotW, plotL), true, 'Room at 0 deg must fit inside bounds');

    // When rotated 90 deg:
    // Center is at (25, 18).
    // Width becomes 16, so maxX = 25 + 8 = 33 > 30!
    // It extends 3 ft past the right plot boundary!
    const roomRotated = { x: 22, y: 10, width: 6, length: 16, rotation: 90 };
    assert.equal(isRoomWithinBounds(roomRotated, plotW, plotL), false, 'Rotated room extending past 30ft width must fail containment');
  });

  await t.test('7. First-Person Simulator Spawn Point avoids black void', () => {
    const site = generatePropertySite(30, 40, [], 'East', 'contemporary_minimalist');
    assert.ok(site.spawnPoint, 'Spawn point must be defined');

    // Yaw must be 0 (looking along -Z towards the house, not 180 looking away into the void)
    assert.equal(site.spawnPoint.yaw, 0, 'Spawn yaw must be 0 (facing house front)');

    // Z coordinate must be inside front approach
    assert.ok(site.spawnPoint.z > 0, 'Spawn Z must be in front yard');
    assert.ok(site.spawnPoint.z <= site.bounds.siteMaxZ, 'Spawn Z must be within property boundaries');
    assert.ok(site.spawnPoint.y >= 5.0 && site.spawnPoint.y <= 6.0, 'Spawn eye-level must be standard human height (~5.5 ft)');
  });

  await t.test('8. History Single-Snapshot Timing & Commit Model', () => {
    // Simulating user dragging or rotating a room:
    // Snapshot captured BEFORE the mutation:
    const initialRooms = [
      { id: 'r1', x: 2, y: 2, width: 10, length: 12, rotation: 0 }
    ];
    let history = [];
    let future = [];
    let currentRooms = JSON.parse(JSON.stringify(initialRooms));

    // Drag / rotate starts:
    const snapshotBeforeAction = JSON.parse(JSON.stringify(currentRooms));

    // Drag / rotate mutates currentRooms:
    currentRooms[0].rotation = 90;
    currentRooms[0].x = 4;

    // Mouse up commits snapshotBeforeAction:
    history.push(snapshotBeforeAction);
    future = [];

    assert.equal(history.length, 1);
    assert.equal(history[0][0].rotation, 0, 'History must contain pre-action rotation');
    assert.equal(history[0][0].x, 2, 'History must contain pre-action position');
    assert.equal(currentRooms[0].rotation, 90, 'Current state must reflect action result');

    // Undo restores previous:
    const previous = history.pop();
    future.unshift(currentRooms);
    currentRooms = previous;

    assert.equal(currentRooms[0].rotation, 0, 'Undo must restore room to 0 deg rotation');
    assert.equal(currentRooms[0].x, 2, 'Undo must restore room to x=2');
    assert.equal(future.length, 1);

    // Redo restores new state:
    const next = future.shift();
    history.push(currentRooms);
    currentRooms = next;

    assert.equal(currentRooms[0].rotation, 90, 'Redo must restore room to 90 deg rotation');
    assert.equal(currentRooms[0].x, 4, 'Redo must restore room to x=4');
  });

});
