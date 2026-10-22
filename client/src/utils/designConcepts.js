/**
 * ArchAI Phase 6 & 7.2 — Architectural Design Concepts
 *
 * Defines 4 distinct, cohesive architectural design concepts that drive:
 * - Exterior facade finishes & accent claddings
 * - Boundary wall and entrance gate styling
 * - Window trims, doors, and metal finishes
 * - Landscape styling and plant palettes
 * - Interior lighting atmosphere and architectural trade-offs
 */

export const DESIGN_CONCEPTS = {
  contemporary_minimalist: {
    id: 'contemporary_minimalist',
    name: 'Modern Indian Contemporary',
    subtitle: 'Terracotta Jali, Warm Stone & Teak Accents',
    description: 'Contemporary Indian architecture celebrating tropical climate responsiveness. Features warm sand-colored plaster, exposed terracotta jali screens for passive cooling, rich teak wood door finishes, brass/copper metallic accents, motorized horizontal security gate, and lush fragrant courtyard landscaping.',
    wallColor: 0xfaf5ee,
    wallRoughness: 0.88,
    accentColor: 0xc2410c, // Terracotta
    woodTrim: 0x92400e,    // Rich teak
    metalTrim: 0x78350f,   // Warm bronze / antique brass
    facadeAccentColor: 0xc2410c,
    roofColor: 0x292524,
    slabColor: 0xf5ebd7,
    boundaryWallColor: 0xf5ebd7,
    copingColor: 0x9a3412,
    gateColor: 0x451a03,
    pavingColor: 0xd6c7b2, // Kota / Jaisalmer sandstone pavers
    grassColor: 0x15803d,
    terraceRailColor: 0xc2410c,
    doorStyle: 'timber_batten',
    gateStyle: 'horizontal_slats',
    lightingTone: 'warm_2700k',
    tradeoffs: {
      pros: [
        'Passive solar cooling via terracotta jali screens reduces air-conditioning load by up to 25%',
        'Vastu-compatible zoning with harmonious North-facing entrance orientation',
        'Timeless contemporary regional identity with high cultural and architectural resonance',
        'Natural stone paving and breathable lime-wash finishes age gracefully with zero peeling'
      ],
      cons: [
        'Terracotta jali screens require skilled craftsmanship and careful detailing',
        'Exterior natural teak trims benefit from yearly protective nourishment in direct rain'
      ],
      estimatedCostMultiplier: 1.16,
      maintenanceLevel: 'Moderate'
    }
  },

  warm_japandi: {
    id: 'warm_japandi',
    name: 'Warm Minimalist',
    subtitle: 'Lime-Wash Stucco, Natural Oak & Clean Geometries',
    description: 'Clean geometric masses softened by tactile organic warmth. Features subtle off-white lime-wash stucco, natural light oak louvers, slim dark slate aluminum window mullions, concealed entrance niches, and tranquil zen rock-and-moss landscaping.',
    wallColor: 0xf8fafc,
    wallRoughness: 0.85,
    accentColor: 0xd97706, // Warm oak / amber
    woodTrim: 0xb45309,
    metalTrim: 0x334155,
    facadeAccentColor: 0x64748b,
    roofColor: 0x0f172a,
    slabColor: 0xe2e8f0,
    boundaryWallColor: 0xe2e8f0,
    copingColor: 0x1e293b,
    gateColor: 0x1e293b,
    pavingColor: 0x94a3b8,
    grassColor: 0x22c55e,
    terraceRailColor: 0x38bdf8,
    doorStyle: 'flush_modern',
    gateStyle: 'vertical_timber',
    lightingTone: 'clean_neutral',
    tradeoffs: {
      pros: [
        'Maximum daylight penetration with uncluttered interior sightlines',
        'Minimalist forms streamline construction timelines and simplify waterproofing',
        'Highly versatile interior backdrop accommodating diverse furniture palettes'
      ],
      cons: [
        'Requires immaculate surface plastering tolerances as imperfections are visible',
        'Neutral off-white exterior stucco benefits from gentle power-washing every two years'
      ],
      estimatedCostMultiplier: 1.12,
      maintenanceLevel: 'Low to Moderate'
    }
  },

  mediterranean_villa: {
    id: 'mediterranean_villa',
    name: 'Tropical Modern',
    subtitle: 'Verandahs, Teak Louvers & Biophilic Landscaping',
    description: 'Seamless indoor-outdoor tropical sanctuary. Features deep sheltering roof overhangs, slatted teak louvers for cross-ventilation, warm textured sandstone wall claddings, wide verandah transitions, and lush tropical flora including broad-leaf palms and flowering frangipani.',
    wallColor: 0xfef9c3,
    wallRoughness: 0.9,
    accentColor: 0x15803d, // Biophilic lush green
    woodTrim: 0x78350f,
    metalTrim: 0x292524,
    facadeAccentColor: 0x854d0e,
    roofColor: 0x451a03,
    slabColor: 0xfef08a,
    boundaryWallColor: 0xfef08a,
    copingColor: 0x78350f,
    gateColor: 0x451a03,
    pavingColor: 0xca8a04,
    grassColor: 0x16a34a,
    terraceRailColor: 0x78350f,
    doorStyle: 'louvered_timber',
    gateStyle: 'slatted_teak',
    lightingTone: 'golden_sunset',
    tradeoffs: {
      pros: [
        'Superior thermal comfort in high-heat and monsoon climates through deep verandah shading',
        'Exceptional cross-ventilation keeps interior humidity low and indoor air fresh',
        'Resort-like tranquil atmosphere connecting daily living with nature'
      ],
      cons: [
        'Deep overhangs require structural cantilever engineering',
        'Extensive tropical landscaping needs regular watering and seasonal pruning'
      ],
      estimatedCostMultiplier: 1.2,
      maintenanceLevel: 'Moderate'
    }
  },

  industrial_loft: {
    id: 'industrial_loft',
    name: 'Premium Urban Modern',
    subtitle: 'Fluted Glass, Exposed Steel & Monolithic Stone',
    description: 'High-end architectural statement for sophisticated urban plots. Features crisp monolithic dark charcoal render, fluted architectural glass panels, dark graphite steel perimeter trims, automated motorized perforated gates, and sculptural architectural boxwood planters.',
    wallColor: 0x1e293b,
    wallRoughness: 0.82,
    accentColor: 0x38bdf8, // Electric cyan accent
    woodTrim: 0x334155,
    metalTrim: 0x020617,
    facadeAccentColor: 0x0ea5e9,
    roofColor: 0x020617,
    slabColor: 0x0f172a,
    boundaryWallColor: 0x0f172a,
    copingColor: 0x020617,
    gateColor: 0x020617,
    pavingColor: 0x334155,
    grassColor: 0x10b981,
    terraceRailColor: 0x0284c7,
    doorStyle: 'steel_pivot',
    gateStyle: 'laser_cut_steel',
    lightingTone: 'crisp_industrial',
    tradeoffs: {
      pros: [
        'Striking modern street-presence with high curb appeal and resale value',
        'Very high durability against weathering with zero wood rot risk',
        'Smart-home ready with integrated perimeter LED strips and security integration'
      ],
      cons: [
        'Dark facade absorbs more solar heat; exterior requires insulated wall build-up',
        'Structural steel sections and large glass panels have higher initial material cost'
      ],
      estimatedCostMultiplier: 1.25,
      maintenanceLevel: 'Low'
    }
  }
};

/**
 * Returns concept configuration with alias fallback
 */
export function getDesignConcept(conceptId) {
  if (!conceptId) return DESIGN_CONCEPTS.contemporary_minimalist;
  if (DESIGN_CONCEPTS[conceptId]) return DESIGN_CONCEPTS[conceptId];

  const aliasMap = {
    modern_indian_contemporary: 'contemporary_minimalist',
    warm_minimalist: 'warm_japandi',
    tropical_modern: 'mediterranean_villa',
    premium_urban_modern: 'industrial_loft'
  };

  const resolved = aliasMap[conceptId] || conceptId;
  return DESIGN_CONCEPTS[resolved] || DESIGN_CONCEPTS.contemporary_minimalist;
}
