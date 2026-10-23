/**
 * Automated Verification Suite for ArchAI Cost Intelligence & Design Optimization Engine
 * 
 * Verifies:
 * 1. Measurable quantity takeoff from generated floor plan geometry (boqEngine)
 * 2. Multi-currency and quality tier scaling (economy, standard, premium)
 * 3. Climate & Buildability Analyzer (orientation daylight, cross-ventilation, plumbing alignment, structural spans)
 * 4. Elevated plunge pool hydrostatic live/dead load calculations (~3.8 metric tons)
 * 5. Multi-option design alternatives (Lowest Cost, Space Maximizer, Balanced)
 * 6. Mandatory room requirement preservation across all 3 alternatives (30x40 G+1 test prompt)
 * 7. Comparative metrics and delta calculation
 * 8. RESTful API route integration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractMeasurableQuantities, generateCategorizedBOQ, CURRENCY_CONFIGS, QUALITY_TIER_CONFIGS } from '../src/services/boqEngine.js';
import {
  analyzeDaylightAndOrientation,
  analyzeCrossVentilation,
  analyzePlumbingAlignment,
  analyzeStructuralSpans,
  analyzeElevatedPlungePool,
  analyzeBuildability
} from '../src/services/buildabilityAnalyzer.js';
import { generateTopologicalLayout } from '../src/services/topologicalLayoutSolver.js';
import { parsePromptRequirements } from '../src/services/promptParser.js';
import { designOptimizer } from '../src/services/designOptimizer.js';

describe('ArchAI Cost Intelligence & BOQ Engine', () => {

  const testPrompt =
    'Plot: 30 x 40 ft, east facing. Ground floor: one car parking space, staircase, usable enclosed under-stair storage, and a separate enclosed room containing an actual small plunge pool. First floor: exactly two bedrooms, one balcony, and a separate enclosed room containing its own actual small plunge pool.';

  const parsed = parsePromptRequirements(testPrompt);
  const baseLayout = generateTopologicalLayout(parsed.requirements);

  it('1. Quantity Takeoff: extracts exact measurable quantities directly from layout geometry', () => {
    const quantities = extractMeasurableQuantities(baseLayout);

    assert.ok(quantities.totalBuiltUpArea > 1000, `Built up area should be > 1000 sq ft, got ${quantities.totalBuiltUpArea}`);
    assert.ok(quantities.totalCarpetArea > 800, `Carpet area should be > 800 sq ft, got ${quantities.totalCarpetArea}`);
    assert.ok(quantities.exteriorWallLinearFt > 100, `Exterior wall linear ft should be > 100, got ${quantities.exteriorWallLinearFt}`);
    assert.ok(quantities.interiorWallLinearFt > 50, `Interior wall linear ft should be > 50, got ${quantities.interiorWallLinearFt}`);
    assert.ok(quantities.netMasonryAreaSqFt > 1000, `Net masonry sq ft should be > 1000, got ${quantities.netMasonryAreaSqFt}`);
    assert.ok(quantities.totalDoorCount >= 6, `Door count should be >= 6, got ${quantities.totalDoorCount}`);
    assert.ok(quantities.totalWindowCount >= 4, `Window count should be >= 4, got ${quantities.totalWindowCount}`);
    assert.ok(quantities.hasPlungePool, 'Should detect plunge pools in layout');
    assert.equal(quantities.plungePoolCount, 2, 'Should detect exactly 2 plunge pools');
    assert.ok(quantities.hasElevatedPool, 'Should detect upper floor elevated plunge pool');
    assert.ok(quantities.rccSlabSqFt > 0, 'Should compute RCC slab area');
  });

  it('2. Categorized BOQ: produces structured line items, subtotals, overheads, contingency, and tax', () => {
    const boq = generateCategorizedBOQ(baseLayout, {
      currency: 'INR',
      tier: 'standard',
      userBudget: 4500000,
    });

    assert.equal(boq.status, 'success');
    assert.ok(Array.isArray(boq.categories), 'Should return categories array');
    assert.ok(boq.categories.length >= 7, `Should have at least 7 direct work categories, got ${boq.categories.length}`);

    // Verify direct work categories
    const catNames = boq.categories.map(c => c.name);
    assert.ok(catNames.includes('Substructure & Foundation'));
    assert.ok(catNames.includes('Superstructure & Masonry'));
    assert.ok(catNames.includes('Flooring & Finishes'));
    assert.ok(catNames.includes('Doors & Windows'));
    assert.ok(catNames.includes('Plumbing & Sanitary'));
    assert.ok(catNames.includes('Electrical & Lighting'));
    assert.ok(catNames.includes('Painting & Waterproofing'));
    assert.ok(catNames.includes('Plunge Pool Specialty Works'));

    // Verify indirect works
    assert.ok(boq.indirectWorks.directWorksCost > 0);
    assert.ok(boq.indirectWorks.contractorOverhead > 0);
    assert.ok(boq.indirectWorks.contingency > 0);
    assert.ok(boq.indirectWorks.taxAmount > 0);
    assert.ok(boq.indirectWorks.grandTotalCost > boq.indirectWorks.directWorksCost);

    // Verify budget variance calculation
    assert.ok(boq.summary.budgetComparison, 'Should calculate budget comparison when budget provided');
    assert.equal(boq.summary.budgetComparison.budgetAmount, 4500000);
    assert.ok(typeof boq.summary.budgetComparison.variance === 'number');
    assert.ok(boq.disclaimer.includes('PRELIMINARY ESTIMATE NOTICE'));
  });

  it('3. Multi-Currency & Quality Tier Multipliers: scales rates and formats correctly', () => {
    const boqInr = generateCategorizedBOQ(baseLayout, { currency: 'INR', tier: 'standard' });
    const boqUsd = generateCategorizedBOQ(baseLayout, { currency: 'USD', tier: 'standard' });
    const boqEconomy = generateCategorizedBOQ(baseLayout, { currency: 'INR', tier: 'economy' });
    const boqPremium = generateCategorizedBOQ(baseLayout, { currency: 'INR', tier: 'premium' });

    assert.equal(boqInr.currency.code, 'INR');
    assert.equal(boqUsd.currency.code, 'USD');
    assert.ok(boqUsd.summary.formattedGrandTotal.startsWith('$'));

    // USD should reflect exchange rate conversion (~0.012 of INR)
    const expectedUsd = Math.round(boqInr.summary.grandTotalCost * 0.012);
    const diff = Math.abs(boqUsd.summary.grandTotalCost - expectedUsd);
    assert.ok(diff < (expectedUsd * 0.05), 'USD conversion should match exchange rate within 5%');

    // Economy tier should be ~22% cheaper than standard (multiplier 0.78 vs 1.0)
    assert.ok(
      boqEconomy.summary.grandTotalCost < boqInr.summary.grandTotalCost,
      'Economy total should be lower than standard'
    );
    // Premium tier should be ~38% higher than standard (multiplier 1.38 vs 1.0)
    assert.ok(
      boqPremium.summary.grandTotalCost > boqInr.summary.grandTotalCost,
      'Premium total should be higher than standard'
    );
  });
});

describe('ArchAI Climate Intelligence & Buildability Analyzer', () => {

  const testPrompt =
    'Plot: 30 x 40 ft, east facing. Ground floor: one car parking space, staircase, usable enclosed under-stair storage, and a separate enclosed room containing an actual small plunge pool. First floor: exactly two bedrooms, one balcony, and a separate enclosed room containing its own actual small plunge pool.';

  const parsed = parsePromptRequirements(testPrompt);
  const layout = generateTopologicalLayout(parsed.requirements);

  it('4. Orientation & Daylighting: identifies sun exposures and computes daylight score', () => {
    const daylight = analyzeDaylightAndOrientation(layout);

    assert.equal(daylight.facingOrientation, 'EAST');
    assert.ok(daylight.overallDaylightScore >= 50 && daylight.overallDaylightScore <= 100);
    assert.ok(Array.isArray(daylight.roomEvaluations));
    assert.ok(daylight.roomEvaluations.length > 0);

    // Primary rooms touching east facade should be noted
    assert.ok(daylight.morningSunRooms.length > 0, 'Should detect rooms with morning sun access');
  });

  it('5. Cross-Ventilation: evaluates room airflow potentials and wall exposures', () => {
    const vent = analyzeCrossVentilation(layout);

    assert.ok(vent.overallVentilationScore >= 50 && vent.overallVentilationScore <= 100);
    assert.ok(Array.isArray(vent.rooms));
    const parking = vent.rooms.find(r => r.type === 'parking');
    if (parking) {
      assert.ok(parking.score >= 90, 'Parking should have high ventilation score');
    }
  });

  it('6. Vertical Plumbing Stack Alignment: computes offsets between upper and lower wet zones', () => {
    const plumbing = analyzePlumbingAlignment(layout);

    assert.ok(plumbing.upperWetRoomsCount > 0, 'Should detect upper wet rooms (bathrooms / pool)');
    assert.ok(plumbing.groundWetRoomsCount > 0, 'Should detect ground wet rooms (kitchen / pool)');
    assert.ok(typeof plumbing.averageOffsetFeet === 'number');
    assert.ok(plumbing.plumbingStackScore >= 50 && plumbing.plumbingStackScore <= 100);
    assert.ok(Array.isArray(plumbing.stackEvaluations));
  });

  it('7. Structural Spans: assesses maximum clear spans and slab thickness criteria', () => {
    const structural = analyzeStructuralSpans(layout);

    assert.ok(structural.maxClearSpanFeet > 0, 'Should detect maximum clear span');
    assert.ok(structural.structuralComplexityScore >= 50);
    assert.ok(typeof structural.slabStandard === 'string');
  });

  it('8. Elevated Plunge Pool: calculates hydrostatic water mass (~3.8 metric tons) and drop-panel directives', () => {
    const poolAnalysis = analyzeElevatedPlungePool(layout);

    assert.ok(poolAnalysis.hasElevatedPool, 'Should detect elevated plunge pool on first floor');
    assert.equal(poolAnalysis.elevatedPoolCount, 1);
    assert.ok(poolAnalysis.totalWaterWeightMetricTons >= 2.0, 'Water weight should be at least 2.0 metric tons');
    assert.ok(poolAnalysis.totalImposedLoadMetricTons >= 3.0, 'Total water + concrete load should be >= 3.0 metric tons');

    const pool = poolAnalysis.pools[0];
    assert.ok(pool.mandatoryEngineeringDirectives.length >= 4);
    assert.ok(pool.mandatoryEngineeringDirectives.some(d => d.includes('DROP PANEL')));
    assert.ok(pool.mandatoryEngineeringDirectives.some(d => d.includes('WATERPROOF')));
  });

  it('9. Comprehensive Buildability Orchestrator: returns composite score and actionable recommendations', () => {
    const result = analyzeBuildability(layout);

    assert.equal(result.status, 'success');
    assert.ok(result.compositeBuildabilityScore >= 50 && result.compositeBuildabilityScore <= 100);
    assert.ok(Array.isArray(result.recommendations));
    assert.ok(result.recommendations.length >= 4, `Should produce 4-6 actionable recommendations, got ${result.recommendations.length}`);
    assert.ok(result.disclaimer.includes('BUILDABILITY NOTICE'));
  });
});

describe('ArchAI Multi-Option Design Optimization Engine', () => {

  const testPrompt =
    'Plot: 30 x 40 ft, east facing. Ground floor: one car parking space, staircase, usable enclosed under-stair storage, and a separate enclosed room containing an actual small plunge pool. First floor: exactly two bedrooms, one balcony, and a separate enclosed room containing its own actual small plunge pool.';

  it('10. Multi-Option Alternatives: generates 3 structurally feasible options preserving 100% mandatory rooms', async () => {
    const result = await designOptimizer.generateAlternatives({
      prompt: testPrompt,
      userBudget: 5000000,
      currency: 'INR',
      tier: 'standard',
    });

    assert.equal(result.status, 'success');
    assert.equal(result.options.length, 3, 'Should generate exactly 3 design alternatives');

    const [optCost, optSpace, optBalanced] = result.options;

    assert.equal(optCost.strategy, 'cost_optimized');
    assert.equal(optSpace.strategy, 'space_optimized');
    assert.equal(optBalanced.strategy, 'balanced_daylight');

    // Verify 100% mandatory room preservation across EVERY alternative
    for (const opt of result.options) {
      const rooms = opt.layout.rooms;

      // Ground Floor Checks
      const gfParking = rooms.find(r => r.level === 0 && r.type === 'parking');
      const gfStair = rooms.find(r => r.level === 0 && r.type === 'staircase');
      const gfStorage = rooms.find(r => r.level === 0 && r.type === 'storage');
      const gfPool = rooms.find(r => r.level === 0 && r.type === 'plunge_pool');

      assert.ok(gfParking, `${opt.name}: Ground floor parking must be present`);
      assert.ok(gfStair, `${opt.name}: Ground floor staircase must be present`);
      assert.ok(gfStorage, `${opt.name}: Usable enclosed under-stair storage must be present`);
      assert.ok(gfPool, `${opt.name}: Ground floor plunge pool must be present`);

      // First Floor Checks
      const ffBedrooms = rooms.filter(r => r.level === 1 && (r.type === 'bedroom' || r.type === 'master_bedroom'));
      const ffBalcony = rooms.find(r => r.level === 1 && r.type === 'balcony');
      const ffPool = rooms.find(r => r.level === 1 && r.type === 'plunge_pool');

      assert.equal(ffBedrooms.length, 2, `${opt.name}: First floor must have exactly 2 bedrooms`);
      assert.ok(ffBalcony, `${opt.name}: First floor balcony must be present`);
      assert.ok(ffPool, `${opt.name}: First floor plunge pool must be present`);

      // Validation check: zero overlaps
      assert.equal(opt.layout.validation.isValid, true, `${opt.name} layout must pass geometric validation`);
      assert.equal(opt.layout.validation.errors.length, 0, `${opt.name} layout must have 0 validation errors`);
      const overlapErrors = opt.layout.validation.errors.filter(e => /overlap/i.test(e));
      assert.equal(overlapErrors.length, 0, `${opt.name} must have 0 overlap errors`);
    }

    // Cost Optimization Check: Value-engineered option should have the lowest cost
    assert.ok(
      optCost.metrics.grandTotalCost <= optBalanced.metrics.grandTotalCost,
      'Value-engineered cost should be <= balanced option'
    );

    // Usable Space Check: Space maximizer option should achieve highest carpet area
    assert.ok(
      optSpace.metrics.totalCarpetAreaSqFt >= optCost.metrics.totalCarpetAreaSqFt,
      'Space maximizer should achieve higher or equal carpet area than value-engineered'
    );

    // Comparison Matrix Check
    assert.ok(Array.isArray(result.comparisonMatrix));
    assert.ok(result.comparisonMatrix.length >= 6);
    const costRow = result.comparisonMatrix.find(r => r.key === 'grandTotalCost');
    assert.ok(costRow, 'Comparison matrix should contain total cost row');
    assert.ok(costRow.values.option_cost);
    assert.ok(costRow.values.option_space);
    assert.ok(costRow.values.option_balanced);
  });
});
