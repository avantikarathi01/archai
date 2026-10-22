/**
 * ArchAI Construction Cost Estimation Engine
 * 
 * Provides preliminary conceptual cost estimates based on:
 * - Built-up area (sq ft) across all floor levels
 * - Number of floors and structural typology
 * - Design style and finish tiers (economy, standard, premium, luxury)
 * - Regional Indian construction cost indices
 * 
 * DISCLAIMER:
 * Cost calculations are indicative planning estimates only. Actual construction costs
 * depend on site topography, local material market rates, structural engineer specifications,
 * and contractor labor rates. ArchAI does not guarantee final tender pricing.
 */

export const COST_DISCLAIMER =
  'DISCLAIMER: Cost figures are preliminary conceptual estimates for budgeting and feasibility assessment only. ' +
  'They do not constitute a formal bill of quantities (BOQ), tender document, or contractor quote. ' +
  'Actual construction costs vary significantly based on site soil conditions, foundation depth, ' +
  'material brand selections, and local municipal bylaws. Consult a certified quantity surveyor before procuring materials.';

export const QUALITY_TIERS = {
  economy: {
    id: 'economy',
    name: 'Economy / Budget',
    baseRatePerSqFt: 1550, // INR per sq ft
    description: 'Standard load-bearing or RCC frame, local red bricks/fly-ash blocks, basic vitrified tile flooring, standard sanitary fittings, flush doors, and OBD paint.',
  },
  standard: {
    id: 'standard',
    name: 'Standard Quality',
    baseRatePerSqFt: 2100, // INR per sq ft
    description: 'RCC earthquake-resistant frame, premium double-charge vitrified tiles, branded CP/sanitaryware (Hindware/Jaguar standard), UPVC/anodized aluminum windows, semi-modular kitchen, premium acrylic emulsion.',
  },
  premium: {
    id: 'premium',
    name: 'Premium Designer',
    baseRatePerSqFt: 2950, // INR per sq ft
    description: 'High-grade RCC frame, large-format glazed vitrified tiles / Indian marble, designer concealed CP fittings, teakwood main door, full modular acrylic kitchen, sound-insulated UPVC glazing, false ceilings with ambient LED lighting.',
  },
  luxury: {
    id: 'luxury',
    name: 'Luxury Bespoke',
    baseRatePerSqFt: 4400, // INR per sq ft
    description: 'Architectural structural engineering, imported Italian marble, high-performance double-glazed thermal breaks, smart home automation, bespoke veneer woodwork, high-end sanitaryware (Grohe/Kohler), designer landscaping, and custom facade louvers.',
  },
};

export const STYLE_COST_MULTIPLIERS = {
  indian_modern: 1.10,
  contemporary_minimalist: 1.15,
  warm_japandi: 1.22,
  traditional: 1.08,
  unspecified: 1.00,
};

/**
 * Calculates itemized conceptual construction cost for a given floor plan layout
 * 
 * @param {object} layout - Canonical ArchAI layout object
 * @param {object} options - Optional configuration { tier, designStyle, regionalIndex, currency }
 * @returns {object} Cost estimation result
 */
export function estimateDesignCost(layout, options = {}) {
  if (!layout) {
    throw new Error('A valid layout object is required for cost estimation.');
  }

  const { plot = {}, summary = {}, metadata = {} } = layout;
  const builtUpArea = summary.totalBuiltUpAreaSqFt || Math.round((summary.totalCarpetAreaSqFt || (plot.width * plot.length * 0.75)) * 1.15);
  const floorsCount = Math.max(1, metadata.floorsCount || 1);

  const selectedTier = (options.tier || metadata.budgetTier || 'standard').toLowerCase();
  const tierConfig = QUALITY_TIERS[selectedTier] || QUALITY_TIERS.standard;

  const styleKey = (options.designStyle || metadata.designStyle || 'unspecified').toLowerCase();
  const styleMultiplier = STYLE_COST_MULTIPLIERS[styleKey] || 1.0;

  // Additional floor discount/overhead factor (staircases and vertical lift plumbing add ~3% per upper floor)
  const multiFloorFactor = floorsCount > 1 ? 1 + (floorsCount - 1) * 0.03 : 1.0;

  const effectiveRatePerSqFt = Math.round(tierConfig.baseRatePerSqFt * styleMultiplier * multiFloorFactor);
  const expectedTotalCostINR = Math.round(builtUpArea * effectiveRatePerSqFt);

  // Range +/- 10% for realistic volatility
  const minCostINR = Math.round(expectedTotalCostINR * 0.90);
  const maxCostINR = Math.round(expectedTotalCostINR * 1.12);

  // Itemized breakdown based on standard Indian civil construction cost distribution
  const breakdown = {
    civilAndStructure: {
      percentage: 48,
      estimatedINR: Math.round(expectedTotalCostINR * 0.48),
      scope: 'Excavation, foundation, RCC columns, beams, roof slabs, brick masonry, and external plastering',
    },
    finishingAndFlooring: {
      percentage: 24,
      estimatedINR: Math.round(expectedTotalCostINR * 0.24),
      scope: 'Vitrified/marble flooring, wall putty, interior acrylic emulsion, false ceilings, and bathroom tiling',
    },
    mepAndPlumbing: {
      percentage: 16,
      estimatedINR: Math.round(expectedTotalCostINR * 0.16),
      scope: 'Concealed electrical wiring, modular switches, CPVC plumbing lines, sanitary fixtures, and septic connections',
    },
    doorsAndWindows: {
      percentage: 8,
      estimatedINR: Math.round(expectedTotalCostINR * 0.08),
      scope: 'Main entrance door, flush doors, UPVC window frames, clear glazing, and architectural hardware',
    },
    exteriorAndBoundary: {
      percentage: 4,
      estimatedINR: Math.round(expectedTotalCostINR * 0.04),
      scope: 'Compound boundary wall, MS entrance gate, driveway pavers, and exterior illumination',
    },
  };

  const toLakhs = (val) => Number((val / 100000).toFixed(2));
  const toCrores = (val) => Number((val / 10000000).toFixed(2));

  return {
    status: 'success',
    metrics: {
      builtUpAreaSqFt: builtUpArea,
      floorsCount,
      qualityTier: tierConfig.id,
      tierName: tierConfig.name,
      designStyle: styleKey,
      styleMultiplier,
      ratePerSqFtINR: effectiveRatePerSqFt,
    },
    totalCost: {
      currency: 'INR',
      expectedINR: expectedTotalCostINR,
      minINR: minCostINR,
      maxINR: maxCostINR,
      expectedLakhs: toLakhs(expectedTotalCostINR),
      rangeLakhs: { min: toLakhs(minCostINR), max: toLakhs(maxCostINR) },
      expectedCrores: expectedTotalCostINR >= 10000000 ? toCrores(expectedTotalCostINR) : null,
    },
    itemizedBreakdown: breakdown,
    assumptions: [
      `Assumes ${tierConfig.name} specification standard.`,
      `Built-up area calculated at ${builtUpArea} sq ft including 15% structural wall and passage overhead.`,
      `Design style multiplier applied: ${styleMultiplier}x for ${styleKey.replace(/_/g, ' ')}.`,
      'Excludes land acquisition cost, legal registration fees, architect design fees, and furniture/appliances.',
    ],
    disclaimer: COST_DISCLAIMER,
  };
}
