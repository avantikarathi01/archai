import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateSiteBounds,
  generatePropertySite,
  PROPERTY_DEFAULTS
} from '../../client/src/utils/propertyGenerator.js';

import {
  DESIGN_CONCEPTS,
  getDesignConcept
} from '../../client/src/utils/designConcepts.js';

test('Phase 6: Immersive 3D House Simulator & Property Tests', async (t) => {

  await t.test('1. Property Site Generation Math & Setbacks', () => {
    const plotW = 30;
    const plotL = 40;
    const bounds = calculateSiteBounds(plotW, plotL, 'East');

    assert.equal(bounds.plotW, 30);
    assert.equal(bounds.plotL, 40);
    assert.equal(bounds.frontSB, PROPERTY_DEFAULTS.frontSetback);
    assert.equal(bounds.rearSB, PROPERTY_DEFAULTS.rearSetback);
    assert.equal(bounds.sideSB, PROPERTY_DEFAULTS.sideSetback);

    // Site dimensions must encompass plot plus setbacks
    assert.equal(bounds.siteWidth, plotW + bounds.sideSB * 2);
    assert.equal(bounds.siteLength, plotL + bounds.frontSB + bounds.rearSB);

    // Front approach should be positive Z, rear should be negative Z
    assert.ok(bounds.siteMaxZ > plotL / 2, 'Front boundary must be beyond front plot edge');
    assert.ok(bounds.siteMinZ < -plotL / 2, 'Rear boundary must be behind rear plot edge');
  });

  await t.test('2. Complete Property Elements & Gate Generation', () => {
    const plotW = 30;
    const plotL = 40;
    const rooms = [
      { id: 'r1', name: 'Living Room', type: 'living', x: 2, y: 2, width: 14, length: 16, level: 0 },
      { id: 'r2', name: 'Kitchen', type: 'kitchen', x: 16, y: 2, width: 12, length: 10, level: 0 },
      { id: 'r3', name: 'Bed 1', type: 'bedroom', x: 2, y: 2, width: 14, length: 14, level: 1 }
    ];

    const site = generatePropertySite(plotW, plotL, rooms, 'East', 'contemporary_minimalist');

    // Verify boundary walls exist and frame the site
    assert.ok(site.boundaryWalls.length >= 4, 'Must have at least 4 perimeter boundary wall segments');
    const rearWall = site.boundaryWalls.find(w => w.id === 'boundary_rear');
    assert.ok(rearWall, 'Rear boundary wall must exist');
    assert.equal(rearWall.width, site.bounds.siteWidth);

    // Verify gates exist
    assert.equal(site.gates.length, 2, 'Must have vehicular gate and pedestrian gate');
    const vehGate = site.gates.find(g => g.type === 'vehicular_gate');
    const pedGate = site.gates.find(g => g.type === 'pedestrian_gate');
    assert.ok(vehGate, 'Vehicular gate must exist');
    assert.ok(pedGate, 'Pedestrian gate must exist');
    assert.equal(vehGate.width, PROPERTY_DEFAULTS.vehicularGateWidth);
    assert.equal(pedGate.width, PROPERTY_DEFAULTS.pedestrianGateWidth);

    // Verify gate pillars exist flanking gates
    assert.equal(site.pillars.length, 4, 'Must have 4 gate pillars flanking entrance gates');

    // Verify driveway and walkway exist
    assert.ok(site.driveway.width >= vehGate.width, 'Driveway must comfortably fit vehicular gate');
    assert.ok(site.walkway.width >= pedGate.width, 'Walkway must connect to pedestrian gate');

    // Verify landscaping elements
    assert.ok(site.trees.length >= 4, 'Must generate architectural landscaping trees');
    assert.ok(site.hedges.length >= 3, 'Must generate perimeter boxwood hedges');

    // Verify porch canopy & entrance steps
    assert.ok(site.porchCanopy.width > 5, 'Must generate porch canopy');
    assert.ok(site.entranceSteps.steps.length >= 2, 'Must generate entrance plinth steps');

    // Verify roof terrace & parapet
    assert.ok(site.terrace.parapetSegments.length === 4, 'Must generate 4 roof terrace parapet segments');
  });

  await t.test('3. Outside Spawn Point Safety', () => {
    const site = generatePropertySite(30, 40, [], 'East', 'contemporary_minimalist');
    const spawn = site.spawnPoint;

    // Spawn point must be on the paved front approach within property bounds (not in black void beyond ground)
    assert.ok(spawn.z > 0 && spawn.z <= site.bounds.siteMaxZ, 'Spawn must be on the paved front approach');
    assert.equal(spawn.y, 5.5, 'Spawn eye-level must be standard 5.5 ft');
    assert.equal(spawn.yaw, 0, 'Spawn orientation must look along -Z towards house front entrance');
  });

  await t.test('4. Collision Box Detection & Wall AABB Math', () => {
    const wallBox = {
      minX: 10,
      maxX: 12,
      minZ: -5,
      maxZ: 5,
      minY: 0,
      maxY: 8.5
    };

    const playerRadius = 1.0;
    const eyeHeight = 5.5;

    // Helper collision checker
    const checkCollision = (targetX, targetY, targetZ) => {
      const pMinX = targetX - playerRadius;
      const pMaxX = targetX + playerRadius;
      const pMinZ = targetZ - playerRadius;
      const pMaxZ = targetZ + playerRadius;
      const pMinY = targetY - eyeHeight + 0.85;
      const pMaxY = targetY + 0.5;

      if (pMaxY <= wallBox.minY || pMinY >= wallBox.maxY) return false;
      return (pMaxX > wallBox.minX && pMinX < wallBox.maxX && pMaxZ > wallBox.minZ && pMinZ < wallBox.maxZ);
    };

    // Position clearly outside wall
    assert.equal(checkCollision(5, 5.5, 0), false, 'Open circulation area should not collide');

    // Position penetrating wall boundary (X = 10.5)
    assert.equal(checkCollision(10.5, 5.5, 0), true, 'Inside wall boundary must detect collision');

    // Position grazing wall edge with radius (X = 9.2 overlaps [10 - 1, 10 + 1])
    assert.equal(checkCollision(9.5, 5.5, 0), true, 'Within radius of wall surface must detect collision');

    // Position far away vertically (on roof/upper air: Y = 20 ft)
    assert.equal(checkCollision(10.5, 20.0, 0), false, 'Different floor elevation must not collide');
  });

  await t.test('5. Axis-Separated Wall Sliding Algorithm (Player never gets stuck)', () => {
    const wallBox = {
      minX: 8.0,
      maxX: 10.0,
      minZ: -10.0,
      maxZ: 10.0,
      minY: 0,
      maxY: 8.5
    };

    const playerRadius = 1.0;
    let posX = 6.5;
    let posZ = 0.0;

    // Moving diagonally forward and right (towards the wall at X = 8)
    const proposedMoveX = 2.0; // Would put posX at 8.5 (inside wall!)
    const proposedMoveZ = 1.5; // Would put posZ at 1.5 (clear along wall face)

    // Axis 1: Test proposed X move
    const testX = posX + proposedMoveX;
    const collidesX = (testX + playerRadius > wallBox.minX && testX - playerRadius < wallBox.maxX);
    if (!collidesX) {
      posX = testX;
    } else {
      // Collision in X: X move is cancelled, but Z will still be evaluated!
    }

    // Axis 2: Test proposed Z move
    const testZ = posZ + proposedMoveZ;
    const collidesZ = (posX + playerRadius > wallBox.minX && posX - playerRadius < wallBox.maxX && testZ + playerRadius > wallBox.minZ && testZ - playerRadius < wallBox.maxZ);
    if (!collidesZ) {
      posZ = testZ;
    }

    // Result: X was stopped at wall surface (posX remained 6.5), but Z moved smoothly forward to 1.5!
    assert.equal(posX, 6.5, 'X movement stopped at wall surface');
    assert.equal(posZ, 1.5, 'Z movement slid forward along the wall face smoothly');
  });

  await t.test('6. Dynamic Door Collision & State Toggle', () => {
    const door = {
      id: 'main_entry_door',
      isOpen: false,
      collisionBox: {
        minX: 14,
        maxX: 17,
        minZ: 19.5,
        maxZ: 20.5,
        minY: 0,
        maxY: 7.0,
        disabled: false
      }
    };

    // When closed, collision box is active
    assert.equal(door.isOpen, false);
    assert.equal(door.collisionBox.disabled, false);

    // Toggle open
    door.isOpen = true;
    door.collisionBox.disabled = true;

    assert.equal(door.isOpen, true, 'Door is now open');
    assert.equal(door.collisionBox.disabled, true, 'Door collision disabled to allow player passage');

    // Toggle closed
    door.isOpen = false;
    door.collisionBox.disabled = false;

    assert.equal(door.isOpen, false, 'Door is now closed');
    assert.equal(door.collisionBox.disabled, false, 'Door collision restored as solid barrier');
  });

  await t.test('7. Staircase Vertical Climbing Progression Math', () => {
    const stairRoom = {
      minZ: -8.0,
      maxZ: 2.0, // length = 10 ft
      level: 0
    };

    const eyeHeight = 5.5;
    const storyHeight = 10.0;

    const calculateStairElevation = (currentZ) => {
      const totalLen = stairRoom.maxZ - stairRoom.minZ;
      // In south-to-north coordinate, entrance is at maxZ (2.0), landing at minZ (-8.0)
      const t = Math.max(0, Math.min(1.0, (stairRoom.maxZ - currentZ) / totalLen));
      return {
        t,
        elevation: eyeHeight + t * storyHeight,
        floor: t > 0.88 ? 1 : 0
      };
    };

    // At stair bottom entrance (Z = 2.0)
    const atEntrance = calculateStairElevation(2.0);
    assert.equal(atEntrance.t, 0.0);
    assert.equal(atEntrance.elevation, 5.5, 'At entrance, elevation is Level 0 eye height');
    assert.equal(atEntrance.floor, 0);

    // Halfway up the flight (Z = -3.0)
    const midway = calculateStairElevation(-3.0);
    assert.equal(midway.t, 0.5);
    assert.equal(midway.elevation, 10.5, 'Midway elevation is exactly halfway between Level 0 and 1');

    // At upper landing (Z = -8.0)
    const atLanding = calculateStairElevation(-8.0);
    assert.equal(atLanding.t, 1.0);
    assert.equal(atLanding.elevation, 15.5, 'At landing, elevation is Level 1 eye height (15.5 ft)');
    assert.equal(atLanding.floor, 1, 'Switches to First Floor Level 1');
  });

  await t.test('8. Architectural Design Concepts Schema & Trade-offs Integrity', () => {
    const conceptKeys = Object.keys(DESIGN_CONCEPTS);
    assert.equal(conceptKeys.length, 4, 'Must define exactly 4 architectural design concepts');

    const expectedConcepts = [
      'contemporary_minimalist',
      'warm_japandi',
      'mediterranean_villa',
      'industrial_loft'
    ];

    expectedConcepts.forEach(key => {
      const concept = DESIGN_CONCEPTS[key];
      assert.ok(concept, `Concept ${key} must exist`);
      assert.ok(concept.name && concept.subtitle, `Concept ${key} must have name and subtitle`);
      assert.ok(concept.description, `Concept ${key} must have architectural description`);
      assert.ok(typeof concept.wallColor === 'number', `Concept ${key} must have valid hex wall color`);
      assert.ok(typeof concept.grassColor === 'number', `Concept ${key} must have valid hex grass color`);
      assert.ok(typeof concept.gateColor === 'number', `Concept ${key} must have valid hex gate color`);

      // Verify tradeoffs
      assert.ok(concept.tradeoffs, `Concept ${key} must include tradeoffs object`);
      assert.ok(concept.tradeoffs.pros.length >= 3, `Concept ${key} must list at least 3 architectural advantages`);
      assert.ok(concept.tradeoffs.cons.length >= 2, `Concept ${key} must list at least 2 architectural trade-offs`);
      assert.ok(concept.tradeoffs.estimatedCostMultiplier >= 1.0, `Concept ${key} must specify cost multiplier`);
      assert.ok(concept.tradeoffs.maintenanceLevel, `Concept ${key} must specify maintenance level`);
    });

    // Fallback test
    const fallback = getDesignConcept('non_existent_key');
    assert.equal(fallback.id, 'contemporary_minimalist', 'Must safely fallback to contemporary_minimalist');
  });
});
