import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';
import { designService } from '../src/services/designService.js';
import { aiProvider } from '../src/services/aiProvider.js';
import { validateLayout } from '../src/services/architecturalRules.js';
import { estimateDesignCost } from '../src/services/costEstimator.js';

const isBedroom = (r) => r.type === 'master_bedroom' || r.type === 'bedroom';

async function withServer(fn) {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('ArchAI Teammate Backend Specification: Comprehensive Functional Verification', async (t) => {

  // =========================================================================
  // STEP 4: Exact Hinglish User Request Flow
  // =========================================================================
  await t.test('Step 4: Custom Hinglish requirement extracts correctly and produces verified multi-floor design', async () => {
    const prompt = 'Mujhe 1200 sq ft ke plot par 2 floor ka Indian modern ghar chahiye. Ground floor par car parking, living room aur kitchen chahiye. First floor par 2 bedrooms, 2 bathrooms aur balcony chahiye.';

    const parsed = await designService.parseRequirements(prompt);
    assert.equal(parsed.status, 'success');
    assert.equal(parsed.rawPrompt, prompt, 'Exact prompt text with spaces must be preserved');
    assert.equal(parsed.requirements.floors, 2, 'Must extract exactly 2 floors');
    assert.equal(parsed.requirements.plot.totalAreaSqFt, 1200, 'Must extract 1200 sq ft area');
    assert.equal(parsed.requirements.plot.isDimensionsExplicit, false, 'Dimensions must be provisional until confirmed');
    assert.equal(parsed.requirements.designStyle, 'indian_modern', 'Must extract Indian modern design style');

    // Ground floor requirements
    const gfReq = parsed.requirements.floorRequirements[0];
    assert.equal(gfReq.parking, true, 'GF must require parking');
    assert.equal(gfReq.livingRoom, true, 'GF must require living room');
    assert.equal(gfReq.kitchen, true, 'GF must require kitchen');
    assert.equal(gfReq.bedrooms, 0, 'GF must not have bedrooms');

    // First floor requirements
    const ffReq = parsed.requirements.floorRequirements[1];
    assert.equal(ffReq.bedrooms, 2, 'FF must require 2 bedrooms');
    assert.equal(ffReq.bathrooms, 2, 'FF must require 2 bathrooms');
    assert.equal(ffReq.balcony, true, 'FF must require balcony');

    // Generate design
    const result = await designService.generateDesign({ prompt });
    assert.equal(result.status, 'success');
    assert.ok(result.layout, 'Layout must be generated');
    assert.equal(result.layout.metadata.floorsCount, 2);

    const l0Rooms = result.layout.rooms.filter((r) => r.level === 0);
    const l1Rooms = result.layout.rooms.filter((r) => r.level === 1);

    assert.ok(l0Rooms.some((r) => r.type === 'parking'), 'Level 0 must include parking');
    assert.ok(l0Rooms.some((r) => r.type === 'living_room'), 'Level 0 must include living room');
    assert.ok(l0Rooms.some((r) => r.type === 'kitchen'), 'Level 0 must include kitchen');
    assert.ok(!l0Rooms.some(isBedroom), 'Level 0 must not have bedrooms');

    const l1Bedrooms = l1Rooms.filter(isBedroom);
    assert.equal(l1Bedrooms.length, 2, 'Level 1 must have exactly 2 bedrooms');
    assert.ok(l1Rooms.some((r) => r.type === 'balcony'), 'Level 1 must have balcony');

    // Cost estimate check with style multiplier
    assert.ok(result.costEstimate, 'Cost estimate must be generated');
    assert.equal(result.costEstimate.metrics.designStyle, 'indian_modern');
    assert.equal(result.costEstimate.metrics.styleMultiplier, 1.10);
    assert.ok(result.costEstimate.totalCost.expectedINR > 1000000, 'Cost should be realistic (greater than 10 Lakhs)');
  });

  // =========================================================================
  // 1BHK, 2BHK, and 3BHK Requirements
  // =========================================================================
  await t.test('Programmatic room variations: 1BHK, 2BHK, and 3BHK produce distinct layouts', async () => {
    const p1 = '1 BHK house on a 20x30 ft plot with one bathroom and closed kitchen.';
    const p2 = '2 BHK house on a 30x40 ft plot with two bathrooms.';
    const p3 = '3 BHK house on a 40x60 ft plot with two bathrooms and parking.';

    const r1 = await designService.generateDesign({ prompt: p1 });
    const r2 = await designService.generateDesign({ prompt: p2 });
    const r3 = await designService.generateDesign({ prompt: p3 });

    const beds1 = r1.layout.rooms.filter(isBedroom);
    const beds2 = r2.layout.rooms.filter(isBedroom);
    const beds3 = r3.layout.rooms.filter(isBedroom);

    assert.equal(beds1.length, 1, '1 BHK must have 1 bedroom');
    assert.equal(beds2.length, 2, '2 BHK must have 2 bedrooms');
    assert.equal(beds3.length, 3, '3 BHK must have 3 bedrooms');

    assert.notEqual(r1.layout.summary.totalBuiltUpAreaSqFt, r2.layout.summary.totalBuiltUpAreaSqFt);
    assert.notEqual(r2.layout.summary.totalBuiltUpAreaSqFt, r3.layout.summary.totalBuiltUpAreaSqFt);
  });

  // =========================================================================
  // Feet and Metres Unit Normalization
  // =========================================================================
  await t.test('Unit normalization: converts meters and square meters to feet standards', async () => {
    // 10x15 meters
    const meterPrompt = '3 BHK house on 10x15m plot with two bathrooms';
    const parsedMeters = await designService.parseRequirements(meterPrompt);
    assert.equal(parsedMeters.requirements.plot.isDimensionsExplicit, true);
    // 10m ≈ 32.8 ft, 15m ≈ 49.2 ft
    assert.ok(parsedMeters.requirements.plot.width >= 32 && parsedMeters.requirements.plot.width <= 33);
    assert.ok(parsedMeters.requirements.plot.length >= 49 && parsedMeters.requirements.plot.length <= 50);

    // 100 sqm
    const sqMPrompt = '2 BHK house on 100 sqm plot';
    const parsedSqM = await designService.parseRequirements(sqMPrompt);
    assert.equal(parsedSqM.requirements.plot.isDimensionsExplicit, false);
    // 100 sqm ≈ 1076 sq ft
    assert.ok(parsedSqM.requirements.plot.totalAreaSqFt >= 1070 && parsedSqM.requirements.plot.totalAreaSqFt <= 1085);
  });

  // =========================================================================
  // Area without plot dimensions (provisional status & clarifications)
  // =========================================================================
  await t.test('Area without dimensions: marks layout provisional and requests confirmation', async () => {
    const areaOnlyPrompt = 'Mujhe 1200 sq ft me 2 floor ka makan chahiye';
    const parsed = await designService.parseRequirements(areaOnlyPrompt);

    assert.equal(parsed.requirements.plot.isDimensionsExplicit, false);
    assert.ok(parsed.clarifications.some((c) => c.field === 'plotDimensions'));

    const gen = await designService.generateDesign({ prompt: areaOnlyPrompt });
    assert.equal(gen.layout.status, 'provisional');
    assert.equal(gen.layout.isProvisional, true);
    assert.ok(gen.layout.warnings.some((w) => w.includes('PROVISIONAL PREVIEW')));
  });

  // =========================================================================
  // Missing or Ambiguous Information Handling
  // =========================================================================
  await t.test('Missing information: generates assumptions and clarification questions', async () => {
    const ambiguousPrompt = 'A house with garden and car parking';
    const parsed = await designService.parseRequirements(ambiguousPrompt);

    assert.ok(parsed.assumptions.length > 0, 'Must record assumptions for unstated parameters');
    assert.ok(parsed.clarifications.length > 0, 'Must provide clarifications for missing plot/bedrooms');
    assert.equal(parsed.extractedFacts.parkingRequested, true, 'Must extract explicitly stated parking');
  });

  // =========================================================================
  // Geometry Validation: Boundary & Overlap Violations
  // =========================================================================
  await t.test('Geometry validation: detects room overlaps and boundary out-of-bounds', () => {
    const invalidLayout = {
      id: 'invalid-test',
      plot: { width: 30, length: 40, totalAreaSqFt: 1200, isDimensionsExplicit: true },
      metadata: { floorsCount: 1, unit: 'ft' },
      rooms: [
        {
          id: 'room-1',
          type: 'living_room',
          name: 'Living Room',
          level: 0,
          x: 0,
          y: 0,
          width: 20,
          length: 20,
          area: 400,
        },
        {
          id: 'room-2',
          type: 'kitchen',
          name: 'Overlapping Kitchen',
          level: 0,
          x: 10, // Overlaps with room-1 (x: 0..20, y: 0..20)
          y: 10,
          width: 15,
          length: 15,
          area: 225,
        },
        {
          id: 'room-3',
          type: 'bedroom',
          name: 'Out of Bounds Bedroom',
          level: 0,
          x: 25,
          y: 30,
          width: 12, // 25 + 12 = 37 > 30 ft plot width!
          length: 15, // 30 + 15 = 45 > 40 ft plot length!
          area: 180,
        },
      ],
    };

    const val = validateLayout(invalidLayout);
    assert.equal(val.isValid, false, 'Layout with collisions and boundary breaches must be invalid');
    assert.ok(val.errors.some((e) => e.includes('Overlap detected')));
    assert.ok(val.errors.some((e) => e.includes('exceeds plot width')));
    assert.ok(val.errors.some((e) => e.includes('exceeds plot length')));
  });

  // =========================================================================
  // Door and Window Placement Validation
  // =========================================================================
  await t.test('Door & Window validation: flags invalid orientation, negative dimensions, and floor reference errors', () => {
    const layoutWithBadOpenings = {
      id: 'bad-openings-test',
      plot: { width: 30, length: 40, totalAreaSqFt: 1200, isDimensionsExplicit: true },
      metadata: { floorsCount: 1, unit: 'ft' },
      rooms: [
        {
          id: 'room-1',
          type: 'living_room',
          name: 'Living Room',
          level: 2, // Level 2 when floorsCount is 1!
          x: 0,
          y: 0,
          width: 16,
          length: 16,
          area: 256,
          doors: [
            { wall: 'ceiling', offset: 2, width: 3 }, // Invalid wall orientation!
            { wall: 'north', offset: -1, width: 3 },   // Negative offset!
          ],
          windows: [
            { wall: 'diagonal', offset: 2, width: 3 }, // Invalid wall orientation!
            { wall: 'east', offset: 2, width: -4 },     // Negative width!
          ],
        },
      ],
    };

    const val = validateLayout(layoutWithBadOpenings);
    assert.equal(val.isValid, false);
    assert.ok(val.errors.some((e) => e.includes('ceiling')));
    assert.ok(val.errors.some((e) => e.includes('negative offset')));
    assert.ok(val.errors.some((e) => e.includes('diagonal')));
    assert.ok(val.errors.some((e) => e.includes('negative width') || e.includes('non-positive width')));
    assert.ok(val.errors.some((e) => e.includes('only configured for 1 floor')));
  });

  // =========================================================================
  // Design Modification: All 7 Requested Operations
  // =========================================================================
  await t.test('Prompt-based design modifications: verifies all 7 operations', async () => {
    const basePrompt = '2 BHK house on a 30x40 ft plot with one bathroom and closed kitchen.';
    const baseGen = await designService.generateDesign({ prompt: basePrompt });
    const baseLayout = baseGen.layout;

    // 1. "Make the living room larger"
    const mod1 = await designService.modifyDesign(baseLayout, 'Make the living room larger');
    assert.equal(mod1.status, 'success');
    assert.equal(mod1.applied, true);
    const livingBefore = baseLayout.rooms.find((r) => r.type === 'living_room');
    const livingAfter = mod1.layout.rooms.find((r) => r.type === 'living_room');
    assert.ok(livingAfter.area > livingBefore.area, 'Living room area must increase');

    // 2. "Change the kitchen to an open kitchen"
    const mod2 = await designService.modifyDesign(baseLayout, 'Change the kitchen to an open kitchen');
    assert.equal(mod2.status, 'success');
    assert.equal(mod2.applied, true);
    const kitchenAfter = mod2.layout.rooms.find((r) => r.type === 'kitchen');
    assert.equal(kitchenAfter.kitchenType, 'open');

    // 3. "Add a balcony"
    const mod3 = await designService.modifyDesign(baseLayout, 'Add a balcony');
    assert.equal(mod3.status, 'success');
    assert.equal(mod3.applied, true);
    assert.ok(mod3.layout.rooms.some((r) => r.type === 'balcony'), 'Balcony room must be added');

    // 4. "Move bathroom closer to bedroom"
    const mod4 = await designService.modifyDesign(baseLayout, 'Move a bathroom closer to the bedroom');
    assert.equal(mod4.status, 'success');
    assert.equal(mod4.applied, true);
    const bathAfter = mod4.layout.rooms.find((r) => r.type === 'bathroom');
    assert.ok(bathAfter.name.includes('Attached') || bathAfter.name.includes('Ensuite'));

    // 5. "Increase bedroom width to 12 ft"
    const mod5 = await designService.modifyDesign(baseLayout, 'Increase bedroom width to 12 ft');
    assert.equal(mod5.status, 'success');
    assert.equal(mod5.applied, true);
    const bedAfter = mod5.layout.rooms.find(isBedroom);
    assert.ok(bedAfter.width >= 12, 'Bedroom width must be at least 12 ft');

    // 6. "Add another floor"
    const mod6 = await designService.modifyDesign(baseLayout, 'Add another floor');
    assert.equal(mod6.status, 'success');
    assert.equal(mod6.applied, true);
    assert.equal(mod6.layout.metadata.floorsCount, baseLayout.metadata.floorsCount + 1);

    // 7. "Generate a more compact layout"
    const mod7 = await designService.modifyDesign(baseLayout, 'Generate a more compact layout');
    assert.equal(mod7.status, 'success');
    assert.equal(mod7.applied, true);
    const totalAreaBefore = baseLayout.rooms.reduce((acc, r) => acc + r.area, 0);
    const totalAreaAfter = mod7.layout.rooms.reduce((acc, r) => acc + r.area, 0);
    assert.ok(totalAreaAfter < totalAreaBefore, 'Compact layout must reduce total room area');
  });

  // =========================================================================
  // Impossible Layouts and Malformed Requests
  // =========================================================================
  await t.test('Impossible layouts and malformed requests return 422 and 400 status codes', async () => {
    await withServer(async (baseUrl) => {
      // Impossible request (5 BHK on 10x15 plot)
      const resImpossible = await fetch(`${baseUrl}/api/designs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '5 BHK luxury villa on 10x15 plot with 3 car parking' }),
      });
      assert.equal(resImpossible.status, 422, 'Must return 422 for impossible layout');
      const dataImpossible = await resImpossible.json();
      assert.equal(dataImpossible.status, 'error');
      assert.ok(dataImpossible.error.includes('Impossible Layout'));

      // Malformed request (empty prompt)
      const resMalformed = await fetch(`${baseUrl}/api/designs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' }),
      });
      assert.equal(resMalformed.status, 400, 'Must return 400 for empty prompt');
    });
  });

  // =========================================================================
  // AI Provider Failure and Deterministic Fallback
  // =========================================================================
  await t.test('AI provider abstraction: falls back to deterministic procedural engine safely', async () => {
    const parseResult = await aiProvider.parseWithAI('3 BHK on 30x40');
    assert.equal(parseResult.usedAI, false);
    assert.equal(parseResult.method, 'deterministic_engine');

    const modResult = await aiProvider.modifyWithAI({}, 'Make living room bigger');
    assert.equal(modResult.usedAI, false);
    assert.equal(modResult.method, 'deterministic_engine');
  });

  // =========================================================================
  // Teammate RESTful Endpoints Contract & Aliases
  // =========================================================================
  await t.test('Teammate RESTful endpoints: supports new routes and backward-compatible aliases', async () => {
    await withServer(async (baseUrl) => {
      // 1. Health
      const resHealth = await fetch(`${baseUrl}/api/health`);
      assert.equal(resHealth.status, 200);

      // 2. Parse Requirements (New & Legacy)
      const resParseNew = await fetch(`${baseUrl}/api/requirements/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '2 BHK east facing on 30x40 plot' }),
      });
      assert.equal(resParseNew.status, 200);
      const dataParseNew = await resParseNew.json();
      assert.equal(dataParseNew.status, 'success');
      assert.ok(dataParseNew.brief);

      const resParseLegacy = await fetch(`${baseUrl}/api/parse-requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '2 BHK east facing on 30x40 plot' }),
      });
      assert.equal(resParseLegacy.status, 200);

      // 3. Generate Design (New & Legacy)
      const resGenNew = await fetch(`${baseUrl}/api/designs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '2 BHK east facing on 30x40 plot' }),
      });
      assert.equal(resGenNew.status, 200);
      const dataGenNew = await resGenNew.json();
      assert.ok(dataGenNew.layout);
      assert.ok(dataGenNew.costEstimate);

      const resGenLegacy = await fetch(`${baseUrl}/api/generate-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '2 BHK east facing on 30x40 plot' }),
      });
      assert.equal(resGenLegacy.status, 200);

      // 4. Validate Design (New & Legacy)
      const resValNew = await fetch(`${baseUrl}/api/designs/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout }),
      });
      assert.equal(resValNew.status, 200);

      const resValLegacy = await fetch(`${baseUrl}/api/validate-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout }),
      });
      assert.equal(resValLegacy.status, 200);

      // 5. Modify Design (New)
      const resMod = await fetch(`${baseUrl}/api/designs/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout, prompt: 'Change kitchen to open kitchen' }),
      });
      assert.equal(resMod.status, 200);
      const dataMod = await resMod.json();
      assert.equal(dataMod.status, 'success');
      assert.equal(dataMod.applied, true);

      // 6. Recommendations (New & Legacy)
      const resRecNew = await fetch(`${baseUrl}/api/designs/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout }),
      });
      assert.equal(resRecNew.status, 200);

      const resRecLegacy = await fetch(`${baseUrl}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout }),
      });
      assert.equal(resRecLegacy.status, 200);

      // 7. Cost Estimate (New)
      const resCost = await fetch(`${baseUrl}/api/designs/cost-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: dataGenNew.layout, options: { tier: 'premium' } }),
      });
      assert.equal(resCost.status, 200);
      const dataCost = await resCost.json();
      assert.equal(dataCost.status, 'success');
      assert.ok(dataCost.itemizedBreakdown.civilAndStructure);
      assert.ok(dataCost.itemizedBreakdown.finishingAndFlooring);
      assert.ok(dataCost.itemizedBreakdown.mepAndPlumbing);
    });
  });

});
