/**
 * Architectural Rules, Geometry Validation, and Recommendation Engine
 * 
 * Validates dimensions, boundary compliance, room overlaps, floor assignments,
 * practical room proportions, and vertical staircase access.
 * 
 * NOTE: ArchAI performs conceptual space-planning checks only.
 * It does not certify structural safety or statutory building-code compliance.
 */

import { STANDARD_ROOM_SPECS } from '../schemas/layoutSchema.js';

export const COMPLIANCE_DISCLAIMER = 
  'DISCLAIMER: ArchAI plans are conceptual architectural layouts for planning and design exploration. ' +
  'They do not constitute certified structural engineering calculations, seismic safety certifications, ' +
  'or local municipal bye-law compliance. Consult a licensed civil engineer or architect before construction.';

export const UNIMPLEMENTED_CHECKS = [
  'certified_structural_safety_load_calculations',
  'municipal_building_bye_law_compliance',
  'seismic_stability_and_soil_bearing_capacity',
  'exact_window_daylight_factor_and_fenestration',
  'plumbing_drainage_and_wet_stack_alignment',
  'fire_safety_and_egress_certification',
];

export const VERIFIED_CHECKS = [
  'per_floor_boundary_containment',
  'per_floor_aabb_zero_overlap',
  'positive_coordinate_geometry',
  'unique_room_identifiers',
  'floor_level_integrity',
  'room_aspect_ratio_sanity',
  'staircase_vertical_access',
];

/**
 * Calculates the 4 rotated corner vertices of a room in 2D coordinates
 */
export function getRoomVertices(room) {
  const w = Number(room.width) || 10;
  const l = Number(room.length) || 10;
  const cx = (Number(room.x) || 0) + w / 2;
  const cy = (Number(room.y) || 0) + l / 2;
  const deg = Number(room.rotation) || 0;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const hw = w / 2;
  const hl = l / 2;

  const offsets = [
    { x: -hw, y: -hl },
    { x: hw, y: -hl },
    { x: hw, y: hl },
    { x: -hw, y: hl }
  ];

  return offsets.map(pt => ({
    x: cx + pt.x * cos - pt.y * sin,
    y: cy + pt.x * sin + pt.y * cos
  }));
}

/**
 * Calculates the 2D bounding box of a room (accounting for rotation)
 */
export function getRoomBoundingBox(room) {
  const deg = (Number(room.rotation) || 0) % 360;
  const normalizedDeg = deg < 0 ? deg + 360 : deg;

  if (normalizedDeg === 0 || Math.abs(normalizedDeg - 180) < 0.1) {
    const x = Number(room.x) || 0;
    const y = Number(room.y) || 0;
    const w = Number(room.width) || 10;
    const l = Number(room.length) || 10;
    return {
      minX: x,
      maxX: x + w,
      minY: y,
      maxY: y + l,
      width: w,
      length: l
    };
  }

  if (Math.abs(normalizedDeg - 90) < 0.1 || Math.abs(normalizedDeg - 270) < 0.1) {
    const w = Number(room.width) || 10;
    const l = Number(room.length) || 10;
    const cx = (Number(room.x) || 0) + w / 2;
    const cy = (Number(room.y) || 0) + l / 2;
    return {
      minX: cx - l / 2,
      maxX: cx + l / 2,
      minY: cy - w / 2,
      maxY: cy + w / 2,
      width: l,
      length: w
    };
  }

  const vertices = getRoomVertices(room);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    length: maxY - minY
  };
}

/**
 * Validates 2D overlap between two rooms on the same floor, supporting rotation
 */
export function doRoomsOverlap(r1, r2, tolerance = 0.05) {
  if (r1.level !== r2.level) return false;
  if (r1.id === r2.id) return false;

  const b1 = getRoomBoundingBox(r1);
  const b2 = getRoomBoundingBox(r2);

  if (
    b1.maxX - tolerance <= b2.minX + tolerance ||
    b2.maxX - tolerance <= b1.minX + tolerance ||
    b1.maxY - tolerance <= b2.minY + tolerance ||
    b2.maxY - tolerance <= b1.minY + tolerance
  ) {
    return false;
  }

  const deg1 = (Number(r1.rotation) || 0) % 90;
  const deg2 = (Number(r2.rotation) || 0) % 90;

  if (Math.abs(deg1) < 0.1 && Math.abs(deg2) < 0.1) {
    return true;
  }

  const poly1 = getRoomVertices(r1);
  const poly2 = getRoomVertices(r2);

  const getAxes = (poly) => {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
      const len = Math.hypot(edge.x, edge.y) || 1;
      axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
  };

  const project = (poly, axis) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of poly) {
      const dot = p.x * axis.x + p.y * axis.y;
      if (dot < min) min = dot;
      if (dot > max) max = dot;
    }
    return { min, max };
  };

  const axes = [...getAxes(poly1), ...getAxes(poly2)];
  for (const axis of axes) {
    const proj1 = project(poly1, axis);
    const proj2 = project(poly2, axis);
    if (proj1.max - tolerance <= proj2.min + tolerance || proj2.max - tolerance <= proj1.min + tolerance) {
      return false;
    }
  }

  return true;
}

/**
 * Validates the entire floor plan layout with strict geometry & practicality checks
 */
export function validateLayout(layout) {
  const errors = [];
  const warnings = [];
  const practicalityAlerts = [];
  const info = [];

  if (!layout) {
    return {
      status: 'invalid',
      isValid: false,
      isProvisional: false,
      errors: ['No layout object provided for validation.'],
      warnings: [],
      practicalityAlerts: [],
      info: [],
      verifiedChecks: VERIFIED_CHECKS,
      unimplementedChecks: UNIMPLEMENTED_CHECKS,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  const { plot, rooms, metadata = {} } = layout;
  const isDimensionsExplicit = Boolean(plot?.isDimensionsExplicit);
  const floorsCount = Math.max(1, metadata.floorsCount || 1);

  // 1. Plot validation
  if (!plot || typeof plot.width !== 'number' || typeof plot.length !== 'number') {
    errors.push('Plot dimensions (width and length) are required numbers.');
  } else {
    if (plot.width <= 0 || plot.length <= 0) {
      errors.push(`Invalid plot dimensions: width (${plot.width}) and length (${plot.length}) must be positive.`);
    }
    if (plot.width < 12) {
      warnings.push(`Plot width of ${plot.width} ft is narrow; standard minimum frontage is usually 15-20 ft.`);
    }
    if (plot.length < 15) {
      warnings.push(`Plot length of ${plot.length} ft is shallow.`);
    }
  }

  // Provisional status warning if plot dimensions are unconfirmed
  if (!isDimensionsExplicit) {
    warnings.push(
      'PROVISIONAL PREVIEW: Plot dimensions are estimated. This layout cannot be marked final-valid until confirmed width and length are supplied.'
    );
  }

  if (!Array.isArray(rooms) || rooms.length === 0) {
    errors.push('Layout contains no rooms.');
    return {
      status: 'invalid',
      isValid: false,
      isProvisional: !isDimensionsExplicit,
      errors,
      warnings,
      practicalityAlerts,
      info,
      verifiedChecks: VERIFIED_CHECKS,
      unimplementedChecks: UNIMPLEMENTED_CHECKS,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  const plotWidth = plot?.width || 0;
  const plotLength = plot?.length || 0;
  const plotArea = plotWidth * plotLength;

  // 2. Overlap detection & Unique Room ID check (per floor)
  const seenIds = new Set();
  const roomsByFloor = {};

  for (let i = 0; i < rooms.length; i++) {
    const r1 = rooms[i];

    if (!r1.id) {
      errors.push(`Room "${r1.name || 'unnamed'}" is missing an ID.`);
    } else if (seenIds.has(r1.id)) {
      errors.push(`Duplicate room ID detected: "${r1.id}". Every room must have a unique identifier.`);
    }
    if (r1.id) seenIds.add(r1.id);

    const floor = r1.level || 0;
    roomsByFloor[floor] = roomsByFloor[floor] || [];
    roomsByFloor[floor].push(r1);
  }

  // Check overlaps separately for each floor
  for (const [floorLevel, floorRooms] of Object.entries(roomsByFloor)) {
    for (let i = 0; i < floorRooms.length; i++) {
      for (let j = i + 1; j < floorRooms.length; j++) {
        const r1 = floorRooms[i];
        const r2 = floorRooms[j];
        if (doRoomsOverlap(r1, r2)) {
          errors.push(
            `Overlap detected on Level ${floorLevel}: "${r1.name}" (${r1.id}) collides with "${r2.name}" (${r2.id}).`
          );
        }
      }
    }
  }

  // 3. Boundary, coordinate & dimension validation for each room
  let groundFloorOccupiedArea = 0;
  let roomAreaSumSqFt = 0;
  let carpetAreaSumSqFt = 0;

  for (const room of rooms) {
    if (typeof room.x !== 'number' || typeof room.y !== 'number' ||
        typeof room.width !== 'number' || typeof room.length !== 'number') {
      errors.push(`Room "${room.name || room.id}" is missing valid geometry coordinates (x, y, width, length).`);
      continue;
    }

    if (typeof room.level !== 'number' || room.level < 0) {
      errors.push(`Room "${room.name}" has invalid floor level assignment: ${room.level}.`);
    } else if (room.level >= floorsCount) {
      errors.push(`Room "${room.name}" references Level ${room.level}, but building is only configured for ${floorsCount} ${floorsCount === 1 ? 'floor' : 'floors'}.`);
    }

    if (room.width <= 0 || room.length <= 0) {
      errors.push(`Room "${room.name}" has invalid non-positive dimensions: ${room.width}x${room.length} ft.`);
      continue;
    }

    // Door and Window placement validation
    const validWalls = ['north', 'south', 'east', 'west'];
    if (Array.isArray(room.doors)) {
      room.doors.forEach((d, dIdx) => {
        if (!validWalls.includes(d.wall)) {
          errors.push(`Door #${dIdx + 1} in "${room.name}" has invalid wall orientation "${d.wall}". Must be north, south, east, or west.`);
        }
        if (typeof d.offset !== 'number' || d.offset < 0) {
          errors.push(`Door #${dIdx + 1} in "${room.name}" has invalid negative offset (${d.offset}).`);
        }
        if (typeof d.width !== 'number' || d.width <= 0) {
          errors.push(`Door #${dIdx + 1} in "${room.name}" has invalid non-positive width (${d.width}).`);
        }
        const wallSpan = (d.wall === 'north' || d.wall === 'south') ? room.width : room.length;
        if (d.offset + d.width > wallSpan + 0.1) {
          practicalityAlerts.push(`Door #${dIdx + 1} in "${room.name}" exceeds wall span: offset (${d.offset}) + width (${d.width}) = ${(d.offset + d.width).toFixed(1)} ft exceeds ${d.wall} wall span (${wallSpan} ft).`);
        }
      });
    }

    if (Array.isArray(room.windows)) {
      room.windows.forEach((w, wIdx) => {
        if (!validWalls.includes(w.wall)) {
          errors.push(`Window #${wIdx + 1} in "${room.name}" has invalid wall orientation "${w.wall}". Must be north, south, east, or west.`);
        }
        if (typeof w.offset !== 'number' || w.offset < 0) {
          errors.push(`Window #${wIdx + 1} in "${room.name}" has invalid negative offset (${w.offset}).`);
        }
        if (typeof w.width !== 'number' || w.width <= 0) {
          errors.push(`Window #${wIdx + 1} in "${room.name}" has invalid non-positive width (${w.width}).`);
        }
        const wallSpan = (w.wall === 'north' || w.wall === 'south') ? room.width : room.length;
        if (w.offset + w.width > wallSpan + 0.1) {
          practicalityAlerts.push(`Window #${wIdx + 1} in "${room.name}" exceeds wall span: offset (${w.offset}) + width (${w.width}) = ${(w.offset + w.width).toFixed(1)} ft exceeds ${w.wall} wall span (${wallSpan} ft).`);
        }
      });
    }

    // Boundary check per floor (accounting for rotation)
    const bbox = getRoomBoundingBox(room);
    if (bbox.minX < -0.05 || bbox.minY < -0.05) {
      errors.push(`Room "${room.name}" on Level ${room.level} is placed outside the plot origin (minX: ${bbox.minX.toFixed(1)}, minY: ${bbox.minY.toFixed(1)}).`);
    }
    if (bbox.maxX > plotWidth + 0.05) {
      errors.push(
        `Room "${room.name}" on Level ${room.level} exceeds plot width: right edge is ${bbox.maxX.toFixed(1)} ft (plot width: ${plotWidth} ft).`
      );
    }
    if (bbox.maxY > plotLength + 0.05) {
      errors.push(
        `Room "${room.name}" on Level ${room.level} exceeds plot length: bottom edge is ${bbox.maxY.toFixed(1)} ft (plot length: ${plotLength} ft).`
      );
    }

    // Standard room specs check
    const spec = STANDARD_ROOM_SPECS[room.type];
    if (spec) {
      if (room.width < spec.minWidth && room.length < spec.minWidth) {
        warnings.push(
          `Room "${room.name}" width (${Math.min(room.width, room.length)} ft) is below standard minimum (${spec.minWidth} ft).`
        );
      }
      if (room.area < spec.minArea) {
        warnings.push(
          `Room "${room.name}" area (${room.area} sq ft) is below recommended minimum (${spec.minArea} sq ft).`
        );
      }
    }

    // Practicality & Aspect Ratio checks
    const minDim = Math.min(room.width, room.length);
    const maxDim = Math.max(room.width, room.length);
    const ratio = maxDim / minDim;

    if (room.type === 'bathroom' && ratio > 1.9) {
      practicalityAlerts.push(
        `Bathroom "${room.name}" (${room.width}x${room.length} ft) has an elongated aspect ratio (${ratio.toFixed(2)}:1). Standard comfortable bathroom dimensions are 7x5 ft, 8x6 ft, or 6x6 ft.`
      );
    } else if (room.type === 'living_room' && ratio > 2.2) {
      practicalityAlerts.push(
        `Living room "${room.name}" (${room.width}x${room.length} ft) is unusually elongated (${ratio.toFixed(2)}:1). Consider partitioning into formal drawing and casual living zones.`
      );
    } else if ((room.type === 'master_bedroom' || room.type === 'bedroom') && minDim < 9.0) {
      practicalityAlerts.push(
        `Bedroom "${room.name}" narrowest dimension (${minDim} ft) is below standard 9.5 ft clearance for bed, wardrobes, and circulation.`
      );
    }

    const calculatedArea = Math.round(room.width * room.length);
    roomAreaSumSqFt += calculatedArea;

    // Carpet area excludes outdoor parking bays and open verandahs
    if (room.type !== 'parking' && room.type !== 'balcony') {
      carpetAreaSumSqFt += calculatedArea;
    }

    if (room.level === 0) {
      groundFloorOccupiedArea += calculatedArea;
    }
  }

  // 4. Multi-storey Staircase Vertical Access Check
  if (floorsCount > 1) {
    const groundStair = (roomsByFloor[0] || []).find(
      (r) => r.type === 'corridor' || /stair|foyer|lobby/i.test(r.name)
    );
    const upperStair = (roomsByFloor[1] || []).find(
      (r) => r.type === 'corridor' || /stair|landing|foyer/i.test(r.name)
    );

    if (!groundStair) {
      warnings.push('Ground floor lacks a dedicated vertical circulation zone (staircase / entrance foyer).');
    } else if (groundStair.area < 45 || Math.min(groundStair.width, groundStair.length) < 3.0) {
      practicalityAlerts.push(
        `Ground floor staircase zone "${groundStair.name}" (${groundStair.width}x${groundStair.length} ft) is smaller than recommended comfortable stair flight standard (width ≥ 3.5 ft, area ≥ 50 sq ft).`
      );
    }

    if (!upperStair) {
      warnings.push('First floor lacks a dedicated landing zone to receive the staircase from Ground Floor.');
    }
  }

  // 5. Area Metrics
  const builtUpAreaSqFt = Math.round(roomAreaSumSqFt * 1.15); // Includes structural wall thickness
  let groundCoveragePercent = null;
  let groundCoverageEstimatedPercent = null;

  if (plotArea > 0) {
    const rawCoverage = Math.min(100, Math.round((groundFloorOccupiedArea / plotArea) * 100));
    if (isDimensionsExplicit) {
      groundCoveragePercent = rawCoverage;
      if (rawCoverage > 85) {
        warnings.push(`High ground coverage (${rawCoverage}%). Standard urban bye-laws recommend 60%-75% for setbacks, light, and rainwater drainage.`);
      } else {
        info.push(`Ground coverage is ${rawCoverage}%, leaving ${100 - rawCoverage}% for setbacks, light wells, and landscaping.`);
      }
    } else {
      groundCoverageEstimatedPercent = rawCoverage;
      info.push(`Estimated ground coverage is ~${rawCoverage}% (subject to confirmed plot dimensions).`);
    }
  }

  const isValid = errors.length === 0;
  const status = !isDimensionsExplicit ? 'provisional' : (isValid ? 'confirmed_valid' : 'invalid');

  return {
    status,
    isValid,
    isProvisional: !isDimensionsExplicit,
    errors,
    warnings,
    practicalityAlerts,
    info,
    metrics: {
      plotAreaSqFt: plotArea,
      roomAreaSumSqFt,
      builtUpAreaSqFt,
      carpetAreaSqFt: carpetAreaSumSqFt,
      groundFloorOccupiedArea,
      groundCoveragePercent,
      groundCoverageEstimatedPercent,
    },
    verifiedChecks: VERIFIED_CHECKS,
    unimplementedChecks: UNIMPLEMENTED_CHECKS,
    disclaimer: COMPLIANCE_DISCLAIMER,
  };
}

/**
 * Generates architectural recommendations (Vastu, natural light, circulation)
 */
export function generateRecommendations(layout) {
  const recommendations = [];
  const { rooms = [], metadata = {}, plot = {} } = layout;

  const facing = (metadata.facing || '').toLowerCase();
  const plotWidth = plot.width || 30;
  const plotLength = plot.length || 40;

  // 1. Orientation & Entrance (only if specified)
  if (facing === 'east' || facing === 'north' || facing === 'northeast') {
    recommendations.push({
      category: 'Orientation',
      type: 'positive',
      title: 'Favorable Entrance Facing',
      message: `${facing.toUpperCase()}-facing entrance allows morning sunlight and aligns with traditional Vastu principles.`,
    });
  } else if (facing === 'south') {
    recommendations.push({
      category: 'Orientation',
      type: 'tip',
      title: 'South Facing Considerations',
      message: 'Ensure south and west walls have adequate sun shading (chajjas) or thermal insulation to reduce afternoon heat gain.',
    });
  } else if (facing === 'west') {
    recommendations.push({
      category: 'Orientation',
      type: 'tip',
      title: 'West Facing Considerations',
      message: 'West-facing buildings receive warm evening sunlight; incorporate overhangs or vertical louvers on west openings.',
    });
  }

  // 2. Kitchen Placement
  const kitchen = rooms.find((r) => r.type === 'kitchen');
  if (kitchen) {
    const isSE = kitchen.x >= plotWidth * 0.4 && kitchen.y <= plotLength * 0.5;
    const isNW = kitchen.x <= plotWidth * 0.5 && kitchen.y >= plotLength * 0.5;
    if (isSE || isNW) {
      recommendations.push({
        category: 'Vastu & Functionality',
        type: 'positive',
        title: 'Ideal Kitchen Location',
        message: 'Kitchen is placed in a recommended thermal zone (South-East / North-West) with good exhaust potential.',
      });
    } else {
      recommendations.push({
        category: 'Vastu & Functionality',
        type: 'tip',
        title: 'Kitchen Placement Tip',
        message: 'Traditional Indian architecture suggests placing the kitchen in the South-East (Agni zone) for optimal airflow.',
      });
    }
  }

  // 3. Master Bedroom Placement
  const masterBed = rooms.find((r) => r.type === 'master_bedroom');
  if (masterBed) {
    const isRear = masterBed.y >= plotLength * 0.35;
    if (isRear) {
      recommendations.push({
        category: 'Privacy & Rest',
        type: 'positive',
        title: 'Quiet Master Bedroom Zone',
        message: 'Master bedroom is buffered away from front entrance noise, ensuring acoustic privacy.',
      });
    }
  }

  // 4. Pooja Room / Sacred Space
  const pooja = rooms.find((r) => r.type === 'pooja_room');
  if (pooja) {
    recommendations.push({
      category: 'Spiritual Space',
      type: 'tip',
      title: 'Pooja Room Sanctity',
      message: 'Keep the pooja room adjacent to living areas and avoid sharing walls with toilets or septic connections.',
    });
  }

  return {
    recommendations,
    disclaimer: COMPLIANCE_DISCLAIMER,
  };
}
