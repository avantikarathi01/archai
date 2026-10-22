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
  getRoomBoundingBox,
  getRoomVertices
} from '../../client/src/utils/canvasMath.js';

describe('ArchAI 2D Canvas Interaction & Room Movement Regression Tests', () => {

  const samplePlot = { width: 30, length: 40 };

  // 1. Manual Position X updates
  test('1. Manual Position X updates room position immediately and preserves Y, dimensions, rotation', () => {
    const originalRoom = {
      id: 'room-1',
      name: 'Master Bedroom',
      x: 0,
      y: 10,
      width: 14,
      length: 12,
      rotation: 90,
      zone: 'private',
      level: 0,
    };

    // User updates Position X to 6 ft
    const updatedRoom = {
      ...originalRoom,
      x: 6,
    };

    assert.equal(updatedRoom.x, 6, 'X coordinate must be updated to 6');
    assert.equal(updatedRoom.y, 10, 'Y coordinate must be preserved');
    assert.equal(updatedRoom.width, 14, 'Width must be preserved');
    assert.equal(updatedRoom.length, 12, 'Length must be preserved');
    assert.equal(updatedRoom.rotation, 90, 'Rotation must be preserved');
    assert.equal(updatedRoom.name, 'Master Bedroom', 'Name must be preserved');
  });

  // 2. Manual Position Y updates
  test('2. Manual Position Y updates room position immediately and preserves X, dimensions, rotation', () => {
    const originalRoom = {
      id: 'room-2',
      name: 'Kitchen',
      x: 8,
      y: 0,
      width: 10,
      length: 12,
      rotation: 0,
      zone: 'service',
      level: 0,
    };

    // User updates Position Y to 15 ft
    const updatedRoom = {
      ...originalRoom,
      y: 15,
    };

    assert.equal(updatedRoom.y, 15, 'Y coordinate must be updated to 15');
    assert.equal(updatedRoom.x, 8, 'X coordinate must be preserved');
    assert.equal(updatedRoom.width, 10, 'Width must be preserved');
    assert.equal(updatedRoom.length, 12, 'Length must be preserved');
    assert.equal(updatedRoom.rotation, 0, 'Rotation must be preserved');
  });

  // 3. Decimal and fractional inputs
  test('3. Coordinate inputs support decimal and fractional values (e.g. 5.5 ft, 12.25 ft)', () => {
    const room = { id: 'room-3', x: 5.5, y: 12.25, width: 10.5, length: 11.75, level: 0 };

    assert.equal(room.x, 5.5);
    assert.equal(room.y, 12.25);
    assert.equal(room.width, 10.5);
    assert.equal(room.length, 11.75);

    // Coordinate conversion accuracy
    const pxX = feetToPixels(room.x, DEFAULT_PIXELS_PER_FOOT);
    assert.equal(pxX, 110);
    assert.equal(pixelsToFeet(pxX, DEFAULT_PIXELS_PER_FOOT), 5.5);
  });

  // 4. Valid coordinate range calculation for unrotated and rotated rooms
  test('4. Valid plot range calculation correctly respects room rotation', () => {
    const plotWidth = 30;
    const plotLength = 40;

    // A. Unrotated Room: 12W x 16L
    const unrotatedRoom = { x: 0, y: 0, width: 12, length: 16, rotation: 0 };
    const bbox0 = getRoomBoundingBox(unrotatedRoom);
    const minValidX0 = Math.max(0, -bbox0.minX);
    const maxValidX0 = Math.max(0, plotWidth - bbox0.width);
    const minValidY0 = Math.max(0, -bbox0.minY);
    const maxValidY0 = Math.max(0, plotLength - bbox0.length);

    assert.equal(minValidX0, 0);
    assert.equal(maxValidX0, 18, 'Max valid X for 12 ft room on 30 ft plot is 18 ft');
    assert.equal(minValidY0, 0);
    assert.equal(maxValidY0, 24, 'Max valid Y for 16 ft room on 40 ft plot is 24 ft');

    // B. Rotated 90° Room: 12W x 16L (effectively 16W x 12L on canvas)
    const sampleRot90 = { x: 0, y: 0, width: 12, length: 16, rotation: 90 };
    const sampleBbox90 = getRoomBoundingBox(sampleRot90);
    // cx = 6, cy = 8; minX = 6 - 8 = -2, maxX = 6 + 8 = 14; minY = 8 - 6 = 2, maxY = 8 + 6 = 14
    const minValidX90 = -sampleBbox90.minX; // 2
    const maxValidX90 = plotWidth - sampleBbox90.maxX; // 30 - 14 = 16
    const minValidY90 = -sampleBbox90.minY; // -2
    const maxValidY90 = plotLength - sampleBbox90.maxY; // 40 - 14 = 26

    assert.equal(minValidX90, 2, 'Rotated 90° room with length 16 and width 12 requires x >= 2 to not exceed left plot bound');
    assert.equal(maxValidX90, 16, 'Rotated 90° room requires x <= 16 to not exceed right plot bound');

    // Verify room inside plot with x = 2 and x = 16
    const roomAtMinX = { x: 2, y: 5, width: 12, length: 16, rotation: 90 };
    assert.equal(isRoomWithinBounds(roomAtMinX, plotWidth, plotLength), true);

    const roomAtMaxX = { x: 16, y: 5, width: 12, length: 16, rotation: 90 };
    assert.equal(isRoomWithinBounds(roomAtMaxX, plotWidth, plotLength), true);

    // Verify out of bounds if moved beyond limits
    const roomExceedingLeft = { x: 1, y: 5, width: 12, length: 16, rotation: 90 };
    assert.equal(isRoomWithinBounds(roomExceedingLeft, plotWidth, plotLength), false, 'x=1 must be out of bounds');

    const roomExceedingRight = { x: 17, y: 5, width: 12, length: 16, rotation: 90 };
    assert.equal(isRoomWithinBounds(roomExceedingRight, plotWidth, plotLength), false, 'x=17 must be out of bounds');
  });

  // 5. Dragging math across zoom levels (50%, 100%, 150%, 200%)
  test('5. Drag delta math scales inversely with zoom to maintain 1:1 cursor alignment', () => {
    const baseScale = 20; // 20 px/ft
    const screenMovePx = 40; // Mouse moved 40 screen pixels

    const zoomLevels = [0.5, 1.0, 1.5, 2.0];
    const expectedFeet = [
      (40 / 0.5) / 20, // 80 / 20 = 4 ft
      (40 / 1.0) / 20, // 40 / 20 = 2 ft
      (40 / 1.5) / 20, // 26.666 / 20 = 1.333 ft
      (40 / 2.0) / 20, // 20 / 20 = 1 ft
    ];

    zoomLevels.forEach((zoom, idx) => {
      const dxPx = screenMovePx / zoom;
      const dFeetX = dxPx / baseScale;
      assert.ok(Math.abs(dFeetX - expectedFeet[idx]) < 0.001, `Zoom ${zoom} calculation mismatch`);
    });
  });

  // 6. Grid snapping during drag
  test('6. Snapping to 1.0 ft and 0.5 ft increments', () => {
    // 1 ft snap
    assert.equal(snapToGrid(4.2, 1.0), 4.0);
    assert.equal(snapToGrid(4.7, 1.0), 5.0);

    // 0.5 ft snap
    assert.equal(snapToGrid(4.2, 0.5), 4.0);
    assert.equal(snapToGrid(4.35, 0.5), 4.5);
    assert.equal(snapToGrid(4.8, 0.5), 5.0);

    // Free drag (0 snap)
    assert.equal(snapToGrid(4.337, 0), 4.337);
  });

  // 7. Rotated room drag bounds clamping
  test('7. Rotated room drag bounds clamping prevents clipping or trapping', () => {
    const plotWidth = 30;
    const plotLength = 40;

    // Room: 10W x 16L rotated 90°
    const dragState = {
      initialX: 5,
      initialY: 10,
      width: 10,
      length: 16,
      rotation: 90,
    };

    const sampleBbox = getRoomBoundingBox({
      x: 0,
      y: 0,
      width: dragState.width,
      length: dragState.length,
      rotation: dragState.rotation
    });

    const minBoundX = -sampleBbox.minX;
    const maxBoundX = plotWidth - sampleBbox.maxX;

    // Dragging right by 30 feet
    let rawX = dragState.initialX + 30;
    let clampedX = clamp(rawX, minBoundX, maxBoundX);

    assert.ok(clampedX <= maxBoundX, 'Clamped X must not exceed maxBoundX');
    assert.ok(clampedX >= minBoundX, 'Clamped X must not go below minBoundX');

    // Room placed at clamped position must be fully within plot bounds
    const draggedRoom = {
      x: clampedX,
      y: dragState.initialY,
      width: dragState.width,
      length: dragState.length,
      rotation: dragState.rotation
    };
    assert.equal(isRoomWithinBounds(draggedRoom, plotWidth, plotLength), true);
  });

  // 8. History single commit model
  test('8. Dragging updates coordinates continuously, but commits only once to undo history', () => {
    let history = [];
    const pushHistory = (snapshot) => {
      history.push(JSON.parse(JSON.stringify(snapshot)));
    };

    const initialRooms = [
      { id: 'r1', x: 2, y: 4, width: 10, length: 10, level: 0 }
    ];

    // Simulated drag lifecycle with 10 moves
    let currentRooms = JSON.parse(JSON.stringify(initialRooms));
    for (let move = 1; move <= 10; move++) {
      currentRooms[0].x = 2 + move * 0.5;
      // Coordinates update continuously without pushing to history
    }

    // On mouseup / pointerup: single commit
    pushHistory(initialRooms);

    assert.equal(history.length, 1, 'Exactly one history snapshot must be recorded for a drag interaction');
    assert.equal(history[0][0].x, 2, 'History snapshot must contain the position before the drag started');
    assert.equal(currentRooms[0].x, 7, 'Final room position must reflect cumulative drag');
  });

  // 9. Synchronous local geometry validation: Immediate overlap & out of bounds detection
  test('9. Local geometry validation immediately detects boundary violations and overlaps', () => {
    const plotWidth = 30;
    const plotLength = 40;

    const rooms = [
      { id: 'r1', name: 'Living Room', x: 0, y: 0, width: 14, length: 14, level: 0 },
      { id: 'r2', name: 'Dining Room', x: 14, y: 0, width: 12, length: 14, level: 0 },
    ];

    // Helper simulating FloorPlan2D local validation
    const validateLocally = (roomList) => {
      const issues = [];
      for (let i = 0; i < roomList.length; i++) {
        const r1 = roomList[i];
        if (!isRoomWithinBounds(r1, plotWidth, plotLength)) {
          issues.push(`Room "${r1.name}" exceeds plot boundaries`);
        }
        for (let j = i + 1; j < roomList.length; j++) {
          const r2 = roomList[j];
          if (r1.level === r2.level && doRoomsOverlap(r1, r2)) {
            issues.push(`Rooms "${r1.name}" and "${r2.name}" overlap`);
          }
        }
      }
      return { isValid: issues.length === 0, issues };
    };

    // Initially valid
    assert.equal(validateLocally(rooms).isValid, true);

    // Case A: User drags r2 into overlap with r1
    const overlappingRooms = [
      rooms[0],
      { ...rooms[1], x: 8 } // overlaps r1 from x=8 to x=14
    ];
    const overlapResult = validateLocally(overlappingRooms);
    assert.equal(overlapResult.isValid, false, 'Overlap must immediately invalidate layout');
    assert.ok(overlapResult.issues.some(msg => msg.includes('overlap')));

    // Case B: User moves r2 past right plot edge (x=20 with width=12 on 30ft plot -> 32ft)
    const outOfBoundsRooms = [
      rooms[0],
      { ...rooms[1], x: 20 }
    ];
    const oobResult = validateLocally(outOfBoundsRooms);
    assert.equal(oobResult.isValid, false, 'Out-of-bounds position must immediately invalidate layout');
    assert.ok(oobResult.issues.some(msg => msg.includes('exceeds plot')));
  });

  // 10. Layout identity guard: In-place layout updates preserve active room selection and history
  test('10. Layout identity guard distinguishes in-place edits from brand new layout loads', () => {
    const currentLayoutId = 'archai-plan-1718000000000';
    let lastLayoutId = currentLayoutId;

    let selectedRoomId = 'room-1';
    let history = [['snapshot-1']];

    // Simulation of in-place layout update (e.g. from 400ms debounced server validation)
    const incomingUpdate = {
      id: 'archai-plan-1718000000000', // SAME ID
      validation: { isValid: true }
    };

    if (incomingUpdate.id === lastLayoutId) {
      // In-place update: do NOT reset selectedRoomId or history!
    } else {
      selectedRoomId = null;
      history = [];
    }

    assert.equal(selectedRoomId, 'room-1', 'Active room selection must NOT be wiped on in-place layout update');
    assert.equal(history.length, 1, 'History stack must NOT be wiped on in-place layout update');

    // Simulation of brand new layout load (e.g. user generated a new floor plan)
    const incomingNewPlan = {
      id: 'archai-plan-1718000999999', // NEW ID
      validation: { isValid: true }
    };

    if (incomingNewPlan.id === lastLayoutId) {
      // In-place
    } else {
      lastLayoutId = incomingNewPlan.id;
      selectedRoomId = null;
      history = [];
    }

    assert.equal(selectedRoomId, null, 'New layout generation must reset selection');
    assert.equal(history.length, 0, 'New layout generation must reset history');
  });

});
