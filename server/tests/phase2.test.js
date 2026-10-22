import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { parsePromptRequirements } from '../src/services/promptParser.js';
import { generateProceduralLayout } from '../src/services/layoutGenerator.js';
import { validateLayout, doRoomsOverlap, generateRecommendations } from '../src/services/architecturalRules.js';

// ==============================================================
// TEST 1: Missing Plot Dimensions & Provisional Layout Status
// ==============================================================
test('1. Missing Dimensions -> Marked Provisional (User Hinglish Case)', () => {
  const prompt = 'Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK purab mukhi';
  const { requirements } = parsePromptRequirements(prompt);

  // Unconfirmed dimensions
  assert.equal(requirements.plot.totalAreaSqFt, 1200);
  assert.equal(requirements.plot.width, null);
  assert.equal(requirements.plot.length, null);
  assert.equal(requirements.plot.isDimensionsExplicit, false);

  // Clarification question asked
  const dimClarification = requirements.clarifications.find((c) => c.field === 'plotDimensions');
  assert.ok(dimClarification, 'Expected clarification question for missing dimensions');

  // Generate provisional preview
  const layout = generateProceduralLayout(requirements);

  // Layout must be prominently marked provisional
  assert.equal(layout.isProvisional, true, 'Layout must be marked provisional');
  assert.equal(layout.status, 'provisional', 'Status must be "provisional"');
  assert.equal(layout.validation.isProvisional, true);
  assert.equal(layout.validation.status, 'provisional');
  assert.equal(layout.summary.groundCoveragePercent, null, 'Confirmed ground coverage must be null for provisional plot');
  assert.ok(typeof layout.summary.groundCoverageEstimatedPercent === 'number', 'Estimated coverage must be present');

  // Verify room assignments per floor
  const l0Rooms = layout.rooms.filter((r) => r.level === 0);
  const l1Rooms = layout.rooms.filter((r) => r.level === 1);

  const l0Beds = l0Rooms.filter((r) => r.type === 'master_bedroom' || r.type === 'bedroom');
  assert.equal(l0Beds.length, 0, 'Ground floor must have 0 bedrooms');

  const l1Beds = l1Rooms.filter((r) => r.type === 'master_bedroom' || r.type === 'bedroom');
  assert.equal(l1Beds.length, 2, 'First floor must have exactly 2 bedrooms');

  // Verify practical room dimensions (no 13x5 ft hallway bathrooms or 30x12 ft bowling alleys!)
  const bath = l1Rooms.find((r) => r.type === 'bathroom');
  assert.ok(bath);
  const bathRatio = Math.max(bath.width, bath.length) / Math.min(bath.width, bath.length);
  assert.ok(bathRatio <= 1.8, `Bathroom aspect ratio (${bathRatio.toFixed(2)}:1) should be comfortable and <= 1.8:1`);

  const living = l1Rooms.find((r) => r.type === 'living_room');
  assert.ok(living);
  const livingRatio = Math.max(living.width, living.length) / Math.min(living.width, living.length);
  assert.ok(livingRatio <= 2.0, `Living room aspect ratio (${livingRatio.toFixed(2)}:1) should be <= 2.0:1`);

  // Practicality alerts should not have elongated bathroom
  assert.ok(!layout.validation.practicalityAlerts.some((a) => a.includes('Bathroom') && a.includes('elongated')));

  // Staircase access check
  const gStair = l0Rooms.find((r) => r.type === 'corridor' || /stair|foyer/i.test(r.name));
  const uStair = l1Rooms.find((r) => r.type === 'corridor' || /stair|landing|foyer/i.test(r.name));
  assert.ok(gStair, 'Ground floor must contain a vertical staircase / foyer access');
  assert.ok(uStair, 'First floor must contain a staircase landing / foyer access');
});

// ==============================================================
// TEST 2: Confirmed Dimensions -> Confirmed Valid Status
// ==============================================================
test('2. Confirmed 30x40 ft Dimensions -> Marked Confirmed Valid', () => {
  const reqs = {
    plot: {
      width: 30,
      length: 40,
      totalAreaSqFt: 1200,
      isDimensionsExplicit: true,
    },
    floors: 2,
    bedrooms: 2,
    facing: 'east',
    facingSpecified: true,
    floorRequirements: {
      0: { level: 0, name: 'Ground Floor', bedrooms: 0, parking: true, staircase: true },
      1: { level: 1, name: 'First Floor', bedrooms: 2, livingRoom: true, kitchen: true, bathrooms: 1, staircase: true },
    },
  };

  const layout = generateProceduralLayout(reqs);

  assert.equal(layout.isProvisional, false, 'Confirmed layout must not be provisional');
  assert.equal(layout.status, 'confirmed', 'Layout status must be "confirmed"');
  assert.equal(layout.validation.status, 'confirmed_valid');
  assert.equal(layout.validation.isValid, true);
  assert.equal(layout.validation.errors.length, 0);
  assert.ok(typeof layout.summary.groundCoveragePercent === 'number', 'Confirmed ground coverage must be a number');
});

// ==============================================================
// TEST 3: Multi-Floor Boundary & Geometry Verification
// ==============================================================
test('3. Multi-Floor Boundary Checks: Every room on every floor strictly within bounds', () => {
  const reqs = {
    plot: { width: 30, length: 40, totalAreaSqFt: 1200, isDimensionsExplicit: true },
    floors: 2,
    bedrooms: 2,
    floorRequirements: {
      0: { level: 0, name: 'Ground Floor', bedrooms: 0, parking: true, staircase: true },
      1: { level: 1, name: 'First Floor', bedrooms: 2, livingRoom: true, kitchen: true, bathrooms: 1, staircase: true },
    },
  };

  const layout = generateProceduralLayout(reqs);

  for (const r of layout.rooms) {
    assert.ok(r.x >= 0, `Room ${r.name} x is out of bounds: ${r.x}`);
    assert.ok(r.y >= 0, `Room ${r.name} y is out of bounds: ${r.y}`);
    assert.ok(r.x + r.width <= layout.plot.width + 0.05, `Room ${r.name} on Level ${r.level} exceeds plot width`);
    assert.ok(r.y + r.length <= layout.plot.length + 0.05, `Room ${r.name} on Level ${r.level} exceeds plot length`);
    assert.ok(r.width > 0, `Room ${r.name} width must be positive`);
    assert.ok(r.length > 0, `Room ${r.name} length must be positive`);
  }
});

// ==============================================================
// TEST 4: Room Overlap Engine (Same Level vs Different Levels)
// ==============================================================
test('4. Room Overlap Detection: Flags collision on same level, ignores cross-floor', () => {
  // Colliding rooms on same level
  const r1 = { id: 'r1', name: 'Room 1', level: 0, x: 0, y: 0, width: 15, length: 15 };
  const r2 = { id: 'r2', name: 'Room 2', level: 0, x: 10, y: 10, width: 15, length: 15 };
  assert.equal(doRoomsOverlap(r1, r2), true, 'Colliding rooms on same floor must return true');

  // Adjacent rooms sharing a wall (no overlap)
  const r3 = { id: 'r3', name: 'Room 3', level: 0, x: 0, y: 0, width: 10, length: 10 };
  const r4 = { id: 'r4', name: 'Room 4', level: 0, x: 10, y: 0, width: 10, length: 10 };
  assert.equal(doRoomsOverlap(r3, r4), false, 'Adjacent wall-sharing rooms must not overlap');

  // Rooms with identical coordinates but on different floors (no overlap)
  const r5 = { id: 'r5', name: 'Room 5', level: 1, x: 0, y: 0, width: 15, length: 15 };
  assert.equal(doRoomsOverlap(r1, r5), false, 'Rooms on different floors must not overlap');
});

// ==============================================================
// TEST 5: Invalid Room Dimensions & Boundary Violations Detection
// ==============================================================
test('5. Invalid Room Dimensions & Boundary Violations correctly caught by validator', () => {
  const invalidLayout = {
    plot: { width: 30, length: 40, isDimensionsExplicit: true },
    rooms: [
      { id: 'r1', name: 'Neg Dim', level: 0, x: 0, y: 0, width: -10, length: 10, area: 100, type: 'bedroom' },
      { id: 'r2', name: 'Neg Coord', level: 0, x: -5, y: 0, width: 10, length: 10, area: 100, type: 'bedroom' },
      { id: 'r3', name: 'Exceeds Width', level: 0, x: 25, y: 0, width: 10, length: 10, area: 100, type: 'bedroom' },
    ],
  };

  const validation = validateLayout(invalidLayout);
  assert.equal(validation.isValid, false);
  assert.ok(validation.errors.some((e) => e.includes('invalid non-positive dimensions')));
  assert.ok(validation.errors.some((e) => e.includes('outside the plot origin')));
  assert.ok(validation.errors.some((e) => e.includes('exceeds plot width')));
});

// ==============================================================
// TEST 6: Single-floor 1 BHK (20x30 ft) Practical Layout
// ==============================================================
test('6. "1 BHK house on a 20x30 ft plot with one bathroom and closed kitchen."', () => {
  const prompt = '1 BHK house on a 20x30 ft plot with one bathroom and closed kitchen.';
  const { requirements } = parsePromptRequirements(prompt);

  assert.equal(requirements.plot.isDimensionsExplicit, true);
  assert.equal(requirements.bedrooms, 1);
  assert.equal(requirements.bathrooms, 1);
  assert.equal(requirements.kitchen.type, 'closed');

  const layout = generateProceduralLayout(requirements);
  assert.equal(layout.status, 'confirmed');
  assert.equal(layout.validation.isValid, true);

  const beds = layout.rooms.filter((r) => r.type === 'master_bedroom' || r.type === 'bedroom');
  assert.equal(beds.length, 1);
});

// ==============================================================
// TEST 7: Single-floor 3 BHK (40x60 ft) with Parking
// ==============================================================
test('7. "3 BHK house on a 40x60 ft plot with two bathrooms and parking."', () => {
  const prompt = '3 BHK house on a 40x60 ft plot with two bathrooms and parking.';
  const { requirements } = parsePromptRequirements(prompt);

  assert.equal(requirements.plot.isDimensionsExplicit, true);
  assert.equal(requirements.bedrooms, 3);
  assert.equal(requirements.bathrooms, 2);
  assert.equal(requirements.parking.required, true);

  const layout = generateProceduralLayout(requirements);
  assert.equal(layout.status, 'confirmed');
  assert.equal(layout.validation.isValid, true);

  const beds = layout.rooms.filter((r) => r.type === 'master_bedroom' || r.type === 'bedroom');
  assert.equal(beds.length, 3);
});

// ==============================================================
// TEST 8: Two-Storey House with Balcony
// ==============================================================
test('8. "A two-storey house with a balcony on a 30x40 plot."', () => {
  const prompt = 'A two-storey house with a balcony on a 30x40 plot.';
  const { requirements } = parsePromptRequirements(prompt);

  assert.equal(requirements.floors, 2);
  assert.equal(requirements.balcony.required, true);

  const layout = generateProceduralLayout(requirements);
  assert.equal(layout.validation.isValid, true);

  const balcony = layout.rooms.find((r) => r.type === 'balcony');
  assert.ok(balcony);
});

// ==============================================================
// TEST 9: Impossible Layout Handling
// ==============================================================
test('9. Impossible layout returns clear validation error', () => {
  const impossibleReqs = {
    plot: { width: 10, length: 15, totalAreaSqFt: 150 },
    floors: 1,
    bedrooms: 5,
    bathrooms: 4,
    parking: { required: true },
  };

  assert.throws(
    () => generateProceduralLayout(impossibleReqs),
    /Impossible Layout.*requires at least/i
  );
});

// ==============================================================
// TEST 10: HTTP API Endpoints Integration & Status Verification
// ==============================================================
test('10. API HTTP Endpoints integration (/api/generate-design returns status and provisional flags)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // A. Provisional request with only 1200 sq ft
    const provRes = await fetch(`${baseUrl}/api/generate-design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK purab mukhi',
      }),
    });
    assert.equal(provRes.status, 200);
    const provData = await provRes.json();
    assert.equal(provData.layout.isProvisional, true);
    assert.equal(provData.layout.status, 'provisional');

    // B. Confirmed request with explicit dimensions
    const confRes = await fetch(`${baseUrl}/api/generate-design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '2 BHK on 30x40 plot',
      }),
    });
    assert.equal(confRes.status, 200);
    const confData = await confRes.json();
    assert.equal(confData.layout.isProvisional, false);
    assert.equal(confData.layout.status, 'confirmed');
    assert.equal(confData.layout.validation.status, 'confirmed_valid');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
