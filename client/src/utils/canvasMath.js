/**
 * Canvas Geometry Math & Utility Helpers for ArchAI 2D Floor Plan Canvas
 */

export const DEFAULT_PIXELS_PER_FOOT = 20;

/**
 * Converts feet to screen pixels
 */
export function feetToPixels(feet, scale = DEFAULT_PIXELS_PER_FOOT) {
  return Number(feet) * scale;
}

/**
 * Converts screen pixels to feet
 */
export function pixelsToFeet(pixels, scale = DEFAULT_PIXELS_PER_FOOT) {
  return Number(pixels) / scale;
}

/**
 * Snaps a number to the nearest grid increment (e.g. 1.0 ft or 0.5 ft)
 */
export function snapToGrid(value, gridSize = 1.0) {
  if (!gridSize || gridSize <= 0) return value;
  const snapped = Math.round(value / gridSize) * gridSize;
  return Number(snapped.toFixed(2));
}

/**
 * Clamps a number within min and max
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

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

  if (normalizedDeg === 0) {
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

  // 90 or 270 degree rotation swaps dimensions around center
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
 * Tests 2D overlap between two rooms on the same floor, supporting rotation
 */
export function doRoomsOverlap(r1, r2, tolerance = 0.05) {
  if (r1.level !== r2.level) return false;
  if (r1.id === r2.id) return false;

  const b1 = getRoomBoundingBox(r1);
  const b2 = getRoomBoundingBox(r2);

  // Fast AABB bounding box rejection
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

  // If both rooms are orthogonal (0, 90, 180, 270 degrees), bounding box check is exact
  if (Math.abs(deg1) < 0.1 && Math.abs(deg2) < 0.1) {
    return true;
  }

  // Separating Axis Theorem (SAT) for arbitrarily rotated rooms
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
      return false; // Separating axis found
    }
  }

  return true;
}

/**
 * Checks whether a room fits within the plot boundaries for its floor (accounting for rotation)
 */
export function isRoomWithinBounds(room, plotWidth, plotLength, tolerance = 0.05) {
  const bbox = getRoomBoundingBox(room);
  if (bbox.minX < -tolerance || bbox.minY < -tolerance) return false;
  if (bbox.maxX > plotWidth + tolerance) return false;
  if (bbox.maxY > plotLength + tolerance) return false;
  return true;
}

/**
 * Finds all rooms overlapping with targetRoom on the same floor
 */
export function findRoomOverlaps(targetRoom, allRooms) {
  const overlapping = [];
  for (const other of allRooms) {
    if (doRoomsOverlap(targetRoom, other)) {
      overlapping.push(other);
    }
  }
  return overlapping;
}

/**
 * Standard visual & zone presets for room types
 */
export const ROOM_TYPE_DEFAULTS = {
  master_bedroom: { name: 'Master Bedroom', zone: 'private', color: '#38bdf8' },
  bedroom: { name: 'Bedroom', zone: 'private', color: '#818cf8' },
  living: { name: 'Living Hall', zone: 'public', color: '#34d399' },
  kitchen: { name: 'Kitchen', zone: 'service', color: '#fbbf24' },
  bathroom: { name: 'Bathroom', zone: 'service', color: '#94a3b8' },
  dining: { name: 'Dining Area', zone: 'public', color: '#a78bfa' },
  parking: { name: 'Car Parking', zone: 'service', color: '#64748b' },
  balcony: { name: 'Balcony', zone: 'outdoor', color: '#2dd4bf' },
  staircase: { name: 'Staircase', zone: 'circulation', color: '#fb7185' },
  foyer: { name: 'Foyer / Entry', zone: 'circulation', color: '#c084fc' },
  pooja: { name: 'Pooja Room', zone: 'private', color: '#f472b6' },
  utility: { name: 'Utility / Wash', zone: 'service', color: '#cbd5e1' },
  entertainment: { name: 'Entertainment Room', zone: 'public', color: '#6366f1' },
  pool_room: { name: 'Billiards / Pool Room', zone: 'public', color: '#0284c7' },
};

/**
 * Generates a unique room identifier
 */
export function generateUniqueRoomId(type, existingRooms) {
  const base = type.toLowerCase().replace(/[^a-z0-9]/g, '_');
  let counter = 1;
  while (existingRooms.some(r => r.id === `${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}


/**
 * Recalculates area metrics for a modified rooms list
 */
export function recalculateLayoutMetrics(rooms, plotArea, isDimensionsExplicit = true) {
  let roomAreaSumSqFt = 0;
  let groundFloorOccupiedArea = 0;
  let carpetAreaSqFt = 0;
  const roomCounts = {};
  const floorBreakdown = {};

  for (const r of rooms) {
    const area = Math.round(r.width * r.length);
    roomAreaSumSqFt += area;

    if (r.level === 0) {
      groundFloorOccupiedArea += area;
    }

    if (r.type !== 'parking' && r.type !== 'balcony') {
      carpetAreaSqFt += area;
    }

    roomCounts[r.type] = (roomCounts[r.type] || 0) + 1;

    floorBreakdown[r.level] = floorBreakdown[r.level] || {
      level: r.level,
      roomCount: 0,
      totalArea: 0,
      bedrooms: 0,
    };
    floorBreakdown[r.level].roomCount += 1;
    floorBreakdown[r.level].totalArea += area;
    if (r.type === 'master_bedroom' || r.type === 'bedroom') {
      floorBreakdown[r.level].bedrooms += 1;
    }
  }

  const builtUpAreaSqFt = Math.round(roomAreaSumSqFt * 1.15);
  const totalBedrooms = (roomCounts.master_bedroom || 0) + (roomCounts.bedroom || 0);

  let groundCoveragePercent = null;
  let groundCoverageEstimatedPercent = null;

  if (plotArea > 0) {
    const rawCoverage = Math.min(100, Math.round((groundFloorOccupiedArea / plotArea) * 100));
    if (isDimensionsExplicit) {
      groundCoveragePercent = rawCoverage;
    } else {
      groundCoverageEstimatedPercent = rawCoverage;
    }
  }

  return {
    roomAreaSumSqFt,
    totalBuiltUpAreaSqFt: builtUpAreaSqFt,
    totalCarpetAreaSqFt: carpetAreaSqFt,
    groundFloorOccupiedArea,
    groundCoveragePercent,
    groundCoverageEstimatedPercent,
    roomCounts,
    totalBedrooms,
    floorBreakdown,
  };
}

/**
 * Converts an SVG element to downloadable image (PNG format)
 */
export function downloadSvgAsPng(svgElement, filename = 'archai-floorplan.png') {
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const bbox = svgElement.getBBox();
        const canvas = document.createElement('canvas');
        const scaleFactor = 2; // High-resolution export
        canvas.width = (bbox.width + 80) * scaleFactor;
        canvas.height = (bbox.height + 80) * scaleFactor;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 40 * scaleFactor, 40 * scaleFactor, bbox.width * scaleFactor, bbox.height * scaleFactor);

        URL.revokeObjectURL(blobURL);
        const pngUrl = canvas.toDataURL('image/png');

        const downloadLink = document.createElement('a');
        downloadLink.download = filename;
        downloadLink.href = pngUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        resolve(true);
      };
      image.onerror = (err) => {
        URL.revokeObjectURL(blobURL);
        reject(err);
      };
      image.src = blobURL;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Triggers a download of standalone SVG markup
 */
export function downloadSvgFile(svgElement, filename = 'archai-floorplan.svg') {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Add standard SVG namespaces if not present
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
