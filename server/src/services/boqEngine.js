/**
 * ArchAI Bill of Quantities (BOQ) & Measurable Cost Estimation Engine
 * 
 * Computes architectural quantities directly from the canonical floor plan geometry:
 * - Net masonry areas (gross wall area minus door and window openings)
 * - Room floor finish areas by functional category
 * - Door and window counts and opening square footage
 * - Concrete volumes for foundation footings, columns, beams, and slabs
 * - Plumbing and sanitary points based on wet rooms
 * - Electrical conduit and wiring points by room area
 * - Waterproofing areas for wet rooms, balconies, terraces, and plunge pools
 * - Plunge pool specialty works (RCC shell, crystalline waterproofing, mosaic tiles, pump & filtration plant)
 * - Staircase granite cladding and stainless steel glass railings
 * - Overheads, labour, contingency, and applicable taxes
 * 
 * DISCLAIMER:
 * Calculations are preliminary planning heuristics for budgeting and design optimization.
 * Actual tender pricing requires a certified Quantity Surveyor (QS) detailed bill of quantities
 * based on structural working drawings, soil strata, and local market quotations.
 */

export const BOQ_DISCLAIMER =
  'PRELIMINARY ESTIMATE NOTICE: Quantities and unit rates are indicative engineering approximations based on ' +
  'conceptual CAD geometry and standard civil engineering norms. They do not constitute a certified quantity surveyor tender ' +
  'document or binding contractor quotation. Actual costs vary with site topography, soil bearing capacity, structural beam depth, ' +
  'material brand selections, and local municipal bylaws. Consult a licensed civil engineer or quantity surveyor before execution.';

export const CURRENCY_CONFIGS = {
  INR: { code: 'INR', symbol: '₹', exchangeFromINR: 1.0, name: 'Indian Rupee', format: (v) => `₹${Number(v).toLocaleString('en-IN')}` },
  USD: { code: 'USD', symbol: '$', exchangeFromINR: 0.012, name: 'US Dollar', format: (v) => `$${Number(v).toLocaleString('en-US')}` },
  EUR: { code: 'EUR', symbol: '€', exchangeFromINR: 0.011, name: 'Euro', format: (v) => `€${Number(v).toLocaleString('de-DE')}` },
  GBP: { code: 'GBP', symbol: '£', exchangeFromINR: 0.0095, name: 'British Pound', format: (v) => `£${Number(v).toLocaleString('en-GB')}` },
  AED: { code: 'AED', symbol: 'AED ', exchangeFromINR: 0.044, name: 'UAE Dirham', format: (v) => `AED ${Number(v).toLocaleString('en-AE')}` },
};

export const QUALITY_TIER_CONFIGS = {
  economy: {
    id: 'economy',
    name: 'Economy / Budget',
    multiplier: 0.78,
    description: 'Standard fly-ash brick masonry, basic vitrified flooring (₹55/sqft), standard CP fittings, flush doors, and OBD paint.',
  },
  standard: {
    id: 'standard',
    name: 'Standard Quality',
    multiplier: 1.0,
    description: 'RCC earthquake-resistant frame, double-charged vitrified tiles (₹85/sqft), branded CP fittings, UPVC windows, acrylic emulsion.',
  },
  premium: {
    id: 'premium',
    name: 'Premium Designer',
    multiplier: 1.38,
    description: 'High-grade RCC frame, large-format glazed vitrified tiles / Indian marble (₹150/sqft), designer concealed CP, teak main door, false ceiling with LED.',
  },
};

/**
 * Baseline Indian CPWD / DSR 2024 Reference Rates (in INR)
 * Used as default placeholder unit rates, fully editable by users.
 */
export const DEFAULT_UNIT_RATES_INR = {
  // 1. Substructure & Earthwork
  excavation: 18,              // per cu ft
  anti_termite: 14,             // per sq ft of plinth
  pcc_bed: 175,                 // per cu ft
  rcc_footings_plinth: 310,     // per cu ft
  plinth_filling: 24,           // per cu ft

  // 2. Superstructure & Masonry
  rcc_columns_beams: 380,       // per cu ft
  rcc_roof_slab: 290,           // per sq ft (including formwork & 125mm slab)
  masonry_ext_9in: 140,         // per sq ft of 9" external wall
  masonry_int_4in: 85,          // per sq ft of 4.5" internal partition
  plaster_ext_waterproof: 34,   // per sq ft
  plaster_int_smooth: 26,       // per sq ft

  // 3. Flooring & Finishes
  tile_living_vitrified: 95,    // per sq ft (material + fixing)
  tile_bedroom_flooring: 85,    // per sq ft
  tile_bathroom_antiskid: 75,   // per sq ft
  tile_bathroom_dado: 70,       // per sq ft of wall
  kitchen_counter_granite: 240, // per sq ft
  paving_parking_blocks: 65,    // per sq ft

  // 4. Doors & Windows
  door_main_entrance: 22000,    // per unit (teak/designer engineered with lock)
  door_internal_flush: 6500,    // per unit
  door_wet_room_frp: 4800,      // per unit
  window_upvc_glazing: 480,     // per sq ft (double track 5mm toughened)
  window_ventilator: 2800,      // per unit

  // 5. Plumbing & Sanitary
  plumbing_water_supply: 90,    // per rft of CPVC
  plumbing_drainage_pipes: 115, // per rft of SWR
  sanitary_fixtures_suite: 14500,// per bathroom suite (EWC + basin + CP fittings)
  kitchen_sink_fixtures: 7500,  // per kitchen
  overhead_water_tank: 14000,   // per 1500L tank installed

  // 6. Electrical & Lighting
  electrical_points: 950,       // per electrical point (wiring + switch)
  electrical_power_points: 1650,// per 16A power point (AC/geyser)
  electrical_distribution: 18000,// per panel with MCBs & earthing

  // 7. Painting & Waterproofing
  paint_interior_emulsion: 22,  // per sq ft (2 coats putty + primer + 2 coats emulsion)
  paint_exterior_weatherproof: 28,// per sq ft
  waterproofing_wet_areas: 55,  // per sq ft (bathroom/balcony crystalline)
  waterproofing_terrace: 65,    // per sq ft

  // 8. Plunge Pool Specialty
  plunge_pool_rcc_basin: 380,   // per cu ft of concrete basin shell
  plunge_pool_waterproofing: 95,// per sq ft of inner basin surface
  plunge_pool_mosaic_tile: 160, // per sq ft of glass mosaic tile
  plunge_pool_filtration_skid: 68000, // per package (0.75HP pump + filter + skimmer)
  plunge_pool_fittings_ladder: 24000, // per package (LED spot + SS ladder + suction)
  plunge_pool_elevated_surcharge: 35000, // per elevated upper floor pool (structural drop panel allowance)

  // 9. Staircase & Balcony
  stair_step_granite_cladding: 1400, // per step tread + riser
  balcony_railing_ss_glass: 1650,    // per rft

  // 10. Indirect & Overheads
  contractor_overhead_percent: 10,   // 10%
  contingency_percent: 3,            // 3%
  statutory_tax_percent: 18,         // 18% GST where configured
};

/**
 * Extract measurable quantities from canonical layout geometry
 */
export function extractMeasurableQuantities(layout) {
  if (!layout) throw new Error('Layout object is required to extract quantities.');

  const plot = layout.plot || { width: 30, length: 40 };
  const plotWidth = Number(plot.width) || 30;
  const plotLength = Number(plot.length) || 40;
  const plotArea = plotWidth * plotLength;

  const rooms = Array.isArray(layout.rooms) ? layout.rooms : [];
  const floors = Array.from(new Set(rooms.map(r => r.level || 0))).sort((a, b) => a - b);
  const floorsCount = Math.max(1, floors.length);

  // Group rooms by floor
  const groundRooms = rooms.filter(r => (r.level || 0) === 0);
  const upperRooms = rooms.filter(r => (r.level || 0) > 0);

  // Ground footprint & built-up areas
  const groundFloorCarpetArea = groundRooms.reduce((sum, r) => sum + (r.width * r.length), 0);
  const upperFloorCarpetArea = upperRooms.reduce((sum, r) => sum + (r.width * r.length), 0);
  const totalCarpetArea = groundFloorCarpetArea + upperFloorCarpetArea;

  // Structural wall factor (approx 15% of floor area)
  const totalBuiltUpArea = layout.summary?.totalBuiltUpAreaSqFt || Math.round(totalCarpetArea * 1.15);
  const groundFootprintArea = groundFloorCarpetArea > 0 ? Math.round(groundFloorCarpetArea * 1.15) : Math.round(plotArea * 0.7);

  // Wall perimeter calculations
  // Estimate exterior perimeter from plot footprint bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  rooms.forEach(r => {
    if (r.x < minX) minX = r.x;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y < minY) minY = r.y;
    if (r.y + r.length > maxY) maxY = r.y + r.length;
  });

  const bBoxW = (maxX > minX && isFinite(minX)) ? (maxX - minX) : plotWidth;
  const bBoxL = (maxY > minY && isFinite(minY)) ? (maxY - minY) : plotLength;

  // Per-floor exterior perimeter
  const singleFloorExtPerimeter = 2 * (bBoxW + bBoxL);
  const exteriorWallLinearFt = Math.round(singleFloorExtPerimeter * floorsCount);

  // Interior partition length: sum of room perimeters minus exterior perimeter, halved
  const totalRoomPerimeterSum = rooms.reduce((sum, r) => sum + 2 * (r.width + r.length), 0);
  const interiorWallLinearFt = Math.max(0, Math.round((totalRoomPerimeterSum - exteriorWallLinearFt) / 2));

  const ceilingHeightFt = 10.0;
  const grossWallAreaSqFt = Math.round((exteriorWallLinearFt + interiorWallLinearFt) * ceilingHeightFt);

  // Openings: Doors and Windows
  let totalDoorCount = 0;
  let mainEntranceDoorCount = 0;
  let internalDoorCount = 0;
  let wetRoomDoorCount = 0;
  let totalDoorAreaSqFt = 0;

  let totalWindowCount = 0;
  let totalWindowAreaSqFt = 0;

  rooms.forEach(r => {
    const doors = Array.isArray(r.doors) ? r.doors : [];
    const windows = Array.isArray(r.windows) ? r.windows : [];

    doors.forEach(d => {
      totalDoorCount++;
      const dw = d.width || 3.0;
      const dh = 7.0;
      totalDoorAreaSqFt += dw * dh;

      const label = (d.label || '').toLowerCase();
      if (r.type === 'foyer' || label.includes('main') || label.includes('entrance')) {
        mainEntranceDoorCount++;
      } else if (r.type === 'bathroom' || r.type === 'utility') {
        wetRoomDoorCount++;
      } else {
        internalDoorCount++;
      }
    });

    windows.forEach(w => {
      totalWindowCount++;
      const ww = w.width || 4.0;
      const wh = (r.type === 'bathroom') ? 2.0 : 4.0;
      totalWindowAreaSqFt += ww * wh;
    });
  });

  // Guarantee minimum standard doors if none explicitly in array
  if (totalDoorCount === 0) {
    mainEntranceDoorCount = 1;
    wetRoomDoorCount = rooms.filter(r => r.type === 'bathroom').length || 2;
    internalDoorCount = Math.max(2, rooms.length - wetRoomDoorCount - 1);
    totalDoorCount = mainEntranceDoorCount + internalDoorCount + wetRoomDoorCount;
    totalDoorAreaSqFt = totalDoorCount * 21; // 3x7 ft
  }

  if (totalWindowCount === 0) {
    totalWindowCount = Math.max(4, Math.round(rooms.length * 0.8));
    totalWindowAreaSqFt = totalWindowCount * 16; // 4x4 ft
  }

  const netMasonryAreaSqFt = Math.max(0, grossWallAreaSqFt - (totalDoorAreaSqFt + totalWindowAreaSqFt));

  // Flooring areas by room type
  let livingFlooringSqFt = 0;
  let bedroomFlooringSqFt = 0;
  let bathroomFlooringSqFt = 0;
  let parkingFlooringSqFt = 0;
  let balconyFlooringSqFt = 0;
  let staircaseFlooringSqFt = 0;

  rooms.forEach(r => {
    const area = r.width * r.length;
    const type = (r.type || '').toLowerCase();
    if (type.includes('bed')) bedroomFlooringSqFt += area;
    else if (type.includes('bath')) bathroomFlooringSqFt += area;
    else if (type.includes('park')) parkingFlooringSqFt += area;
    else if (type.includes('balcony')) balconyFlooringSqFt += area;
    else if (type.includes('stair')) staircaseFlooringSqFt += area;
    else livingFlooringSqFt += area; // living, dining, foyer, kitchen, storage
  });

  // Wet Rooms & Plunge Pool
  const bathroomCount = rooms.filter(r => (r.type || '').includes('bath')).length;
  const kitchenCount = Math.max(1, rooms.filter(r => (r.type || '').includes('kitchen')).length);
  const plungePoolRooms = rooms.filter(r => (r.type || '').includes('pool'));
  const hasPlungePool = plungePoolRooms.length > 0;
  const plungePoolCount = plungePoolRooms.length;
  const hasElevatedPool = plungePoolRooms.some(r => (r.level || 0) > 0);

  // Plunge pool dimensions & volume
  let poolBasinSurfaceSqFt = 0;
  let poolConcreteVolumeCuFt = 0;
  plungePoolRooms.forEach(p => {
    const pw = Math.max(4, p.width - 2);
    const pl = Math.max(5, p.length - 2);
    const pd = 3.5; // 3.5 ft water depth
    // Floor + 4 walls
    poolBasinSurfaceSqFt += (pw * pl) + 2 * (pw + pl) * pd;
    // 6-inch (0.5 ft) RCC walls & base shell
    const outerW = pw + 1.0;
    const outerL = pl + 1.0;
    const outerD = pd + 0.5;
    poolConcreteVolumeCuFt += (outerW * outerL * outerD) - (pw * pl * pd);
  });

  // Balcony perimeter
  const balconyRooms = rooms.filter(r => (r.type || '').includes('balcony'));
  const balconyRailingFt = balconyRooms.reduce((sum, b) => sum + b.width + 2 * b.length, 0);

  // Staircase steps (14 steps per floor level)
  const stairStepsCount = floorsCount > 1 ? (floorsCount - 1) * 14 : 0;

  // Electrical points (approx 1 light point per 40 sq ft, 1 power point per 120 sq ft)
  const lightPointsCount = Math.max(20, Math.round(totalCarpetArea / 38));
  const powerPointsCount = Math.max(8, Math.round(totalCarpetArea / 110));

  // Foundation Excavation & Slabs
  // Isolated footings + grade slab: approx 1 column footing per 130 sq ft ground footprint
  const columnCount = Math.max(8, Math.round(groundFootprintArea / 120));
  const footingVolumeCuFt = columnCount * (5 * 5 * 5); // 5x5 ft pit 5ft deep
  const rccFootingsConcreteCuFt = Math.round(columnCount * 35); // 35 cu ft RCC per footing
  const rccColumnsConcreteCuFt = Math.round(columnCount * floorsCount * (0.75 * 1.0 * ceilingHeightFt)); // 9x12" column

  return {
    plotWidth,
    plotLength,
    plotArea,
    floorsCount,
    groundFootprintArea,
    totalCarpetArea,
    totalBuiltUpArea,
    rccSlabSqFt: totalBuiltUpArea,
    exteriorWallLinearFt,
    interiorWallLinearFt,
    grossWallAreaSqFt,
    netMasonryAreaSqFt,
    totalDoorCount,
    mainEntranceDoorCount,
    internalDoorCount,
    wetRoomDoorCount,
    totalDoorAreaSqFt,
    totalWindowCount,
    totalWindowAreaSqFt,
    livingFlooringSqFt,
    bedroomFlooringSqFt,
    bathroomFlooringSqFt,
    parkingFlooringSqFt,
    balconyFlooringSqFt,
    staircaseFlooringSqFt,
    bathroomCount,
    kitchenCount,
    hasPlungePool,
    plungePoolCount,
    hasElevatedPool,
    poolBasinSurfaceSqFt,
    poolConcreteVolumeCuFt,
    balconyRailingFt,
    stairStepsCount,
    lightPointsCount,
    powerPointsCount,
    columnCount,
    footingVolumeCuFt,
    rccFootingsConcreteCuFt,
    rccColumnsConcreteCuFt,
  };
}

/**
 * Generates an itemized, categorized Bill of Quantities (BOQ) with measurable quantities
 * 
 * @param {object} layout - Canonical ArchAI layout object
 * @param {object} options - Configuration options { tier, currency, customRates, userBudget }
 * @returns {object} Categorized BOQ and financial metrics
 */
export function generateCategorizedBOQ(layout, options = {}) {
  const quantities = extractMeasurableQuantities(layout);

  const tierKey = (options.tier || layout.metadata?.budgetTier || 'standard').toLowerCase();
  const tierConfig = QUALITY_TIER_CONFIGS[tierKey] || QUALITY_TIER_CONFIGS.standard;

  const currencyKey = (options.currency || 'INR').toUpperCase();
  const currencyConfig = CURRENCY_CONFIGS[currencyKey] || CURRENCY_CONFIGS.INR;

  // Merge custom unit rates over default rates
  const customRates = options.customRates || {};
  const activeRates = { ...DEFAULT_UNIT_RATES_INR, ...customRates };

  // Helper to compute line item
  const createItem = (id, category, name, qty, unit, defaultRateINR, assumptions, rateSource = 'CPWD DSR 2024 / Market Heuristic') => {
    const rawRateINR = Number(activeRates[id] !== undefined ? activeRates[id] : defaultRateINR);
    // Apply quality tier multiplier to finishing and structural components
    const adjustedRateINR = Math.round(rawRateINR * (id.includes('excavation') || id.includes('anti_termite') ? 1.0 : tierConfig.multiplier));
    
    // Convert to target currency
    const unitRate = Number((adjustedRateINR * currencyConfig.exchangeFromINR).toFixed(2));
    const subtotal = Math.round(qty * unitRate);

    return {
      id,
      category,
      name,
      quantity: Math.round(qty * 10) / 10,
      unit,
      unitRate,
      rawRateINR,
      subtotal,
      currency: currencyConfig.code,
      currencySymbol: currencyConfig.symbol,
      isPlaceholder: true,
      assumptions,
      rateSource,
    };
  };

  const categories = [];

  // =========================================================================
  // 1. SUBSTRUCTURE & FOUNDATION
  // =========================================================================
  const cat1Items = [
    createItem(
      'excavation',
      'Substructure & Foundation',
      'Earthwork excavation in foundation pits & plinth trenches',
      quantities.footingVolumeCuFt,
      'cu ft',
      DEFAULT_UNIT_RATES_INR.excavation,
      `Based on ${quantities.columnCount} isolated pad footings excavated 5.0 ft deep in ordinary soil.`
    ),
    createItem(
      'anti_termite',
      'Substructure & Foundation',
      'Chemical anti-termite treatment (pre-construction)',
      quantities.groundFootprintArea,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.anti_termite,
      `Covers ground plinth footprint (${quantities.groundFootprintArea} sq ft) along footing trenches and slab base.`
    ),
    createItem(
      'pcc_bed',
      'Substructure & Foundation',
      'Plain Cement Concrete (PCC 1:4:8) leveling base course',
      Math.round(quantities.columnCount * 12.5),
      'cu ft',
      DEFAULT_UNIT_RATES_INR.pcc_bed,
      '100mm thick PCC bed under RCC column footings.'
    ),
    createItem(
      'rcc_footings_plinth',
      'Substructure & Foundation',
      'RCC (M25) footings, pedestal columns & plinth tie beams',
      quantities.rccFootingsConcreteCuFt,
      'cu ft',
      DEFAULT_UNIT_RATES_INR.rcc_footings_plinth,
      'Includes shuttering formwork, Fe500D steel rebars (80 kg/cu m), and pour vibrated concrete.'
    ),
  ];
  categories.push({ id: 'substructure', name: 'Substructure & Foundation', items: cat1Items });

  // =========================================================================
  // 2. SUPERSTRUCTURE & MASONRY
  // =========================================================================
  const cat2Items = [
    createItem(
      'rcc_columns_beams',
      'Superstructure & Masonry',
      'RCC (M25) columns, beams, lintels & stair strings',
      quantities.rccColumnsConcreteCuFt,
      'cu ft',
      DEFAULT_UNIT_RATES_INR.rcc_columns_beams,
      `Framed structural grid spanning ${quantities.floorsCount} levels with Fe500D reinforcement.`
    ),
    createItem(
      'rcc_roof_slab',
      'Superstructure & Masonry',
      'RCC (M25) suspended floor and terrace roof slabs (125mm)',
      quantities.totalBuiltUpArea,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.rcc_roof_slab,
      `Covers ${quantities.floorsCount} floor levels (${quantities.totalBuiltUpArea} sq ft total slab casting).`
    ),
    createItem(
      'masonry_ext_9in',
      'Superstructure & Masonry',
      'External 9-inch load-bearing / AAC block perimeter walls',
      Math.round(quantities.exteriorWallLinearFt * 10 * 0.75), // minus openings
      'sq ft',
      DEFAULT_UNIT_RATES_INR.masonry_ext_9in,
      `Calculated from ${quantities.exteriorWallLinearFt} linear ft exterior perimeter minus openings.`
    ),
    createItem(
      'masonry_int_4in',
      'Superstructure & Masonry',
      'Internal 4.5-inch room partition brickwork / blockwork',
      Math.round(quantities.interiorWallLinearFt * 10 * 0.85), // minus doors
      'sq ft',
      DEFAULT_UNIT_RATES_INR.masonry_int_4in,
      `Calculated from ${quantities.interiorWallLinearFt} linear ft internal dividing walls.`
    ),
    createItem(
      'plaster_ext_waterproof',
      'Superstructure & Masonry',
      'External cement plastering (2 coats with waterproofing additive)',
      quantities.exteriorWallLinearFt * 10,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.plaster_ext_waterproof,
      '20mm double-coat sand-faced external plaster.'
    ),
    createItem(
      'plaster_int_smooth',
      'Superstructure & Masonry',
      'Internal ceiling and wall smooth cement plastering',
      Math.round(quantities.netMasonryAreaSqFt * 1.8),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.plaster_int_smooth,
      '12mm smooth trowel finish ready for wall putty.'
    ),
  ];
  categories.push({ id: 'superstructure', name: 'Superstructure & Masonry', items: cat2Items });

  // =========================================================================
  // 3. FLOORING & FINISHES
  // =========================================================================
  const cat3Items = [
    createItem(
      'tile_living_vitrified',
      'Flooring & Finishes',
      'Living, Dining & Foyer vitrified tile / stone flooring',
      Math.max(120, quantities.livingFlooringSqFt),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.tile_living_vitrified,
      'Double-charged vitrified flooring with matching 100mm skirting.'
    ),
    createItem(
      'tile_bedroom_flooring',
      'Flooring & Finishes',
      'Bedroom premium flooring (vitrified / laminate finish)',
      Math.max(120, quantities.bedroomFlooringSqFt),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.tile_bedroom_flooring,
      'Includes underlayment membrane and expansion bead.'
    ),
    createItem(
      'tile_bathroom_antiskid',
      'Flooring & Finishes',
      'Bathroom & Balcony anti-skid matte ceramic floor tiles',
      Math.max(40, quantities.bathroomFlooringSqFt + quantities.balconyFlooringSqFt),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.tile_bathroom_antiskid,
      'Anti-skid 300x300mm ceramic tiles slope laid to floor drain.'
    ),
    createItem(
      'tile_bathroom_dado',
      'Flooring & Finishes',
      'Bathroom wall glazed ceramic dado tiles (7.0 ft height)',
      Math.max(150, quantities.bathroomCount * 175),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.tile_bathroom_dado,
      `Calculated for ${quantities.bathroomCount} bathrooms up to 7.0 ft lintel height.`
    ),
    createItem(
      'paving_parking_blocks',
      'Flooring & Finishes',
      'Car parking heavy-duty interlocking paver blocks',
      Math.max(140, quantities.parkingFlooringSqFt || 180),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.paving_parking_blocks,
      '60mm M30 heavy-duty vehicular interlocking pavers over compacted sand bed.'
    ),
    createItem(
      'kitchen_counter_granite',
      'Flooring & Finishes',
      'Kitchen platform black granite top with ceramic tile dado',
      Math.max(35, quantities.kitchenCount * 45),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.kitchen_counter_granite,
      '18mm polished jet black granite slab with sink cutout & 2ft dado.'
    ),
  ];
  categories.push({ id: 'flooring', name: 'Flooring & Finishes', items: cat3Items });

  // =========================================================================
  // 4. DOORS & WINDOWS
  // =========================================================================
  const cat4Items = [
    createItem(
      'door_main_entrance',
      'Doors & Windows',
      'Teakwood / designer engineered entrance door with mortise lock',
      quantities.mainEntranceDoorCount,
      'nos',
      DEFAULT_UNIT_RATES_INR.door_main_entrance,
      '38mm thick solid core door with premium brass hardware and eye viewer.'
    ),
    createItem(
      'door_internal_flush',
      'Doors & Windows',
      'Internal bedroom and storage flush doors with hardwood frames',
      quantities.internalDoorCount,
      'nos',
      DEFAULT_UNIT_RATES_INR.door_internal_flush,
      'Commercial flush doors with laminate skins and cylindrical SS locks.'
    ),
    createItem(
      'door_wet_room_frp',
      'Doors & Windows',
      'Waterproof FRP / PVC doors for bathrooms and wash areas',
      quantities.wetRoomDoorCount,
      'nos',
      DEFAULT_UNIT_RATES_INR.door_wet_room_frp,
      'Waterproof rigid foam PVC frame and shutter with stainless steel latches.'
    ),
    createItem(
      'window_upvc_glazing',
      'Doors & Windows',
      'UPVC 3-track sliding windows with toughened glass & mosquito mesh',
      quantities.totalWindowAreaSqFt,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.window_upvc_glazing,
      `Calculated from ${quantities.totalWindowCount} architectural window openings.`
    ),
  ];
  categories.push({ id: 'openings', name: 'Doors & Windows', items: cat4Items });

  // =========================================================================
  // 5. PLUMBING, SANITARY & DRAINAGE
  // =========================================================================
  const cat5Items = [
    createItem(
      'plumbing_water_supply',
      'Plumbing & Sanitary',
      'CPVC concealed hot & cold water supply piping network',
      Math.round(quantities.totalBuiltUpArea * 0.35),
      'rft',
      DEFAULT_UNIT_RATES_INR.plumbing_water_supply,
      'SDR 11 CPVC pipes with brass threaded fittings tested to 10 kg/cm² pressure.'
    ),
    createItem(
      'plumbing_drainage_pipes',
      'Plumbing & Sanitary',
      'SWR soil, waste & rainwater PVC drainage vertical stacks',
      Math.round(quantities.totalBuiltUpArea * 0.28),
      'rft',
      DEFAULT_UNIT_RATES_INR.plumbing_drainage_pipes,
      '110mm & 75mm SWR pipes with gully traps, vents, and inspection chambers.'
    ),
    createItem(
      'sanitary_fixtures_suite',
      'Plumbing & Sanitary',
      'Sanitaryware fixture suites (EWC, washbasin, chrome brass fittings)',
      quantities.bathroomCount,
      'suites',
      DEFAULT_UNIT_RATES_INR.sanitary_fixtures_suite,
      `Complete suite for ${quantities.bathroomCount} bathrooms: wall-hung WC, basin, diverter, shower & health faucet.`
    ),
    createItem(
      'kitchen_sink_fixtures',
      'Plumbing & Sanitary',
      'Kitchen stainless steel sink, swan neck bibcock & RO water outlet',
      quantities.kitchenCount,
      'sets',
      DEFAULT_UNIT_RATES_INR.kitchen_sink_fixtures,
      'Undermount SS 304 sink with drainboard, waste coupling, and angle valves.'
    ),
    createItem(
      'overhead_water_tank',
      'Plumbing & Sanitary',
      'Overhead multi-layer insulated water storage tank (1,500 L)',
      1,
      'unit',
      DEFAULT_UNIT_RATES_INR.overhead_water_tank,
      'Triple-layer UV-stabilized antimicrobial food-grade overhead tank with float valve.'
    ),
  ];
  categories.push({ id: 'plumbing', name: 'Plumbing & Sanitary', items: cat5Items });

  // =========================================================================
  // 6. ELECTRICAL & AUTOMATION
  // =========================================================================
  const cat6Items = [
    createItem(
      'electrical_points',
      'Electrical & Lighting',
      'Concealed wiring in PVC conduit with modular switches & fan regulators',
      quantities.lightPointsCount,
      'points',
      DEFAULT_UNIT_RATES_INR.electrical_points,
      'FRLS multi-strand copper wiring with modular polycarbonate switch plates.'
    ),
    createItem(
      'electrical_power_points',
      'Electrical & Lighting',
      'Heavy-duty 16A/25A power points for AC, geysers & kitchen appliances',
      quantities.powerPointsCount,
      'points',
      DEFAULT_UNIT_RATES_INR.electrical_power_points,
      'Dedicated 4 sq mm wiring with modular starter switches for high-load appliances.'
    ),
    createItem(
      'electrical_distribution',
      'Electrical & Lighting',
      'Main distribution board with MCBs, RCCB, and copper earth pit',
      1,
      'set',
      DEFAULT_UNIT_RATES_INR.electrical_distribution,
      'Double-door vertical DB with 63A isolator, 30mA RCCB, and chemical earthing electrode.'
    ),
  ];
  categories.push({ id: 'electrical', name: 'Electrical & Lighting', items: cat6Items });

  // =========================================================================
  // 7. PAINTING & WATERPROOFING
  // =========================================================================
  const cat7Items = [
    createItem(
      'paint_interior_emulsion',
      'Painting & Waterproofing',
      'Interior wall putty (2 coats) + primer + premium acrylic emulsion',
      Math.round(quantities.netMasonryAreaSqFt * 1.8 + quantities.totalBuiltUpArea),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.paint_interior_emulsion,
      'Zero-VOC washable acrylic interior paint over machine-sanded putty.'
    ),
    createItem(
      'paint_exterior_weatherproof',
      'Painting & Waterproofing',
      'Exterior weatherproof anti-fungal acrylic emulsion with primer',
      quantities.exteriorWallLinearFt * 10,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.paint_exterior_weatherproof,
      'Silicone-enhanced elastomeric exterior paint resisting rain and UV degradation.'
    ),
    createItem(
      'waterproofing_wet_areas',
      'Painting & Waterproofing',
      'Bathroom and balcony 2-coat crystalline elastomeric waterproofing',
      Math.max(60, quantities.bathroomFlooringSqFt + quantities.balconyFlooringSqFt),
      'sq ft',
      DEFAULT_UNIT_RATES_INR.waterproofing_wet_areas,
      'Polymer-modified cementitious coating with 300mm vertical coving along walls.'
    ),
    createItem(
      'waterproofing_terrace',
      'Painting & Waterproofing',
      'Terrace roof slab heat-reflective elastomeric waterproofing membrane',
      quantities.groundFootprintArea,
      'sq ft',
      DEFAULT_UNIT_RATES_INR.waterproofing_terrace,
      'UV-stable elastomeric membrane with geotextile fabric reinforcement.'
    ),
  ];
  categories.push({ id: 'painting', name: 'Painting & Waterproofing', items: cat7Items });

  // =========================================================================
  // 8. PLUNGE POOL SPECIALTY (if layout has plunge pools)
  // =========================================================================
  if (quantities.hasPlungePool) {
    const poolItems = [
      createItem(
        'plunge_pool_rcc_basin',
        'Plunge Pool Specialty Works',
        'Water-retaining reinforced concrete (M30) basin shell construction',
        Math.round(quantities.poolConcreteVolumeCuFt),
        'cu ft',
        DEFAULT_UNIT_RATES_INR.plunge_pool_rcc_basin,
        `Reinforced pool basin with integral crystalline waterproofing and PVC waterstop bars.`
      ),
      createItem(
        'plunge_pool_waterproofing',
        'Plunge Pool Specialty Works',
        'Dual-coat flexible elastomeric aquatic waterproofing barrier',
        Math.round(quantities.poolBasinSurfaceSqFt),
        'sq ft',
        DEFAULT_UNIT_RATES_INR.plunge_pool_waterproofing,
        'Food-grade aquatic pool membrane certified for continuous hydrostatic immersion.'
      ),
      createItem(
        'plunge_pool_mosaic_tile',
        'Plunge Pool Specialty Works',
        'Aquatic glass mosaic ceramic lining with epoxy chemical grout',
        Math.round(quantities.poolBasinSurfaceSqFt),
        'sq ft',
        DEFAULT_UNIT_RATES_INR.plunge_pool_mosaic_tile,
        'Anti-microbial glass mosaic tiles with water-resistant epoxy joint filling.'
      ),
      createItem(
        'plunge_pool_filtration_skid',
        'Plunge Pool Specialty Works',
        'Compact circulation pump & filtration skid plant (0.75 HP)',
        quantities.plungePoolCount,
        'packages',
        DEFAULT_UNIT_RATES_INR.plunge_pool_filtration_skid,
        'Includes 0.75HP self-priming pump, multi-port cartridge filter, surface skimmer & return jets.'
      ),
      createItem(
        'plunge_pool_fittings_ladder',
        'Plunge Pool Specialty Works',
        'Underwater LED lighting, stainless steel ladder & suction drains',
        quantities.plungePoolCount,
        'packages',
        DEFAULT_UNIT_RATES_INR.plunge_pool_fittings_ladder,
        '12V IP68 underwater illumination, SS 304 grab rails, and anti-vortex drain fittings.'
      ),
    ];

    if (quantities.hasElevatedPool) {
      poolItems.push(
        createItem(
          'plunge_pool_elevated_surcharge',
          'Plunge Pool Specialty Works',
          'Elevated floor structural surcharge (drop panel, column ties & leak tray)',
          1,
          'allowance',
          DEFAULT_UNIT_RATES_INR.plunge_pool_elevated_surcharge,
          'Structural strengthening for elevated water live load (~3.8 metric tons) on First Floor.'
        )
      );
    }

    categories.push({ id: 'plunge_pool', name: 'Plunge Pool Specialty Works', items: poolItems });
  }

  // =========================================================================
  // 9. STAIRCASE & BALCONY
  // =========================================================================
  const cat9Items = [];
  if (quantities.stairStepsCount > 0) {
    cat9Items.push(
      createItem(
        'stair_step_granite_cladding',
        'Staircase & Balcony',
        'Staircase granite slab steps and risers with anti-skid grooves',
        quantities.stairStepsCount,
        'steps',
        DEFAULT_UNIT_RATES_INR.stair_step_granite_cladding,
        `Molded edge polished granite tread and riser cladding for ${quantities.stairStepsCount} steps.`
      )
    );
  }

  if (quantities.balconyRailingFt > 0) {
    cat9Items.push(
      createItem(
        'balcony_railing_ss_glass',
        'Staircase & Balcony',
        'Balcony & staircase stainless steel (SS 304) and toughened glass railing',
        Math.max(15, Math.round(quantities.balconyRailingFt)),
        'rft',
        DEFAULT_UNIT_RATES_INR.balcony_railing_ss_glass,
        '10mm toughened glass panels mounted in SS 304 baluster posts with top handrail.'
      )
    );
  }

  if (cat9Items.length > 0) {
    categories.push({ id: 'stair_balcony', name: 'Staircase & Balcony', items: cat9Items });
  }

  // Compute Subtotals
  let directWorksCost = 0;
  categories.forEach(cat => {
    cat.subtotal = cat.items.reduce((s, it) => s + it.subtotal, 0);
    cat.currency = currencyConfig.code;
    cat.currencySymbol = currencyConfig.symbol;
    directWorksCost += cat.subtotal;
  });

  // Category 10: Overheads, Labour & Taxes
  const contractorOverheadPercent = activeRates.contractor_overhead_percent || 10;
  const contingencyPercent = activeRates.contingency_percent || 3;
  const statutoryTaxPercent = options.includeTaxes === false ? 0 : (activeRates.statutory_tax_percent || 18);

  const contractorOverhead = Math.round(directWorksCost * (contractorOverheadPercent / 100));
  const contingency = Math.round(directWorksCost * (contingencyPercent / 100));
  const subtotalBeforeTax = directWorksCost + contractorOverhead + contingency;
  const taxAmount = Math.round(subtotalBeforeTax * (statutoryTaxPercent / 100));
  const grandTotalCost = subtotalBeforeTax + taxAmount;

  const indirectItems = [
    {
      id: 'contractor_overhead',
      name: 'Contractor Management, Equipment, Tools & Scaffolding',
      percentage: contractorOverheadPercent,
      amount: contractorOverhead,
      currency: currencyConfig.code,
      currencySymbol: currencyConfig.symbol,
      description: 'Site engineering supervision, formwork rentals, machinery fuel, and site safety management.',
    },
    {
      id: 'contingency',
      name: 'Unforeseen Civil Contingency & Soil Variance Allowance',
      percentage: contingencyPercent,
      amount: contingency,
      currency: currencyConfig.code,
      currencySymbol: currencyConfig.symbol,
      description: 'Standard 3% contingency budget buffer for subsoil variation and utility connection realignments.',
    },
    {
      id: 'statutory_tax',
      name: `Statutory Works Contract Tax / GST (${statutoryTaxPercent}%)`,
      percentage: statutoryTaxPercent,
      amount: taxAmount,
      currency: currencyConfig.code,
      currencySymbol: currencyConfig.symbol,
      description: statutoryTaxPercent > 0 ? 'Applicable works contract tax on civil construction services.' : 'Tax excluded per user configuration.',
    },
  ];

  // Budget Variance Analysis
  const userBudgetAmount = options.userBudget ? Number(options.userBudget) : null;
  let budgetComparison = null;
  if (userBudgetAmount && userBudgetAmount > 0) {
    const variance = userBudgetAmount - grandTotalCost;
    const isUnderBudget = variance >= 0;
    const variancePercent = Math.round((Math.abs(variance) / userBudgetAmount) * 100);

    budgetComparison = {
      budgetAmount: userBudgetAmount,
      estimatedCost: grandTotalCost,
      variance,
      variancePercent,
      isUnderBudget,
      status: isUnderBudget ? 'within_budget' : 'budget_shortfall',
      shortfallMessage: isUnderBudget
        ? `Surplus of ${currencyConfig.format(variance)} (${variancePercent}% under allocated budget).`
        : `Shortfall of ${currencyConfig.format(Math.abs(variance))} (${variancePercent}% over allocated budget). Value-engineered options below reduce structural spans without sacrificing mandatory rooms.`,
    };
  }

  // Cost per square foot in target currency
  const effectiveCostPerSqFt = Math.round(grandTotalCost / quantities.totalBuiltUpArea);

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    currency: currencyConfig,
    tier: tierConfig,
    quantities,
    categories,
    indirectWorks: {
      directWorksCost,
      contractorOverhead,
      contingency,
      subtotalBeforeTax,
      taxAmount,
      grandTotalCost,
      items: indirectItems,
    },
    summary: {
      totalBuiltUpAreaSqFt: quantities.totalBuiltUpArea,
      totalCarpetAreaSqFt: quantities.totalCarpetArea,
      carpetEfficiencyPercent: Math.round((quantities.totalCarpetArea / quantities.totalBuiltUpArea) * 100),
      grandTotalCost,
      formattedGrandTotal: currencyConfig.format(grandTotalCost),
      effectiveCostPerSqFt,
      formattedRatePerSqFt: `${currencyConfig.format(effectiveCostPerSqFt)} / sq ft`,
      budgetComparison,
    },
    assumptions: [
      `Specifications priced according to ${tierConfig.name} standard.`,
      `Built-up area: ${quantities.totalBuiltUpArea} sq ft across ${quantities.floorsCount} levels.`,
      quantities.hasPlungePool
        ? `Includes dedicated aquatic pool civil and MEP equipment packages for ${quantities.plungePoolCount} plunge pool(s).`
        : 'No swimming pool or plunge pool included.',
      quantities.hasElevatedPool
        ? 'First floor plunge pool includes structural drop-panel and dual-layer waterproofing surcharge allowance.'
        : null,
      'Excludes land acquisition cost, stamp duty registration, and interior loose furniture.',
    ].filter(Boolean),
    disclaimer: BOQ_DISCLAIMER,
  };
}
