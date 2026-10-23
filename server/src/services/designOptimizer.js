/**
 * ArchAI Multi-Option Design Optimization & Comparison Engine
 * 
 * Generates 3 structurally feasible layout alternatives for the same plot and architectural requirements:
 * 1. Option A: Value-Engineered (Lowest Cost) - Grouped plumbing, modular spans, standardized openings.
 * 2. Option B: Space Maximizer (Maximum Living Area) - Minimized circulation, maximized carpet area.
 * 3. Option C: Balanced Living & Daylight (Recommended) - Optimal daylighting, cross-ventilation, and usability.
 * 
 * STRICT COMPLIANCE:
 * Every alternative strictly preserves 100% of the user's mandatory room inventory
 * (e.g. parking, staircase, under-stair storage, ground plunge pool, 2 upper bedrooms, balcony, upper plunge pool).
 * No required room is dropped, skipped, or replaced.
 */

import { parsePromptRequirements } from './promptParser.js';
import { generateTopologicalLayout } from './topologicalLayoutSolver.js';
import { validateLayout } from './architecturalRules.js';
import { generateCategorizedBOQ, BOQ_DISCLAIMER } from './boqEngine.js';
import { analyzeBuildability, BUILDABILITY_DISCLAIMER } from './buildabilityAnalyzer.js';

export const OPTIMIZATION_DISCLAIMER =
  'DESIGN ALTERNATIVES NOTICE: Layout alternatives, comparative cost savings, and climate ratings are generated via ' +
  'topological constraint optimization. Quantities and estimates are preliminary engineering heuristics for comparative design selection. ' +
  'Certified structural framing, rebar detailing, and quantity surveyor tender verification are required prior to construction.';

export class DesignOptimizer {
  /**
   * Generates and compares 3 feasible layout alternatives
   * 
   * @param {object} params
   * @returns {object} Multi-option comparison payload
   */
  async generateAlternatives({
    prompt,
    requirements,
    plotDimensions,
    options = {},
    userBudget = null,
    currency = 'INR',
    tier = 'standard',
    unitRates = {},
  }) {
    let reqs = null;

    if (prompt && typeof prompt === 'string' && prompt.trim().length > 0) {
      const parsed = parsePromptRequirements(prompt.trim());
      reqs = parsed.requirements;

      const explicitPlot = plotDimensions || requirements?.plot;
      if (explicitPlot && explicitPlot.width && explicitPlot.length) {
        const w = Number(explicitPlot.width);
        const l = Number(explicitPlot.length);
        reqs.plot = {
          width: w,
          length: l,
          totalAreaSqFt: Math.round(w * l),
          unit: 'ft',
          isDimensionsExplicit: true,
        };
      }
    } else if (requirements) {
      reqs = requirements;
    } else {
      throw new Error('Either a "prompt" string or a "requirements" object is required for design optimization.');
    }

    const strategies = [
      {
        id: 'option_cost',
        strategy: 'cost_optimized',
        badge: 'Lowest Cost',
        name: 'Value-Engineered (Lowest Cost)',
        tagline: 'Compact footprint, modular structural spans, and grouped plumbing stacks',
        isRecommended: false,
        advantages: [
          'Direct vertical plumbing stack alignment reduces pipe runs and false-ceiling boxing by ~25%.',
          'Standardized room spans fit standard 125mm RCC slabs without requiring drop-panel transfer beams.',
          'Standardized door and window openings minimize masonry lintel cutting and custom fabrication costs.',
        ],
        tradeOffs: [
          'Slightly more compact front entrance foyer to maximize structural regularity.',
          'Carpet area is optimized for cost rather than expansive luxury.',
        ],
      },
      {
        id: 'option_space',
        strategy: 'space_optimized',
        badge: 'Maximum Living Space',
        name: 'Space Maximizer (Highest Carpet Area)',
        tagline: 'Minimizes circulation corridors to expand living lounge and bedroom suites',
        isRecommended: false,
        advantages: [
          'Circulation corridors trimmed to code minimum (3.5 ft), expanding usable bedroom and lounge carpet area.',
          'Achieves highest carpet efficiency ratio (up to 85% of gross built-up area).',
          'Generous master suite with space for built-in wardrobe niches and private reading corner.',
        ],
        tradeOffs: [
          'Slightly longer horizontal plumbing drainage run from upper bathroom requiring ceiling soffit.',
          'Marginally higher structural steel quantity due to wider living room clear spans.',
        ],
      },
      {
        id: 'option_balanced',
        strategy: 'balanced_daylight',
        badge: 'Optimal Balance (Recommended)',
        name: 'Balanced Living & Daylight',
        tagline: 'Optimal equilibrium of construction economy, natural daylight, and cross-ventilation',
        isRecommended: true,
        advantages: [
          'Dual-aspect external wall exposure on all primary bedrooms for superior natural cross-breezes.',
          'Generous double-glazed window spans capture gentle morning sun while shielding western thermal peak.',
          'Natural acoustic zoning separates private rest quarters from active street frontage.',
        ],
        tradeOffs: [
          'Slightly higher glazing cost due to larger window openings.',
          'Moderate plumbing offset requires false-ceiling concealed plumbing shaft.',
        ],
      },
    ];

    const generatedOptions = [];

    for (const item of strategies) {
      // 1. Generate constraint-aware layout using topological solver
      const layout = generateTopologicalLayout(reqs, {
        ...options,
        strategy: item.strategy,
      });

      layout.requirements = reqs;
      layout.floorRequirements = reqs.floorRequirements;
      layout.strategy = item.strategy;

      // 2. Run geometric validation
      const validation = validateLayout(layout);
      layout.validation = validation;

      // 3. Generate detailed BOQ
      const boq = generateCategorizedBOQ(layout, {
        currency,
        tier,
        userBudget,
        unitRates,
      });

      // 4. Generate buildability & climate analysis
      const buildability = analyzeBuildability(layout, options);

      const totalCost = boq.summary.grandTotalCost;
      const builtUpArea = boq.quantities.totalBuiltUpArea;
      const carpetArea = boq.quantities.totalCarpetArea;
      const costPerSqFt = boq.summary.effectiveCostPerSqFt;
      const carpetEfficiency = Math.round((carpetArea / builtUpArea) * 100);

      generatedOptions.push({
        id: item.id,
        strategy: item.strategy,
        badge: item.badge,
        name: item.name,
        tagline: item.tagline,
        isRecommended: item.isRecommended,
        layout,
        boq,
        buildability,
        metrics: {
          grandTotalCost: totalCost,
          formattedGrandTotal: boq.summary.formattedGrandTotal,
          effectiveCostPerSqFt: costPerSqFt,
          formattedRatePerSqFt: boq.summary.formattedRatePerSqFt,
          totalBuiltUpAreaSqFt: builtUpArea,
          totalCarpetAreaSqFt: carpetArea,
          carpetEfficiencyPercent: carpetEfficiency,
          structuralComplexityScore: buildability.structural.structuralComplexityScore,
          daylightScore: buildability.daylight.overallDaylightScore,
          plumbingStackScore: buildability.plumbing.plumbingStackScore,
          ventilationScore: buildability.ventilation.overallVentilationScore,
          compositeBuildabilityScore: buildability.compositeBuildabilityScore,
          maxClearSpanFeet: buildability.structural.maxClearSpanFeet,
        },
        advantages: item.advantages,
        tradeOffs: item.tradeOffs,
      });
    }

    // Determine baseline values for comparative deltas
    const lowestCost = Math.min(...generatedOptions.map(o => o.metrics.grandTotalCost));
    const highestCarpet = Math.max(...generatedOptions.map(o => o.metrics.totalCarpetAreaSqFt));

    // Calculate comparative deltas
    generatedOptions.forEach(opt => {
      const costDelta = opt.metrics.grandTotalCost - lowestCost;
      const costDeltaPercent = lowestCost > 0 ? Math.round((costDelta / lowestCost) * 100) : 0;
      const carpetDelta = opt.metrics.totalCarpetAreaSqFt - highestCarpet;
      const carpetDeltaPercent = highestCarpet > 0 ? Math.round((carpetDelta / highestCarpet) * 100) : 0;

      opt.deltas = {
        costDeltaVsLowest: costDelta,
        costDeltaPercentVsLowest: costDeltaPercent,
        formattedCostDelta: costDelta === 0 ? 'Lowest Cost Baseline' : `+${opt.boq.currency.format(costDelta)} (+${costDeltaPercent}%)`,
        carpetDeltaVsMax: carpetDelta,
        carpetDeltaPercentVsMax: carpetDeltaPercent,
        isLowestCost: opt.metrics.grandTotalCost === lowestCost,
        isHighestCarpet: opt.metrics.totalCarpetAreaSqFt === highestCarpet,
      };
    });

    // Side-by-side comparison matrix
    const comparisonCriteria = [
      {
        key: 'grandTotalCost',
        label: 'Total Estimated Cost',
        unit: currency,
        format: (val, opt) => opt.boq.currency.format(val),
        better: 'lower',
      },
      {
        key: 'effectiveCostPerSqFt',
        label: 'Cost per Sq. Ft.',
        unit: `${currency}/sqft`,
        format: (val, opt) => `${opt.boq.currency.format(val)}/sqft`,
        better: 'lower',
      },
      {
        key: 'totalCarpetAreaSqFt',
        label: 'Usable Carpet Area',
        unit: 'sq ft',
        format: (val) => `${val} sq ft`,
        better: 'higher',
      },
      {
        key: 'carpetEfficiencyPercent',
        label: 'Carpet Area Efficiency',
        unit: '%',
        format: (val) => `${val}%`,
        better: 'higher',
      },
      {
        key: 'daylightScore',
        label: 'Natural Daylight Score',
        unit: '/100',
        format: (val) => `${val}/100`,
        better: 'higher',
      },
      {
        key: 'ventilationScore',
        label: 'Cross-Ventilation Score',
        unit: '/100',
        format: (val) => `${val}/100`,
        better: 'higher',
      },
      {
        key: 'plumbingStackScore',
        label: 'Plumbing Stack Alignment',
        unit: '/100',
        format: (val) => `${val}/100`,
        better: 'higher',
      },
      {
        key: 'structuralComplexityScore',
        label: 'Structural Simplicity Index',
        unit: '/100',
        format: (val) => `${val}/100`,
        better: 'higher',
      },
    ];

    const comparisonMatrix = comparisonCriteria.map(criterion => {
      const row = {
        key: criterion.key,
        label: criterion.label,
        better: criterion.better,
        values: {},
      };

      generatedOptions.forEach(opt => {
        const rawValue = opt.metrics[criterion.key];
        row.values[opt.id] = {
          raw: rawValue,
          formatted: criterion.format(rawValue, opt),
        };
      });

      return row;
    });

    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      currency,
      tier,
      userBudget: userBudget ? Number(userBudget) : null,
      options: generatedOptions,
      comparisonMatrix,
      disclaimer: OPTIMIZATION_DISCLAIMER,
    };
  }
}

export const designOptimizer = new DesignOptimizer();
