import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePromptRequirements } from '../src/services/promptParser.js';
import { generateProceduralLayout } from '../src/services/layoutGenerator.js';
import { doRoomsOverlap, getRoomBoundingBox } from '../src/services/architecturalRules.js';

test('ArchAI Product Rebuild: Multi-Prompt Reliability & Rule Verification', async (t) => {
  // =========================================================================
  // TEST A: 20x30 ft single-floor house
  // =========================================================================
  await t.test('Test A: 20x30 ft single-floor house with one bedroom, open kitchen, living room, bathroom and parking', () => {
    const prompt = '20 x 30 ft single-floor house with one bedroom, open kitchen, living room, bathroom and parking.';
    const { requirements } = parsePromptRequirements(prompt);

    assert.equal(requirements.plot.width, 20);
    assert.equal(requirements.plot.length, 30);
    assert.equal(requirements.plot.totalAreaSqFt, 600);
    assert.equal(requirements.floors, 1, 'Must be single-floor');
    assert.equal(requirements.bedrooms, 1, 'Must have 1 bedroom');
    assert.equal(requirements.kitchen.type, 'open', 'Must be open kitchen');
    assert.equal(requirements.parking.required, true, 'Parking must be required');

    const layout = generateProceduralLayout(requirements);
    assert.equal(layout.status, 'confirmed');
    assert.equal(layout.validation.isValid, true, 'Geometry must be valid');

    const roomTypes = layout.rooms.map(r => r.type);
    assert.ok(roomTypes.includes('parking'), 'Must contain parking');
    assert.ok(roomTypes.includes('living_room'), 'Must contain living room');
    assert.ok(roomTypes.includes('kitchen'), 'Must contain kitchen');
    assert.ok(roomTypes.includes('master_bedroom'), 'Must contain bedroom');
    assert.ok(roomTypes.includes('bathroom'), 'Must contain bathroom');

    // Verify kitchen is actual geometry with realistic area
    const kitchen = layout.rooms.find(r => r.type === 'kitchen');
    assert.ok(kitchen.area >= 50, 'Kitchen must have realistic functional area');
    assert.equal(kitchen.name, 'Open Kitchen');

    // Verify boundary containment and zero overlaps
    for (const r of layout.rooms) {
      const box = getRoomBoundingBox(r);
      assert.ok(box.minX >= 0 && box.maxX <= 20, `${r.name} within X bounds`);
      assert.ok(box.minY >= 0 && box.maxY <= 30, `${r.name} within Y bounds`);
    }
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        assert.equal(doRoomsOverlap(layout.rooms[i], layout.rooms[j]), false, `${layout.rooms[i].name} and ${layout.rooms[j].name} must not overlap`);
      }
    }
  });

  // =========================================================================
  // TEST B: 30x40 ft two-floor Indian house
  // =========================================================================
  await t.test('Test B: 30x40 ft north-facing two-floor Indian house with ground-floor parking, open kitchen, living and dining, master bedroom with attached bathroom, common washroom, and first-floor bedroom with attached bathroom and balcony', () => {
    const prompt = '30 x 40 ft north-facing two-floor Indian house with ground-floor parking, open kitchen, living and dining, master bedroom with attached bathroom, common washroom, and first-floor bedroom with attached bathroom and balcony.';
    const { requirements } = parsePromptRequirements(prompt);

    assert.equal(requirements.plot.width, 30);
    assert.equal(requirements.plot.length, 40);
    assert.equal(requirements.plot.totalAreaSqFt, 1200);
    assert.equal(requirements.floors, 2, 'Must detect two floors');
    assert.equal(requirements.facing.toLowerCase(), 'north', 'Must be North-facing');
    assert.equal(requirements.parking.required, true, 'Parking required');
    assert.equal(requirements.kitchen.type, 'open', 'Kitchen must be open');
    assert.equal(requirements.balcony.required, true, 'Balcony required');
    assert.equal(requirements.bedrooms, 2, 'Must have 2 bedrooms (master + first-floor)');
    assert.equal(requirements.bathrooms, 3, 'Must have 3 bathrooms (attached GF + common washroom + attached FF)');

    const layout = generateProceduralLayout(requirements);
    assert.equal(layout.status, 'confirmed');
    assert.equal(layout.validation.isValid, true);

    const gfRooms = layout.rooms.filter(r => r.level === 0);
    const ffRooms = layout.rooms.filter(r => r.level === 1);

    // Ground floor room verification
    assert.ok(gfRooms.some(r => r.type === 'parking'), 'GF must have parking');
    assert.ok(gfRooms.some(r => r.type === 'staircase'), 'GF must have staircase');
    assert.ok(gfRooms.some(r => r.type === 'living_room'), 'GF must have living room');
    assert.ok(gfRooms.some(r => r.type === 'dining'), 'GF must have dining');
    assert.ok(gfRooms.some(r => r.type === 'kitchen'), 'GF must have open kitchen');
    assert.ok(gfRooms.some(r => r.type === 'master_bedroom'), 'GF must have master bedroom');
    assert.ok(gfRooms.some(r => r.name.toLowerCase().includes('attached')), 'GF must have attached bath');
    assert.ok(gfRooms.some(r => r.name.toLowerCase().includes('washroom') || r.name.toLowerCase().includes('common')), 'GF must have common washroom');

    // First floor room verification
    assert.ok(ffRooms.some(r => r.type === 'staircase'), 'FF must have staircase landing');
    assert.ok(ffRooms.some(r => r.type === 'balcony'), 'FF must have front balcony');
    assert.ok(ffRooms.some(r => r.type === 'bedroom'), 'FF must have bedroom 2');
    assert.ok(ffRooms.some(r => r.name.toLowerCase().includes('attached')), 'FF must have attached bathroom for bedroom 2');

    // Staircase vertical alignment check
    const gfStairs = gfRooms.find(r => r.type === 'staircase');
    const ffStairs = ffRooms.find(r => r.type === 'staircase');
    assert.equal(gfStairs.x, ffStairs.x, 'Staircases must be identically aligned in X');
    assert.equal(gfStairs.y, ffStairs.y, 'Staircases must be identically aligned in Y');
    assert.equal(gfStairs.width, ffStairs.width, 'Staircases must have matching width');
    assert.equal(gfStairs.length, ffStairs.length, 'Staircases must have matching length');

    // Zero overlaps on both floors
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        const r1 = layout.rooms[i];
        const r2 = layout.rooms[j];
        if (r1.level === r2.level) {
          assert.equal(doRoomsOverlap(r1, r2), false, `${r1.name} and ${r2.name} on Floor ${r1.level} must not overlap`);
        }
      }
    }
  });

  // =========================================================================
  // TEST C: 24x40 ft compact house with NO PARKING
  // =========================================================================
  await t.test('Test C: 24x40 ft compact house with two bedrooms, closed kitchen, living room and no parking', () => {
    const prompt = '24 x 40 ft compact house with two bedrooms, closed kitchen, living room and no parking.';
    const { requirements } = parsePromptRequirements(prompt);

    assert.equal(requirements.plot.width, 24);
    assert.equal(requirements.plot.length, 40);
    assert.equal(requirements.plot.totalAreaSqFt, 960);
    assert.equal(requirements.floors, 1, 'Must be single-floor');
    assert.equal(requirements.bedrooms, 2, 'Must have 2 bedrooms');
    assert.equal(requirements.kitchen.type, 'closed', 'Must be closed kitchen');
    assert.equal(requirements.parking.required, false, 'Parking must NOT be required');

    const layout = generateProceduralLayout(requirements);
    assert.equal(layout.status, 'confirmed');
    assert.equal(layout.validation.isValid, true);

    const roomTypes = layout.rooms.map(r => r.type);
    assert.equal(roomTypes.includes('parking'), false, 'Must NOT contain any parking room!');

    const bedrooms = layout.rooms.filter(r => r.type === 'master_bedroom' || r.type === 'bedroom');
    assert.equal(bedrooms.length, 2, 'Must contain exactly 2 bedrooms');

    // Check that bedrooms have realistic, comfortable dimensions (depth >= 10 ft)
    for (const b of bedrooms) {
      assert.ok(b.length >= 10, `${b.name} length (${b.length} ft) must be at least 10 ft, not a cramped tube`);
      assert.ok(b.width >= 10, `${b.name} width (${b.width} ft) must be at least 10 ft`);
      assert.ok(b.area >= 110, `${b.name} area (${b.area} sq ft) must be at least 110 sq ft`);
    }

    // Closed kitchen check
    const kitchen = layout.rooms.find(r => r.type === 'kitchen');
    assert.ok(kitchen, 'Kitchen must exist');
    assert.equal(kitchen.name, 'Closed Kitchen');
    assert.ok(kitchen.area >= 60, 'Kitchen must have realistic area');
  });

  // =========================================================================
  // TEST D: Distinctness between different prompts
  // =========================================================================
  await t.test('Test D: Different prompts produce distinct room schedules and geometries', () => {
    const pA = '20 x 30 ft single-floor house with one bedroom, open kitchen, living room, bathroom and parking.';
    const pB = '30 x 40 ft north-facing two-floor Indian house with ground-floor parking, open kitchen, living and dining, master bedroom with attached bathroom, common washroom, and first-floor bedroom with attached bathroom and balcony.';
    const pC = '24 x 40 ft compact house with two bedrooms, closed kitchen, living room and no parking.';

    const lA = generateProceduralLayout(parsePromptRequirements(pA).requirements);
    const lB = generateProceduralLayout(parsePromptRequirements(pB).requirements);
    const lC = generateProceduralLayout(parsePromptRequirements(pC).requirements);

    // Plot sizes must be distinct
    assert.notEqual(lA.plot.totalAreaSqFt, lB.plot.totalAreaSqFt);
    assert.notEqual(lB.plot.totalAreaSqFt, lC.plot.totalAreaSqFt);
    assert.notEqual(lA.plot.totalAreaSqFt, lC.plot.totalAreaSqFt);

    // Room counts must be distinct
    assert.notEqual(lA.rooms.length, lB.rooms.length);
    assert.notEqual(lB.rooms.length, lC.rooms.length);

    // Floor counts must be distinct
    assert.equal(lA.metadata.floorsCount, 1);
    assert.equal(lB.metadata.floorsCount, 2);
    assert.equal(lC.metadata.floorsCount, 1);

    // Parking presence must differ
    assert.ok(lA.rooms.some(r => r.type === 'parking'));
    assert.ok(lB.rooms.some(r => r.type === 'parking'));
    assert.equal(lC.rooms.some(r => r.type === 'parking'), false);
  });
});
