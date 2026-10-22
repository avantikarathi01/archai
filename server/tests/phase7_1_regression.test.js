import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePromptRequirements } from '../src/services/promptParser.js';
import { generateProceduralLayout } from '../src/services/layoutGenerator.js';
import app from '../src/app.js';

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

test('Phase 7.1: Requirement Input, Generation & Preset Isolation Regression Tests', async (t) => {

  await t.test('Case A: Custom Hinglish requirement with punctuation and spaces', () => {
    const prompt = 'Mujhe 1200 sq ft me 2 floor ka makan chahiye. Ground floor pe gaadi parking aur first floor pe 2 BHK chahiye. Indian modern design aur balcony bhi chahiye.';
    const parsed = parsePromptRequirements(prompt);

    assert.equal(parsed.requirements.floors, 2, 'Must extract 2 floors');
    assert.equal(parsed.requirements.plot.totalAreaSqFt, 1200, 'Must extract 1200 sq ft area');
    assert.equal(parsed.requirements.plot.isDimensionsExplicit, false, 'Dimensions must be provisional/unconfirmed');

    // Ground floor isolation
    const gf = parsed.requirements.floorRequirements[0];
    assert.equal(gf.parking, true, 'Ground floor must include parking');
    assert.equal(gf.bedrooms, 0, 'Ground floor must not have bedrooms');

    // First floor isolation
    const ff = parsed.requirements.floorRequirements[1];
    assert.equal(ff.bedrooms, 2, 'First floor must have 2 bedrooms');
    assert.equal(ff.kitchen, true, 'First floor must have kitchen');
    assert.equal(ff.balcony, true, 'First floor must have balcony');

    // Generate layout
    const layout = generateProceduralLayout(parsed.requirements);
    assert.ok(layout.rooms.length > 0, 'Layout must be generated');

    const l0Rooms = layout.rooms.filter(r => r.level === 0);
    const l1Rooms = layout.rooms.filter(r => r.level === 1);

    assert.ok(l0Rooms.some(r => r.type === 'parking'), 'Level 0 must contain parking');
    assert.ok(!l0Rooms.some(isBedroom), 'Level 0 must NOT contain bedrooms');

    const l1Beds = l1Rooms.filter(isBedroom);
    assert.equal(l1Beds.length, 2, 'Level 1 must contain exactly 2 bedrooms');
    assert.ok(l1Rooms.some(r => r.type === 'balcony'), 'Level 1 must contain balcony');
  });

  await t.test('Case B: Modify bedroom count and regenerate (2 BHK -> 3 BHK on 1st floor)', () => {
    const prompt = 'Mujhe 1200 sq ft me 2 floor ka makan chahiye. Ground floor pe gaadi parking aur first floor pe 3 BHK chahiye. Indian modern design aur balcony bhi chahiye.';
    const parsed = parsePromptRequirements(prompt);

    assert.equal(parsed.requirements.floorRequirements[1].bedrooms, 3, 'First floor must have 3 bedrooms');

    const layout = generateProceduralLayout(parsed.requirements);
    const l1Beds = layout.rooms.filter(r => r.level === 1 && isBedroom(r));
    assert.equal(l1Beds.length, 3, 'Regenerated layout must have exactly 3 bedrooms on Level 1');
  });

  await t.test('Case C: Preset modification takes priority over default preset values', () => {
    // Preset was: '3 BHK house on a 40x60 ft plot with two bathrooms and parking.'
    // Modified to: '2 BHK house on a 40x60 ft plot with two bathrooms and parking.'
    const modifiedPrompt = '2 BHK house on a 40x60 ft plot with two bathrooms and parking.';
    const parsed = parsePromptRequirements(modifiedPrompt);

    assert.equal(parsed.requirements.bedrooms, 2, 'Must extract 2 bedrooms from modified prompt');
    assert.equal(parsed.requirements.bathrooms, 2, 'Must extract 2 bathrooms from modified prompt');

    const layout = generateProceduralLayout(parsed.requirements);
    const bedrooms = layout.rooms.filter(isBedroom);
    assert.equal(bedrooms.length, 2, 'Must generate exactly 2 bedrooms instead of preset 3');
  });

  await t.test('Case D: Impossible requirement reports error without fallback to preset', async () => {
    const impossiblePrompt = '5 BHK luxury villa on 10x15 plot with 3 car parking';

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/generate-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: impossiblePrompt })
      });

      assert.equal(res.status, 422, 'Must return 422 Unprocessable Entity');
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.ok(data.error.includes('Impossible Layout'), 'Must provide clear impossible layout reason');
      assert.equal(data.layout, undefined, 'Must NOT return any fallback layout');
    });
  });

  await t.test('Case E: Consecutive generations are completely isolated', () => {
    // 1st request: 1 BHK on 20x30
    const prompt1 = '1 BHK house on a 20x30 ft plot with one bathroom and closed kitchen.';
    const parsed1 = parsePromptRequirements(prompt1);
    const layout1 = generateProceduralLayout(parsed1.requirements);

    assert.equal(layout1.plot.width, 20);
    assert.equal(layout1.plot.length, 30);
    assert.equal(layout1.rooms.filter(isBedroom).length, 1);

    // 2nd request: 3 BHK on 40x60
    const prompt2 = '3 BHK house on a 40x60 ft plot with two bathrooms and parking.';
    const parsed2 = parsePromptRequirements(prompt2);
    const layout2 = generateProceduralLayout(parsed2.requirements);

    assert.equal(layout2.plot.width, 40);
    assert.equal(layout2.plot.length, 60);
    assert.equal(layout2.rooms.filter(isBedroom).length, 3);
    assert.notDeepEqual(layout1.rooms, layout2.rooms, 'Layouts must be distinct');
  });

  await t.test('Case F: Parse Requirements Only endpoint returns structured program & clarifications', async () => {
    const prompt = 'Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK';
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/parse-requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.requirements, 'Must return parsed requirements');
      assert.equal(data.requirements.floors, 2);
      assert.equal(data.requirements.floorRequirements[0].parking, true);
      assert.equal(data.requirements.floorRequirements[1].bedrooms, 2);
      assert.ok(data.clarifications.length > 0, 'Must return clarifications for missing plot dimensions');
      assert.ok(data.clarifications.some(c => c.field === 'plotDimensions'), 'Must flag missing plot dimensions');
    });
  });

  await t.test('Case G: Explicit dimensions override without stale preset pollution', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/generate-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK',
          plotDimensions: { width: 25, length: 48 }
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.layout.plot.width, 25, 'Plot width must be overridden to 25 ft');
      assert.equal(data.layout.plot.length, 48, 'Plot length must be overridden to 48 ft');
      assert.equal(data.layout.plot.isDimensionsExplicit, true, 'Plot must be marked confirmed');
      assert.equal(data.layout.isProvisional, false, 'Layout must be confirmed valid');

      // All rooms on all floors must fit within 25x48
      data.layout.rooms.forEach(r => {
        assert.ok(r.x >= 0, `Room ${r.name} x must be >= 0`);
        assert.ok(r.y >= 0, `Room ${r.name} y must be >= 0`);
        assert.ok(r.x + r.width <= 25.01, `Room ${r.name} must fit in 25ft width (was ${r.x + r.width})`);
        assert.ok(r.y + r.length <= 48.01, `Room ${r.name} must fit in 48ft length (was ${r.y + r.length})`);
      });
    });
  });

});
