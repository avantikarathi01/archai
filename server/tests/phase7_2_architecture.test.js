import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePromptRequirements } from '../src/services/promptParser.js';
import { generateProceduralLayout } from '../src/services/layoutGenerator.js';
import { doRoomsOverlap, getRoomBoundingBox } from '../src/services/architecturalRules.js';
import { DESIGN_CONCEPTS, getDesignConcept } from '../../client/src/utils/designConcepts.js';
import { generateRoomFurniture } from '../../client/src/utils/threeMath.js';
import { generatePropertySite, isTreeCollidingWithRooms } from '../../client/src/utils/propertyGenerator.js';

test('ArchAI Phase 7.2: Architectural Logic, Real House Design & 3D Experience', async (t) => {
  const comprehensivePrompt =
    'Design a Modern Indian Contemporary house on a 30x40 ft North-facing plot. ' +
    'Ground floor should have car parking, living room, dining, open kitchen, master bedroom with attached bathroom, ' +
    'small common washroom, and staircase to first floor. ' +
    'First floor must have bedroom 2 with attached bathroom, front balcony, entertainment room, and billiards pool room.';

  let parsedReqs;
  let layout;

  await t.test('1. Natural Language Parser accurately extracts all Phase 7.2 clauses', () => {
    const res = parsePromptRequirements(comprehensivePrompt);
    parsedReqs = res.requirements;

    assert.equal(parsedReqs.plot.width, 30, 'Width must be 30 ft');
    assert.equal(parsedReqs.plot.length, 40, 'Length must be 40 ft');
    assert.equal(parsedReqs.plot.totalAreaSqFt, 1200, 'Total area must be 1200 sq ft');
    assert.equal(parsedReqs.plot.isDimensionsExplicit, true, 'Explicit dimensions confirmed');
    assert.equal(parsedReqs.facing.toLowerCase(), 'north', 'Facing must be North');
    assert.equal(parsedReqs.floors, 2, 'Must detect 2 floors (G+1)');
    assert.equal(parsedReqs.parking.required, true, 'Car parking required');
    assert.equal(parsedReqs.entertainmentRoom, true, 'Entertainment room required');
    assert.equal(parsedReqs.poolRoom, 'billiards', 'Pool room must be parsed as cue-sports billiards');
    assert.equal(parsedReqs.commonWashroom, true, 'Common washroom required');
    assert.equal(parsedReqs.attachedBath, true, 'Attached bathroom required');
  });

  await t.test('2. Procedural Engine generates full comprehensive G+1 layout without room omissions', () => {
    layout = generateProceduralLayout(parsedReqs);

    assert.equal(layout.status, 'confirmed');
    assert.equal(layout.plot.width, 30);
    assert.equal(layout.plot.length, 40);
    assert.equal(layout.metadata.facing.toLowerCase(), 'north');

    const gfRooms = layout.rooms.filter(r => r.level === 0);
    const ffRooms = layout.rooms.filter(r => r.level === 1);

    // Ground floor room verification
    assert.ok(gfRooms.some(r => r.type === 'parking'), 'GF must include Car Parking');
    assert.ok(gfRooms.some(r => r.type === 'staircase'), 'GF must include Staircase');
    assert.ok(gfRooms.some(r => r.type === 'living_room'), 'GF must include Living Room');
    assert.ok(gfRooms.some(r => r.type === 'dining'), 'GF must include Dining');
    assert.ok(gfRooms.some(r => r.type === 'kitchen'), 'GF must include Kitchen');
    assert.ok(gfRooms.some(r => r.name.toLowerCase().includes('washroom') || (r.type === 'bathroom' && r.name.includes('Common'))), 'GF must include Common Washroom');
    assert.ok(gfRooms.some(r => r.type === 'master_bedroom'), 'GF must include Master Bedroom');
    assert.ok(gfRooms.some(r => r.name.toLowerCase().includes('attached')), 'GF must include Attached Bath');

    // First floor room verification
    assert.ok(ffRooms.some(r => r.type === 'entertainment'), 'FF must include Multipurpose Entertainment Room');
    assert.ok(ffRooms.some(r => r.type === 'staircase'), 'FF must include Staircase Landing');
    assert.ok(ffRooms.some(r => r.type === 'balcony'), 'FF must include Front Balcony');
    assert.ok(ffRooms.some(r => r.type === 'bedroom'), 'FF must include Bedroom 2');
    assert.ok(ffRooms.some(r => r.type === 'pool_room'), 'FF must include Billiards / Pool Room');
    assert.ok(ffRooms.some(r => r.name.toLowerCase().includes('attached')), 'FF must include Attached Bath for Bedroom 2');
  });

  await t.test('3. Staircase vertical stacking and alignment between Level 0 and Level 1', () => {
    const gfStairs = layout.rooms.find(r => r.level === 0 && r.type === 'staircase');
    const ffStairs = layout.rooms.find(r => r.level === 1 && r.type === 'staircase');

    assert.ok(gfStairs, 'Ground floor staircase exists');
    assert.ok(ffStairs, 'First floor staircase landing exists');

    assert.equal(gfStairs.x, ffStairs.x, 'Staircase X coordinate must be identically stacked');
    assert.equal(gfStairs.y, ffStairs.y, 'Staircase Y coordinate must be identically stacked');
    assert.equal(gfStairs.width, ffStairs.width, 'Staircase width must match landing width');
    assert.equal(gfStairs.length, ffStairs.length, 'Staircase length must match landing length');
  });

  await t.test('4. Comprehensive Architectural Area Budgeting metrics are calculated', () => {
    const summary = layout.summary;
    assert.ok(summary, 'Layout summary exists');
    assert.equal(summary.plotAreaSqFt, 1200, 'Plot area is 1200 sq ft');
    assert.ok(summary.buildingFootprintSqFt <= 1200, 'Building footprint does not exceed plot area');
    assert.ok(summary.buildingFootprintSqFt > 600, 'Building footprint is realistic');
    assert.ok(summary.groundCoveragePercent > 0 && summary.groundCoveragePercent <= 100, 'Ground coverage percent is realistic');
    assert.ok(summary.openOutdoorGroundSqFt >= 0, 'Open outdoor yard ground area is non-negative');
    assert.ok(summary.usableInteriorCarpetAreaSqFt > 0, 'Carpet area is positive');
    assert.ok(summary.circulationAreaSqFt > 0, 'Circulation area is positive');

    // Per floor breakdown
    assert.ok(summary.floorBreakdown[0], 'Floor 0 breakdown exists');
    assert.ok(summary.floorBreakdown[1], 'Floor 1 breakdown exists');
    assert.ok(summary.floorBreakdown[0].carpetArea > 0, 'Floor 0 has carpet area');
    assert.ok(summary.floorBreakdown[1].carpetArea > 0, 'Floor 1 has carpet area');
  });

  await t.test('5. Geometry Validation: Zero overlaps and strict plot boundary containment', () => {
    const plotW = layout.plot.width;
    const plotL = layout.plot.length;

    // Check boundary containment
    for (const r of layout.rooms) {
      const bbox = getRoomBoundingBox(r);
      assert.ok(bbox.minX >= 0, `Room ${r.name} minX (${bbox.minX}) within plot left boundary`);
      assert.ok(bbox.maxX <= plotW, `Room ${r.name} maxX (${bbox.maxX}) within plot right boundary (${plotW})`);
      assert.ok(bbox.minY >= 0, `Room ${r.name} minY (${bbox.minY}) within plot top boundary`);
      assert.ok(bbox.maxY <= plotL, `Room ${r.name} maxY (${bbox.maxY}) within plot bottom boundary (${plotL})`);
    }

    // Check pairwise non-overlap on same floor
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        const r1 = layout.rooms[i];
        const r2 = layout.rooms[j];
        if (r1.level === r2.level) {
          const overlaps = doRoomsOverlap(r1, r2);
          assert.equal(overlaps, false, `Rooms ${r1.name} and ${r2.name} on Level ${r1.level} must not overlap`);
        }
      }
    }
  });

  await t.test('6. Tree Safety: Site generation guarantees no trees spawn inside house rooms', () => {
    const site = generatePropertySite(30, 40, layout.rooms, 'North', 'contemporary_minimalist');

    assert.ok(site.trees.length > 0, 'Site generated trees');

    for (const tree of site.trees) {
      const collides = isTreeCollidingWithRooms(tree.x, tree.z, layout.rooms, 30, 40, 1.8);
      assert.equal(collides, false, `Tree at (${tree.x}, ${tree.z}) must not collide with any room`);
    }

    // Main gate must be at North side (z close to siteMinZ)
    const mainGate = site.gates.find(g => g.type === 'vehicular_gate') || site.gates[0];
    assert.ok(mainGate, 'Main gate exists');
    assert.ok(mainGate.z < 0, 'Main gate is positioned at North entrance');
    assert.ok(site.spawnPoint.z < mainGate.z, 'Walkthrough spawn point is outside the North gate facing house');
  });

  await t.test('7. 3D Furniture Generation: Generates specialized items for pool room and entertainment room', () => {
    const poolRoom = layout.rooms.find(r => r.type === 'pool_room');
    assert.ok(poolRoom, 'Pool room exists in layout');
    const poolFurn = generateRoomFurniture(poolRoom, 30, 40, 0);

    assert.ok(poolFurn.some(item => item.name === 'pool_table_frame'), 'Generates pool table frame');
    assert.ok(poolFurn.some(item => item.name === 'pool_table_felt'), 'Generates tournament green wool felt');
    assert.ok(poolFurn.some(item => item.name.includes('pool_rail')), 'Generates cushioned bumpers/rails');
    assert.ok(poolFurn.some(item => item.name.includes('pocket')), 'Generates 6 pocket corner castings');
    assert.ok(poolFurn.some(item => item.name.includes('billiard')), 'Generates billiard balls set');
    assert.ok(poolFurn.some(item => item.name.includes('cue_rack')), 'Generates cue rack stand');

    const entertainRoom = layout.rooms.find(r => r.type === 'entertainment');
    assert.ok(entertainRoom, 'Entertainment room exists in layout');
    const entertainFurn = generateRoomFurniture(entertainRoom, 30, 40, 0);

    assert.ok(entertainFurn.some(item => item.name === 'cinema_screen_panel'), 'Generates 85-inch cinema display panel');
    assert.ok(entertainFurn.some(item => item.name === 'cinema_screen_backlight'), 'Generates ambient architectural backlight');
    assert.ok(entertainFurn.some(item => item.name === 'media_credenza'), 'Generates floating media credenza');
    assert.ok(entertainFurn.some(item => item.name.includes('sound_tower')), 'Generates dual acoustic audio towers');
    assert.ok(entertainFurn.some(item => item.name.includes('sectional_sofa')), 'Generates deep sectional plush couch');
  });

  await t.test('8. Architectural Design Concepts Integrity & Aliases', () => {
    assert.equal(Object.keys(DESIGN_CONCEPTS).length, 4, 'Must define exactly 4 architectural design concepts');

    const conceptKeys = ['contemporary_minimalist', 'warm_japandi', 'mediterranean_villa', 'industrial_loft'];
    const expectedNames = [
      'Modern Indian Contemporary',
      'Warm Minimalist',
      'Tropical Modern',
      'Premium Urban Modern'
    ];

    conceptKeys.forEach((key, idx) => {
      const c = DESIGN_CONCEPTS[key];
      assert.ok(c, `Concept ${key} must exist`);
      assert.equal(c.name, expectedNames[idx], `Concept ${key} name matches expected architectural theme`);
      assert.ok(c.description, `Concept ${key} has detailed architectural brief`);
      assert.ok(c.tradeoffs.pros.length >= 2, `Concept ${key} provides pros`);
      assert.ok(c.tradeoffs.cons.length >= 1, `Concept ${key} provides cons`);
      assert.ok(typeof c.tradeoffs.estimatedCostMultiplier === 'number', `Concept ${key} provides cost multiplier`);
    });

    // Test alias resolution
    assert.equal(getDesignConcept('modern_indian_contemporary').name, 'Modern Indian Contemporary');
    assert.equal(getDesignConcept('warm_minimalist').name, 'Warm Minimalist');
    assert.equal(getDesignConcept('tropical_modern').name, 'Tropical Modern');
    assert.equal(getDesignConcept('premium_urban_modern').name, 'Premium Urban Modern');
  });
});
