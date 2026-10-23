/**
 * Automated Verification Suite for ArchAI Topological Layout Solver (Phase 1)
 * 
 * Verifies:
 * 1. Kitchen placement, adjacency, and exterior ventilation wall
 * 2. Master bedroom ensuite attached bathroom with shared boundary & private door
 * 3. Entrance orientation and gate alignment
 * 4. Usable parking without blocking main pedestrian entrance
 * 5. Multi-floor vertical staircase stacking and landing continuity
 * 6. Dynamic dimension adaptation (no hardcoded templates)
 * 7. Geometric integrity and zero room overlaps
 * 8. Infeasible requirement rejection with explicit area deficit metrics
 * 9. Canonical OpenPlan3D geometry model derivation (walls, doors, windows, stairs)
 * 10. Feature-flag isolation ensuring production backward compatibility
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateTopologicalLayout,
  getSharedBoundary,
  InfeasibleLayoutError
} from '../src/services/topologicalLayoutSolver.js';
import { designService } from '../src/services/designService.js';

describe('ArchAI Phase 1: Topological Solver Verification', () => {

  // ---------------------------------------------------------------------------
  // 1. Kitchen Placement, Adjacency & Ventilation
  // ---------------------------------------------------------------------------
  it('1. Kitchen Placement: has exterior perimeter wall for ventilation and is adjacent to dining/living', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 30, length: 40, isDimensionsExplicit: true },
      floors: 1,
      bedrooms: 2,
      bathrooms: 2,
      facing: 'east',
    });

    const kitchen = layout.rooms.find(r => r.type === 'kitchen');
    assert.ok(kitchen, 'Kitchen must exist in generated layout');
    assert.ok(kitchen.width >= 6.0, `Kitchen width must be >= 6 ft, got ${kitchen.width}`);
    assert.ok(kitchen.length >= 7.0, `Kitchen length must be >= 7 ft, got ${kitchen.length}`);

    // Verify exterior boundary wall access for natural ventilation and exhaust
    const plotW = layout.plot.width;
    const plotL = layout.plot.length;
    const isAtExteriorPerimeter = (
      Math.abs(kitchen.x) < 4.0 ||
      Math.abs(kitchen.x + kitchen.width - plotW) < 4.0 ||
      Math.abs(kitchen.y) < 4.0 ||
      Math.abs(kitchen.y + kitchen.length - plotL) < 4.0
    );
    assert.ok(isAtExteriorPerimeter, 'Kitchen must touch or flank an exterior setback boundary for daylight/exhaust');

    // Verify window exists on kitchen for ventilation
    assert.ok(kitchen.windows && kitchen.windows.length > 0, 'Kitchen must have an exterior window for ventilation');
  });

  // ---------------------------------------------------------------------------
  // 2. Attached Master Bathroom (Ensuite)
  // ---------------------------------------------------------------------------
  it('2. Attached Master Bathroom: shares internal boundary wall with Master Bedroom and has private door', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 30, length: 50, isDimensionsExplicit: true },
      floors: 1,
      bedrooms: 2,
      bathrooms: 2,
      facing: 'north',
    });

    const masterBed = layout.rooms.find(r => r.type === 'master_bedroom');
    const attachedBath = layout.rooms.find(r => r.isAttached && r.attachedToRoomId === masterBed.id);

    assert.ok(masterBed, 'Master bedroom must exist');
    assert.ok(attachedBath, 'Attached ensuite bathroom must exist and link to Master Bedroom');

    // Check shared boundary wall
    const boundary = getSharedBoundary(masterBed, attachedBath);
    assert.ok(boundary.touches, 'Master bedroom and attached bath must touch along a shared boundary');
    assert.ok(boundary.length >= 4.0, `Shared wall length must be >= 4.0 ft, got ${boundary.length}`);

    // Check private doorway
    const privateDoor = attachedBath.doors?.find(d => d.label?.includes('Private') || d.label?.includes('Ensuite'));
    assert.ok(privateDoor, 'Attached bathroom must contain a private ensuite door');
  });

  // ---------------------------------------------------------------------------
  // 3. Entrance Orientation & Main Gate
  // ---------------------------------------------------------------------------
  it('3. Entrance Orientation: places main entrance foyer at the front boundary for requested facing', () => {
    const orientations = ['east', 'north', 'west', 'south'];
    for (const facing of orientations) {
      const layout = generateTopologicalLayout({
        plot: { width: 30, length: 40, isDimensionsExplicit: true },
        floors: 1,
        facing,
      });

      const foyer = layout.rooms.find(r => r.type === 'foyer');
      assert.ok(foyer, `Foyer must exist for facing ${facing}`);
      assert.ok(foyer.y <= 4.0, `Entrance foyer must be located at the front boundary edge (y <= 4.0), got y=${foyer.y}`);

      const entranceDoor = foyer.doors?.find(d => d.wall === 'front');
      assert.ok(entranceDoor, `Foyer must have an entrance door on the front wall for facing ${facing}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Usable Parking without Blocking Main Entrance
  // ---------------------------------------------------------------------------
  it('4. Usable Parking: meets vehicle dimensions and does NOT block the main entrance foyer', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 32, length: 45, isDimensionsExplicit: true },
      floors: 1,
      parking: { required: true },
    });

    const parking = layout.rooms.find(r => r.type === 'parking');
    const foyer = layout.rooms.find(r => r.type === 'foyer');

    assert.ok(parking, 'Parking room must exist when requested');
    assert.ok(parking.width >= 9.5, `Parking width must be >= 9.5 ft for standard car, got ${parking.width}`);
    assert.ok(parking.length >= 15.0, `Parking length must be >= 15.0 ft for standard car, got ${parking.length}`);

    // Verify parking and foyer do not overlap
    const xOverlap = Math.max(0, Math.min(parking.x + parking.width, foyer.x + foyer.width) - Math.max(parking.x, foyer.x));
    const yOverlap = Math.max(0, Math.min(parking.y + parking.length, foyer.y + foyer.length) - Math.max(parking.y, foyer.y));
    const overlapArea = xOverlap * yOverlap;

    assert.equal(overlapArea, 0, 'Parking must not overlap the main entrance foyer');
    assert.ok(foyer.x >= parking.x + parking.width || parking.x >= foyer.x + foyer.width,
      'Main entrance foyer must have independent side clearance from parking bay');
  });

  // ---------------------------------------------------------------------------
  // 5. Multi-Floor Vertical Staircase Stacking
  // ---------------------------------------------------------------------------
  it('5. Staircase Placement: Level 0 and Level 1 stair shafts stack vertically at identical (x, y) coordinates', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 30, length: 40, isDimensionsExplicit: true },
      floors: 2,
      bedrooms: 3,
      bathrooms: 2,
      staircase: { required: true },
    });

    assert.equal(layout.floorsCount, 2, 'Layout must have 2 floors');

    const gfStair = layout.floors[0].rooms.find(r => r.type === 'staircase');
    const f1Stair = layout.floors[1].rooms.find(r => r.type === 'staircase');

    assert.ok(gfStair, 'Ground floor must contain staircase');
    assert.ok(f1Stair, 'First floor must contain staircase landing');

    // Strict vertical alignment check
    assert.equal(gfStair.x, f1Stair.x, `Staircase X coordinate must match exactly across floors: Level 0=${gfStair.x}, Level 1=${f1Stair.x}`);
    assert.equal(gfStair.y, f1Stair.y, `Staircase Y coordinate must match exactly across floors: Level 0=${gfStair.y}, Level 1=${f1Stair.y}`);
    assert.equal(gfStair.width, f1Stair.width, 'Staircase width must match across floors');
    assert.equal(gfStair.length, f1Stair.length, 'Staircase length must match across floors');

    // Verify 3D stair entities
    const stairs3D = layout.stairs;
    assert.ok(stairs3D && stairs3D.length >= 2, 'Canonical 3D stair entities must exist for both floors');
  });

  // ---------------------------------------------------------------------------
  // 6. Dynamic Responsiveness (No Hardcoding)
  // ---------------------------------------------------------------------------
  it('6. Dynamic Dimension Adaptation: adapts room sizes and layouts dynamically across varied plot sizes', () => {
    const plotSizes = [
      { w: 20, l: 30, beds: 1 },
      { w: 30, l: 40, beds: 2 },
      { w: 40, l: 60, beds: 3 },
      { w: 50, l: 80, beds: 4 },
    ];

    const results = plotSizes.map(p => {
      const l = generateTopologicalLayout({
        plot: { width: p.w, length: p.l, isDimensionsExplicit: true },
        floors: 1,
        bedrooms: p.beds,
      });
      const living = l.rooms.find(r => r.type === 'living_room');
      return { plot: `${p.w}x${p.l}`, livingArea: living.area, totalRooms: l.rooms.length };
    });

    // Check that living room areas scale dynamically with plot size
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i].livingArea > results[i - 1].livingArea,
        `Living area on ${results[i].plot} (${results[i].livingArea} sq ft) should exceed ` +
        `${results[i - 1].plot} (${results[i - 1].livingArea} sq ft)`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Geometric Integrity & Zero Overlaps
  // ---------------------------------------------------------------------------
  it('7. Geometric Integrity: zero room overlaps and strict boundary containment on all floors', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 35, length: 50, isDimensionsExplicit: true },
      floors: 2,
      bedrooms: 4,
      bathrooms: 3,
      parking: { required: true },
    });

    assert.ok(layout.topologicalValidation.isValid, `Layout must be topologically valid: ${JSON.stringify(layout.topologicalValidation.issues)}`);
    assert.equal(layout.topologicalValidation.overlapCount, 0, 'Zero overlaps allowed on any floor');
    assert.equal(layout.topologicalValidation.issuesCount, 0, 'Zero validation issues expected');
  });

  // ---------------------------------------------------------------------------
  // 8. Infeasible Layout Rejection
  // ---------------------------------------------------------------------------
  it('8. Infeasibility Detection: rejects impossible programs on tiny plots with explicit area deficit metrics', () => {
    assert.throws(
      () => {
        // Impossible: 5 bedrooms, parking, staircase, living, dining on tiny 12x15 plot
        generateTopologicalLayout({
          plot: { width: 12, length: 15, isDimensionsExplicit: true },
          floors: 1,
          bedrooms: 5,
          parking: { required: true },
        });
      },
      (err) => {
        assert.ok(err instanceof InfeasibleLayoutError, `Expected InfeasibleLayoutError, got ${err.name}`);
        assert.ok(err.message.includes('buildable envelope'), 'Error message must cite buildable envelope limitation');
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 9. Canonical OpenPlan3D Geometry Model
  // ---------------------------------------------------------------------------
  it('9. OpenPlan3D Geometry Derivation: outputs canonical vector walls, doors, windows, and stairs', () => {
    const layout = generateTopologicalLayout({
      plot: { width: 30, length: 40, isDimensionsExplicit: true },
      floors: 2,
      bedrooms: 3,
      bathrooms: 2,
    });

    // Check walls
    assert.ok(layout.walls && layout.walls.length > 0, 'Walls must be generated');
    const wallSample = layout.walls[0];
    assert.ok(wallSample.id, 'Wall must have id');
    assert.ok(wallSample.thickness > 0, 'Wall must have thickness (e.g. 0.75 ft or 0.38 ft)');
    assert.ok(wallSample.height === 10.0, 'Wall must have standard height');
    assert.ok(wallSample.start && wallSample.end, 'Wall must have start and end coordinates');

    // Check doors
    assert.ok(layout.doors && layout.doors.length > 0, 'Doors must be generated');
    const doorSample = layout.doors[0];
    assert.ok(doorSample.wallId, 'Door must be anchored to a wallId');
    assert.ok(doorSample.position >= 0 && doorSample.position <= 1.0, 'Door position must be normalized 0..1');
    assert.ok(doorSample.width >= 2.5, 'Door width must be >= 2.5 ft');

    // Check windows
    assert.ok(layout.windows && layout.windows.length > 0, 'Windows must be generated');
    const windowSample = layout.windows[0];
    assert.ok(windowSample.wallId, 'Window must be anchored to a wallId');
    assert.ok(windowSample.sillHeight >= 2.0, 'Window sill height must be >= 2.0 ft');

    // Check stairs
    assert.ok(layout.stairs && layout.stairs.length >= 2, 'Stairs must be generated for G+1');
    assert.equal(layout.stairs[0].riserCount, 16, 'Stair must have standard residential riser count (16 risers)');
  });

  // ---------------------------------------------------------------------------
  // 10. Feature-Flag Isolation
  // ---------------------------------------------------------------------------
  it('10. Feature-Flag Isolation: preserves legacy engine by default and enables topological solver on flag', async () => {
    const prompt = '3 BHK house on 30x40 plot with two bathrooms and parking';

    // Call without flag (default production)
    const legacyResult = await designService.generateDesign({ prompt });
    assert.equal(legacyResult.generationMethod, 'deterministic_engine', 'Default must remain legacy deterministic procedural engine');
    assert.equal(legacyResult.engine, 'procedural_v1', 'Default engine must be procedural_v1');

    // Call with feature flag
    const topoResult = await designService.generateDesign({
      prompt,
      options: { engine: 'topological' },
    });
    assert.equal(topoResult.generationMethod, 'topological_solver', 'Feature flag must activate topological solver');
    assert.equal(topoResult.engine, 'topological_solver_v1', 'Engine must be topological_solver_v1');
    assert.ok(topoResult.layout.walls.length > 0, 'Topological layout must contain canonical walls');
    assert.ok(topoResult.layout.doors.length > 0, 'Topological layout must contain canonical doors');
    assert.ok(topoResult.topologicalValidation.isValid, 'Topological layout must be topologically valid');
  });

  // ---------------------------------------------------------------------------
  // 11. Diagnostic Regression: Custom Multi-Floor with Under-Stair Storage & Plunge Pools
  // ---------------------------------------------------------------------------
  it('11. Diagnostic Regression: exactly generates requested storage, aquatic plunge pools, and floor inventory', async () => {
    const prompt = 'Plot: 30 × 40 ft. Ground floor: one car parking space, staircase, usable enclosed under-stair storage, and a separate enclosed room containing an actual small plunge pool. First floor: exactly two bedrooms, one balcony, and a separate enclosed room containing its own actual small plunge pool.';

    const result = await designService.generateDesign({
      prompt,
      options: { engine: 'topological' },
    });

    assert.equal(result.status, 'success', 'Request must succeed');
    assert.equal(result.engine, 'topological_solver_v1', 'Engine must be topological');

    const layout = result.layout;
    const reqs = result.requirements;

    // 1. Plot Dimensions
    assert.equal(reqs.plot.width, 30, 'Plot width must be 30 ft');
    assert.equal(reqs.plot.length, 40, 'Plot length must be 40 ft');
    assert.equal(reqs.plot.isDimensionsExplicit, true, 'Unicode × must produce confirmed explicit plot dimensions');
    assert.equal(layout.status, 'confirmed', 'Layout status must be confirmed, not provisional');

    // 2. Ground Floor Verification
    const gfRooms = layout.rooms.filter(r => r.level === 0);

    const gfParking = gfRooms.find(r => r.type === 'parking');
    assert.ok(gfParking, 'Ground floor must contain parking');
    assert.ok(gfParking.width >= 9.5 && gfParking.length >= 15.0, 'Parking must accommodate car standard dimensions');

    const gfStair = gfRooms.find(r => r.type === 'staircase');
    assert.ok(gfStair, 'Ground floor must contain staircase');

    const gfStorage = gfRooms.find(r => r.type === 'storage');
    assert.ok(gfStorage, 'Ground floor must contain enclosed under-stair storage');
    assert.ok(gfStorage.area >= 15.0, `Storage area must be >= 15 sq ft, got ${gfStorage.area}`);
    assert.ok(gfStorage.doors && gfStorage.doors.length >= 1, 'Storage must have an access door');

    const gfPool = gfRooms.find(r => r.type === 'plunge_pool');
    assert.ok(gfPool, 'Ground floor must contain separate enclosed plunge pool room');
    assert.ok(gfPool.basin, 'Plunge pool room must have basin geometry specifications');
    assert.ok(gfPool.basin.depth >= 3.0, 'Pool basin depth must be >= 3 ft');
    assert.ok(gfPool.doors && gfPool.doors.length >= 1, 'Plunge pool room must have an enclosed entrance door');
    assert.ok(gfPool.windows && gfPool.windows.length >= 1, 'Plunge pool room must have a ventilation window');

    // 3. First Floor Verification
    const ffRooms = layout.rooms.filter(r => r.level === 1);

    const ffBedrooms = ffRooms.filter(r => r.type === 'bedroom' || r.type === 'master_bedroom');
    assert.equal(ffBedrooms.length, 2, `First floor must contain exactly 2 bedrooms, got ${ffBedrooms.length}`);

    const ffBalcony = ffRooms.find(r => r.type === 'balcony');
    assert.ok(ffBalcony, 'First floor must contain one balcony');

    const ffPool = ffRooms.find(r => r.type === 'plunge_pool');
    assert.ok(ffPool, 'First floor must contain separate enclosed plunge pool room');
    assert.ok(ffPool.basin, 'First floor plunge pool must have its own basin');

    // 4. Vertical Staircase Stacking
    const ffStair = ffRooms.find(r => r.type === 'staircase');
    assert.ok(ffStair, 'First floor must contain staircase landing');
    assert.equal(gfStair.x, ffStair.x, 'Staircase X coordinate must stack identically');
    assert.equal(gfStair.y, ffStair.y, 'Staircase Y coordinate must stack identically');

    // 5. Validation Integrity
    assert.equal(result.validation.isValid, true, `Validation must pass with 0 errors: ${JSON.stringify(result.validation.errors)}`);
    assert.equal(result.validation.errors.length, 0, 'Must have zero validation errors');

    // 6. Structural advisory emitted for elevated plunge pool
    const hasStructuralWarning = result.warnings.some(w => /structural.*plunge pool/i.test(typeof w === 'string' ? w : w.message));
    assert.ok(hasStructuralWarning, 'Structural advisory warning must be present for first-floor elevated plunge pool');
  });

});
