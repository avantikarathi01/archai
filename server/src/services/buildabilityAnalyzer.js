/**
 * ArchAI Climate Intelligence & Buildability Analyzer
 * 
 * Performs automated architectural and civil engineering buildability analysis:
 * 1. Orientation & Sun Path Analysis (Morning sun, glare, deep afternoon heat, diffuse light)
 * 2. Cross-Ventilation Potential (Dual-aspect rooms, single-sided, mechanical ventilation)
 * 3. Vertical Plumbing Stack Alignment (Upper vs lower wet core offsets, drainage efficiency)
 * 4. Structural Spans & Slab Rigidity (Column-free spans, wall-to-floor ratio, transfer needs)
 * 5. Elevated Plunge Pool Surcharge & Hydrostatic Loads (Dead + live water load calculations)
 * 6. Actionable Civil & MEP Recommendations
 * 
 * DISCLAIMER:
 * Calculations and recommendations are preliminary planning heuristics for architectural design.
 * They do not substitute for certified structural engineering drawings or MEP consultant designs.
 */

export const BUILDABILITY_DISCLAIMER =
  'BUILDABILITY NOTICE: Climate metrics, structural spans, and load calculations are preliminary engineering heuristics ' +
  'for concept design optimization. Final structural framing, rebar scheduling, water loads, and MEP designs must be validated ' +
  'and stamped by a licensed Structural Engineer and MEP Consultant in accordance with local building codes.';

/**
 * Normalizes plot facing orientation into cardinal direction
 */
function normalizeFacing(facing) {
  if (!facing || typeof facing !== 'string') return 'east';
  const f = facing.toLowerCase().trim();
  if (f.includes('north')) return 'north';
  if (f.includes('south')) return 'south';
  if (f.includes('west')) return 'west';
  return 'east';
}

/**
 * 1. Orientation and Daylighting Analysis
 */
export function analyzeDaylightAndOrientation(layout) {
  const plot = layout?.plot || { width: 30, length: 40 };
  const plotW = Number(plot.width) || 30;
  const plotL = Number(plot.length) || 40;
  const facing = normalizeFacing(layout?.facing || layout?.requirements?.facing || layout?.orientation);

  const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
  const roomEvaluations = [];

  let totalDaylightPoints = 0;
  let evaluableRoomCount = 0;

  const morningSunRooms = [];
  const afternoonHeatRooms = [];
  const diffuseLightRooms = [];
  const lowLightRooms = [];

  // Determine actual building footprint envelope
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rooms.forEach(r => {
    if (typeof r.x === 'number' && typeof r.width === 'number') {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
    }
    if (typeof r.y === 'number' && typeof r.length === 'number') {
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.length);
    }
  });

  const tol = 1.0;

  rooms.forEach(r => {
    // Determine which building envelope boundaries the room touches
    const touchesWest = Math.abs(r.x - minX) <= tol;
    const touchesEast = Math.abs((r.x + r.width) - maxX) <= tol;
    const touchesNorth = Math.abs(r.y - minY) <= tol;
    const touchesSouth = Math.abs((r.y + r.length) - maxY) <= tol;

    const exteriorExposures = [];
    if (touchesNorth) exteriorExposures.push('North');
    if (touchesSouth) exteriorExposures.push('South');
    if (touchesEast) exteriorExposures.push('East');
    if (touchesWest) exteriorExposures.push('West');

    const hasWindows = Array.isArray(r.windows) && r.windows.length > 0;
    const isHabitable = !['corridor', 'storage', 'parking'].includes(r.type);

    let daylightScore = 50; // baseline
    let daylightQuality = 'Moderate Natural Light';
    const daylightCharacteristics = [];

    if (exteriorExposures.length === 0) {
      daylightScore = 25;
      daylightQuality = 'Low / Enclosed Buffer';
      daylightCharacteristics.push('No exterior wall exposure; relies on internal circulation or borrow light.');
      if (isHabitable) lowLightRooms.push(r.name);
    } else {
      // Bonus for multiple exposures
      daylightScore += (exteriorExposures.length - 1) * 15;
      if (hasWindows) daylightScore += 20;

      // Orientation-specific daylight attributes based on cardinal exposure
      if (exteriorExposures.includes('East')) {
        daylightCharacteristics.push('Receives gentle, energizing morning solar gain (ideal for bedrooms & breakfast zones).');
        morningSunRooms.push(r.name);
      }
      if (exteriorExposures.includes('North')) {
        daylightCharacteristics.push('Consistent, glare-free indirect north sky daylight throughout the day.');
        diffuseLightRooms.push(r.name);
      }
      if (exteriorExposures.includes('South')) {
        daylightCharacteristics.push('Deep winter solar penetration; requires horizontal louver shading during peak summer.');
      }
      if (exteriorExposures.includes('West')) {
        daylightCharacteristics.push('Intense low-angle afternoon thermal heat gain; vertical fins or foliage shading advised.');
        afternoonHeatRooms.push(r.name);
      }

      if (daylightScore >= 80) {
        daylightQuality = 'Excellent Dual-Aspect Daylighting';
      } else if (daylightScore >= 65) {
        daylightQuality = 'Good Direct Daylighting';
      }
    }

    daylightScore = Math.min(100, Math.max(20, daylightScore));

    if (isHabitable) {
      totalDaylightPoints += daylightScore;
      evaluableRoomCount++;
    }

    roomEvaluations.push({
      roomId: r.id,
      roomName: r.name,
      roomType: r.type,
      level: r.level ?? (r.floor === 'first' ? 1 : 0),
      exteriorExposures,
      hasWindows,
      daylightScore,
      daylightQuality,
      characteristics: daylightCharacteristics,
    });
  });

  const overallDaylightScore = evaluableRoomCount > 0
    ? Math.round(totalDaylightPoints / evaluableRoomCount)
    : 70;

  return {
    facingOrientation: facing.toUpperCase(),
    overallDaylightScore,
    rating: overallDaylightScore >= 80 ? 'Optimal' : (overallDaylightScore >= 65 ? 'Good' : 'Needs Optimization'),
    morningSunRooms: [...new Set(morningSunRooms)],
    afternoonHeatRooms: [...new Set(afternoonHeatRooms)],
    diffuseLightRooms: [...new Set(diffuseLightRooms)],
    lowLightRooms: [...new Set(lowLightRooms)],
    roomEvaluations,
    summary: `Primary entrance faces ${facing.toUpperCase()}. Overall natural daylight efficiency is rated at ${overallDaylightScore}%, with ${morningSunRooms.length} spaces benefiting from morning solar orientation.`,
  };
}

/**
 * 2. Cross-Ventilation Potential Analysis
 */
export function analyzeCrossVentilation(layout) {
  const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
  const ventilationResults = [];

  let totalVentilationScore = 0;
  let habitableCount = 0;

  // Determine actual building footprint envelope
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rooms.forEach(r => {
    if (typeof r.x === 'number' && typeof r.width === 'number') {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
    }
    if (typeof r.y === 'number' && typeof r.length === 'number') {
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.length);
    }
  });

  const tol = 1.0;

  rooms.forEach(r => {
    const isHabitable = !['storage', 'corridor'].includes(r.type);
    if (!isHabitable) return;

    const touchesWest = Math.abs(r.x - minX) <= tol;
    const touchesEast = Math.abs((r.x + r.width) - maxX) <= tol;
    const touchesNorth = Math.abs(r.y - minY) <= tol;
    const touchesSouth = Math.abs((r.y + r.length) - maxY) <= tol;

    const exteriorWalls = [];
    if (touchesNorth) exteriorWalls.push('North');
    if (touchesSouth) exteriorWalls.push('South');
    if (touchesEast) exteriorWalls.push('East');
    if (touchesWest) exteriorWalls.push('West');

    const hasOpposingWalls = (exteriorWalls.includes('North') && exteriorWalls.includes('South')) ||
                            (exteriorWalls.includes('East') && exteriorWalls.includes('West'));
    const hasCornerWalls = exteriorWalls.length >= 2;

    let ventScore = 40;
    let ventType = 'Single-Sided Natural Draft';
    let recommendation = 'Provide high-level fan-light or door louver to promote air movement.';

    if (r.type === 'parking') {
      ventScore = 95;
      ventType = 'Open Outdoor / Direct Breezeway';
      recommendation = 'Naturally cross-ventilated open frontage.';
    } else if (r.type === 'balcony') {
      ventScore = 100;
      ventType = 'Semi-Open Outdoor Airflow';
      recommendation = 'Unobstructed natural ventilation.';
    } else if (hasOpposingWalls) {
      ventScore = 95;
      ventType = 'High-Efficiency Cross-Ventilation (Dual Opposing)';
      recommendation = 'Exceptional stack & cross-breeze potential; open windows on opposing facades.';
    } else if (hasCornerWalls) {
      ventScore = 85;
      ventType = 'Corner Aspect Cross-Draft';
      recommendation = 'Favorable corner draft; place windows on adjacent perpendicular walls.';
    } else if (exteriorWalls.length === 1) {
      ventScore = 60;
      ventType = 'Single-Sided Ventilation';
      recommendation = 'Adequate single-wall airflow; operable window with trickle vent recommended.';
    } else {
      ventScore = 30;
      ventType = 'Mechanical Exhaust Required';
      recommendation = 'Internal enclosed volume; provide dedicated inline ducted exhaust fan.';
    }

    totalVentilationScore += ventScore;
    habitableCount++;

    ventilationResults.push({
      roomId: r.id,
      name: r.name,
      type: r.type,
      level: r.level ?? (r.floor === 'first' ? 1 : 0),
      ventType,
      score: ventScore,
      exteriorWalls,
      recommendation,
    });
  });

  const overallVentilationScore = habitableCount > 0
    ? Math.round(totalVentilationScore / habitableCount)
    : 70;

  return {
    overallVentilationScore,
    rating: overallVentilationScore >= 80 ? 'Superior' : (overallVentilationScore >= 65 ? 'Moderate' : 'Constrained'),
    rooms: ventilationResults,
    summary: `${overallVentilationScore}% ventilation efficiency. ${ventilationResults.filter(r => r.score >= 80).length} habitable spaces achieve dual-aspect cross-ventilation.`,
  };
}

/**
 * 3. Vertical Plumbing Stack Alignment Analysis
 */
export function analyzePlumbingAlignment(layout) {
  const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
  const wetTypes = ['bathroom', 'toilet', 'kitchen', 'plunge_pool', 'utility'];

  const groundWetRooms = rooms.filter(r => {
    const lvl = r.level ?? (r.floor === 'first' ? 1 : 0);
    return lvl === 0 && wetTypes.includes(r.type);
  });

  const upperWetRooms = rooms.filter(r => {
    const lvl = r.level ?? (r.floor === 'first' ? 1 : 0);
    return lvl >= 1 && wetTypes.includes(r.type);
  });

  // If no upper wet rooms (single floor), alignment is naturally optimal
  if (upperWetRooms.length === 0) {
    return {
      status: 'single_floor_compact',
      plumbingStackScore: 95,
      isFullyAligned: true,
      upperWetRoomsCount: 0,
      groundWetRoomsCount: groundWetRooms.length,
      averageOffsetFeet: 0,
      stackEvaluations: [],
      summary: 'Single floor layout: ground-level drainage runs directly to municipal inspection chamber with minimal horizontal offsets.',
      recommendation: 'Use 110mm SWR PVC drainage line with standard 1:40 self-cleansing slope.',
    };
  }

  const stackEvaluations = [];
  let totalOffset = 0;

  upperWetRooms.forEach(upperRoom => {
    const upperCenterX = upperRoom.x + (upperRoom.width / 2);
    const upperCenterY = upperRoom.y + (upperRoom.length / 2);

    let minDistance = Infinity;
    let closestGroundRoom = null;

    groundWetRooms.forEach(gfRoom => {
      const gfCenterX = gfRoom.x + (gfRoom.width / 2);
      const gfCenterY = gfRoom.y + (gfRoom.length / 2);
      const dx = upperCenterX - gfCenterX;
      const dy = upperCenterY - gfCenterY;
      const distance = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;

      if (distance < minDistance) {
        minDistance = distance;
        closestGroundRoom = gfRoom;
      }
    });

    if (!closestGroundRoom) {
      minDistance = 15.0; // fallback if no ground wet room
    }

    let alignmentStatus = 'optimal';
    let pipeEfficiencyScore = 95;
    let recommendation = 'Direct vertical drop to ground stack; zero horizontal soffit suspension needed.';

    if (minDistance <= 4.0) {
      alignmentStatus = 'optimal_direct_stack';
      pipeEfficiencyScore = 95;
      recommendation = 'Direct vertical drop stack. Minimal horizontal pipework reduces leakage risk by ~80%.';
    } else if (minDistance <= 9.0) {
      alignmentStatus = 'moderate_offset';
      pipeEfficiencyScore = 75;
      recommendation = `Horizontal offset of ${minDistance} ft requires concealed false-ceiling pipe boxing with 1:40 gradient.`;
    } else {
      alignmentStatus = 'extended_run';
      pipeEfficiencyScore = 55;
      recommendation = `Large horizontal offset of ${minDistance} ft. Recommend a dedicated secondary vertical drainage stack to avoid ceiling pipe drops.`;
    }

    totalOffset += minDistance;

    stackEvaluations.push({
      upperRoomId: upperRoom.id,
      upperRoomName: upperRoom.name,
      upperRoomType: upperRoom.type,
      closestGroundRoom: closestGroundRoom?.name || 'External Sewer Line',
      horizontalOffsetFeet: minDistance,
      alignmentStatus,
      pipeEfficiencyScore,
      recommendation,
    });
  });

  const averageOffset = Math.round((totalOffset / upperWetRooms.length) * 10) / 10;
  const plumbingStackScore = Math.max(50, Math.min(100, Math.round(100 - (averageOffset * 4))));

  return {
    status: 'evaluated',
    plumbingStackScore,
    isFullyAligned: averageOffset <= 4.5,
    upperWetRoomsCount: upperWetRooms.length,
    groundWetRoomsCount: groundWetRooms.length,
    averageOffsetFeet: averageOffset,
    stackEvaluations,
    summary: `Vertical plumbing stack alignment score is ${plumbingStackScore}/100. Average horizontal offset between upper wet rooms and ground drainage is ${averageOffset} ft.`,
    recommendation: plumbingStackScore >= 80
      ? 'Vertical drainage stacks align well with ground utility lines, reducing plumbing material and maintenance costs.'
      : 'Consider grouping upper bathrooms or plunge pool closer to ground floor kitchen/toilets to minimize suspended horizontal drainage pipes.',
  };
}

/**
 * 4. Structural Spans and Slab Rigidity Analysis
 */
export function analyzeStructuralSpans(layout) {
  const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
  const spanIssues = [];
  let maxClearSpan = 0;
  let largeSpanRoom = null;
  let totalBuiltArea = 0;

  rooms.forEach(r => {
    const w = Number(r.width) || 0;
    const l = Number(r.length) || 0;
    const shorterSpan = Math.min(w, l);
    const longerSpan = Math.max(w, l);
    const area = w * l;
    totalBuiltArea += area;

    if (shorterSpan > maxClearSpan) {
      maxClearSpan = shorterSpan;
      largeSpanRoom = r.name;
    }

    if (shorterSpan >= 16.0) {
      spanIssues.push({
        roomName: r.name,
        spanFeet: shorterSpan,
        longerSpanFeet: longerSpan,
        recommendation: `Clear span of ${shorterSpan} ft requires 150mm thick RCC two-way slab or central RCC tie-beam to prevent excessive deflection.`,
      });
    }
  });

  // Structural complexity score: 100 is very simple/regular, lower is more complex
  let complexityScore = 85;
  if (maxClearSpan > 18.0) complexityScore -= 25;
  else if (maxClearSpan > 15.0) complexityScore -= 10;

  return {
    maxClearSpanFeet: Math.round(maxClearSpan * 10) / 10,
    criticalRoom: largeSpanRoom,
    structuralComplexityScore: complexityScore,
    slabStandard: maxClearSpan <= 14.5 ? 'Standard 125mm RCC Slab' : 'Reinforced 150mm Slab with Concealed Beams',
    hasLongSpans: spanIssues.length > 0,
    spanIssues,
    summary: `Maximum clear column-free span is ${maxClearSpan.toFixed(1)} ft in "${largeSpanRoom}". Structural complexity index: ${complexityScore}/100.`,
  };
}

/**
 * 5. Elevated Plunge Pool Structural & Hydrostatic Surcharge Analysis
 */
export function analyzeElevatedPlungePool(layout) {
  const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
  const upperPools = rooms.filter(r => {
    const lvl = r.level ?? (r.floor === 'first' ? 1 : 0);
    return lvl >= 1 && (r.type === 'plunge_pool' || r.type === 'swimming_pool');
  });

  if (upperPools.length === 0) {
    return {
      hasElevatedPool: false,
      elevatedPoolCount: 0,
      summary: 'No elevated plunge pool located on upper levels. Standard residential gravity floor loads apply.',
    };
  }

  const poolReports = upperPools.map(pool => {
    const basinW = pool.basin?.width || Math.max(4.0, pool.width - 2.5);
    const basinL = pool.basin?.length || Math.max(5.0, pool.length - 2.5);
    const depthFt = pool.basin?.depth || 4.0;

    const waterVolumeCuFt = Math.round(basinW * basinL * depthFt * 10) / 10;
    const waterGallons = Math.round(waterVolumeCuFt * 7.48052);
    const waterLiters = Math.round(waterVolumeCuFt * 28.3168);

    // Water density: 62.4 lbs/cu ft (1000 kg/m3)
    const waterWeightLbs = Math.round(waterVolumeCuFt * 62.4);
    const waterWeightMetricTons = Math.round((waterWeightLbs / 2204.62) * 10) / 10;
    const waterWeightKN = Math.round(waterWeightMetricTons * 9.80665 * 10) / 10;

    // RCC shell dead load (8-inch thickened basin slab + sidewalls @ 150 lbs/cu ft)
    const shellConcreteCuFt = Math.round((basinW * basinL * 0.67) + (2 * (basinW + basinL) * depthFt * 0.5));
    const shellWeightLbs = Math.round(shellConcreteCuFt * 150);
    const shellWeightMetricTons = Math.round((shellWeightLbs / 2204.62) * 10) / 10;

    const totalImposedLoadMetricTons = Math.round((waterWeightMetricTons + shellWeightMetricTons) * 10) / 10;
    const poolFootprintSqFt = Math.round(basinW * basinL);
    const loadIntensityLbsPerSqFt = Math.round((waterWeightLbs + shellWeightLbs) / poolFootprintSqFt);

    return {
      poolRoomId: pool.id,
      poolRoomName: pool.name,
      level: pool.level ?? (pool.floor === 'first' ? 1 : 0),
      basinDimensions: {
        widthFeet: basinW,
        lengthFeet: basinL,
        depthFeet: depthFt,
        footprintSqFt: poolFootprintSqFt,
      },
      waterVolume: {
        cubicFeet: waterVolumeCuFt,
        gallons: waterGallons,
        liters: waterLiters,
      },
      hydrostaticLoads: {
        waterDeadLoadMetricTons: waterWeightMetricTons,
        waterDeadLoadLbs: waterWeightLbs,
        rccShellDeadLoadMetricTons: shellWeightMetricTons,
        totalImposedLoadMetricTons,
        loadIntensityLbsPerSqFt,
        standardResidentialComparisonLbsPerSqFt: 40,
        loadMultiplierVsStandardRoom: Math.round(loadIntensityLbsPerSqFt / 40),
      },
      mandatoryEngineeringDirectives: [
        `HEAVY HYDROSTATIC SURCHARGE: Total elevated water + concrete mass is ~${totalImposedLoadMetricTons} metric tons (${loadIntensityLbsPerSqFt} lbs/sq ft vs standard 40 lbs/sq ft residential live load).`,
        'STRUCTURAL DROP PANEL: Requires a 200mm thickened RCC sunken slab beneath basin with continuous corner transfer beams.',
        'DIRECT LOAD TRANSFER: 4 perimeter RCC columns (300mm x 450mm) must transfer load continuously down to ground foundations without offset.',
        'DUAL WATERPROOF MEMBRANE: Apply 2 coats of elastomeric polymer-modified crystalline waterproofing with fiber mesh reinforcement and a mandatory 72-hour hydrostatic flood test before tiling.',
        'OVERFLOW & ACOUSTIC ISOLATION: Dedicated 63mm emergency overflow drain and vibration damping mounts for recirculation pumps.',
      ],
    };
  });

  return {
    hasElevatedPool: true,
    elevatedPoolCount: upperPools.length,
    pools: poolReports,
    totalWaterWeightMetricTons: poolReports.reduce((s, p) => s + p.hydrostaticLoads.waterDeadLoadMetricTons, 0),
    totalImposedLoadMetricTons: poolReports.reduce((s, p) => s + p.hydrostaticLoads.totalImposedLoadMetricTons, 0),
    summary: `Elevated plunge pool imposes ~${poolReports[0].hydrostaticLoads.totalImposedLoadMetricTons} metric tons of concentrated load. Requires sunken RCC drop panel, direct column transfer, and dual-layer waterproofing.`,
  };
}

/**
 * 6. Generates 4-6 Practical Architectural and Civil Recommendations
 */
export function generatePracticalRecommendations(layout, daylight, ventilation, plumbing, structural, poolAnalysis) {
  const recommendations = [];

  // 1. Daylight & Sun protection
  if (daylight.afternoonHeatRooms.length > 0) {
    recommendations.push({
      category: 'Solar Shading & Comfort',
      title: 'West Facade Afternoon Thermal Buffering',
      text: `Spaces on the West facade (${daylight.afternoonHeatRooms.slice(0, 2).join(', ')}) will receive intense low-angle solar heat gain. Specify deep 600mm horizontal chajjas or vertical louvers to cut cooling energy loads by up to 25%.`,
      priority: 'high',
    });
  } else {
    recommendations.push({
      category: 'Solar Orientation',
      title: 'Favorable East-Facing Morning Sun Access',
      text: 'Front spaces capitalize on mild morning sunlight, optimizing natural circadian lighting while avoiding peak afternoon western thermal spikes.',
      priority: 'medium',
    });
  }

  // 2. Cross-Ventilation
  if (ventilation.overallVentilationScore < 75) {
    recommendations.push({
      category: 'Natural Ventilation',
      title: 'Enhance Cross-Draft via Clerestory Windows',
      text: 'Internal rooms can achieve cross-ventilation by incorporating high-level louver ventilators above internal passage doors connecting to the main stairwell.',
      priority: 'medium',
    });
  } else {
    recommendations.push({
      category: 'Natural Ventilation',
      title: 'High-Efficiency Dual-Aspect Airflow',
      text: 'Bedrooms and living lounge enjoy dual-aspect external wall exposure. Staggered window placement enables natural breeze displacement, minimizing air conditioning runtime during transitional seasons.',
      priority: 'low',
    });
  }

  // 3. Plumbing Stack Efficiency
  if (plumbing.status !== 'single_floor_compact') {
    if (plumbing.isFullyAligned) {
      recommendations.push({
        category: 'MEP & Plumbing',
        title: 'Stacked Wet Core Cost Efficiency',
        text: `Upper floor wet rooms align within ${plumbing.averageOffsetFeet} ft of ground service ducts, achieving a compact vertical drop shaft. This reduces drainage pipe fittings and eliminates unsightly ceiling pipe drops.`,
        priority: 'high',
      });
    } else {
      recommendations.push({
        category: 'MEP & Plumbing',
        title: 'False Ceiling Soffit for Horizontal Waste Pipes',
        text: `Horizontal offset of ${plumbing.averageOffsetFeet} ft between upper wet areas and ground drainage requires a dedicated dropped gypsum false ceiling (min 300mm depth) with an inspection hatch for cleanout maintenance.`,
        priority: 'high',
      });
    }
  }

  // 4. Elevated Plunge Pool (if present)
  if (poolAnalysis.hasElevatedPool) {
    const p = poolAnalysis.pools[0];
    recommendations.push({
      category: 'Specialty Civil Works',
      title: `Structural Reinforcement for ${p.hydrostaticLoads.totalImposedLoadMetricTons}T Upper Plunge Pool`,
      text: `First floor plunge pool adds ${p.hydrostaticLoads.totalImposedLoadMetricTons} metric tons of concentrated load. Cast a 200mm sunken drop panel with continuous perimeter beams transferred directly down to ground columns. Conduct a mandatory 72-hour hydrostatic water test before mosaic tiling.`,
      priority: 'critical',
    });
  }

  // 5. Structural Span & Cost Optimization
  if (structural.hasLongSpans) {
    recommendations.push({
      category: 'Structural Economy',
      title: 'Intermediate Beam Placement for Clear Spans',
      text: `Clear span of ${structural.maxClearSpanFeet} ft in "${structural.criticalRoom}" benefits from a central concealed RCC beam to restrict slab thickness to 125mm and reduce concrete volume.`,
      priority: 'medium',
    });
  } else {
    recommendations.push({
      category: 'Structural Economy',
      title: 'Standard Modular 125mm Slab Optimization',
      text: `All room spans remain within ${structural.maxClearSpanFeet} ft, enabling uniform 125mm RCC slabs throughout without requiring expensive transfer girders or drop beams.`,
      priority: 'low',
    });
  }

  // 6. Moisture & Waterproofing
  recommendations.push({
    category: 'Waterproofing & Longevity',
    title: 'Dual-Layer Crystalline Membrane at Plinth & Wet Areas',
    text: 'Execute continuous box-type crystalline waterproofing in all ground floor masonry plinths and bathroom sunken slabs to prevent capillary moisture rise into premium wall finishes.',
    priority: 'high',
  });

  return recommendations;
}

/**
 * Comprehensive Buildability and Climate Analysis Orchestrator
 */
export function analyzeBuildability(layout, options = {}) {
  const daylight = analyzeDaylightAndOrientation(layout);
  const ventilation = analyzeCrossVentilation(layout);
  const plumbing = analyzePlumbingAlignment(layout);
  const structural = analyzeStructuralSpans(layout);
  const poolAnalysis = analyzeElevatedPlungePool(layout);

  const practicalRecommendations = generatePracticalRecommendations(
    layout,
    daylight,
    ventilation,
    plumbing,
    structural,
    poolAnalysis
  );

  // Overall Buildability Index (0 - 100)
  const compositeScore = Math.round(
    (daylight.overallDaylightScore * 0.25) +
    (ventilation.overallVentilationScore * 0.20) +
    (plumbing.plumbingStackScore * 0.25) +
    (structural.structuralComplexityScore * 0.30)
  );

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    compositeBuildabilityScore: compositeScore,
    buildabilityRating: compositeScore >= 80 ? 'Exceptional Buildability' : (compositeScore >= 70 ? 'Good / Practical' : 'Moderate Construction Complexity'),
    daylight,
    ventilation,
    plumbing,
    structural,
    elevatedPool: poolAnalysis,
    recommendations: practicalRecommendations,
    disclaimer: BUILDABILITY_DISCLAIMER,
  };
}
