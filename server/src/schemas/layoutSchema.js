/**
 * ArchAI Room Layout JSON Schema & Standard Specifications
 * 
 * DISCLAIMER:
 * Architectural designs produced by ArchAI are conceptual planning layouts.
 * They do not substitute for certified structural engineering calculations,
 * local municipal bye-law approval, or licensed architectural stamping.
 */

export const ROOM_ZONES = {
  PUBLIC: 'public',     // Living, Drawing, Dining, Porch
  PRIVATE: 'private',   // Master Bedroom, Bedrooms
  SERVICE: 'service',   // Kitchen, Utility, Bathrooms
  SACRED: 'sacred',     // Pooja Room / Mandir
  OUTDOOR: 'outdoor',   // Balcony, Terrace, Garden, Parking
  CIRCULATION: 'circulation', // Corridors, Passages, Foyers
};

export const ZONE_COLORS = {
  [ROOM_ZONES.PUBLIC]: '#3b82f6',     // Blue
  [ROOM_ZONES.PRIVATE]: '#8b5cf6',    // Purple
  [ROOM_ZONES.SERVICE]: '#f97316',    // Orange
  [ROOM_ZONES.SACRED]: '#eab308',     // Gold / Amber
  [ROOM_ZONES.OUTDOOR]: '#10b981',    // Emerald Green
  [ROOM_ZONES.CIRCULATION]: '#64748b',// Slate Gray
};

export const STANDARD_ROOM_SPECS = {
  living_room: {
    minWidth: 10,
    minArea: 120,
    recommendedArea: 180,
    zone: ROOM_ZONES.PUBLIC,
    color: '#38bdf8',
  },
  master_bedroom: {
    minWidth: 10,
    minArea: 110,
    recommendedArea: 150,
    zone: ROOM_ZONES.PRIVATE,
    color: '#a855f7',
  },
  bedroom: {
    minWidth: 9,
    minArea: 90,
    recommendedArea: 120,
    zone: ROOM_ZONES.PRIVATE,
    color: '#818cf8',
  },
  kitchen: {
    minWidth: 6,
    minArea: 48,
    recommendedArea: 75,
    zone: ROOM_ZONES.SERVICE,
    color: '#fb923c',
  },
  dining: {
    minWidth: 8,
    minArea: 64,
    recommendedArea: 100,
    zone: ROOM_ZONES.PUBLIC,
    color: '#38bdf8',
  },
  bathroom: {
    minWidth: 4,
    minArea: 20,
    recommendedArea: 35,
    zone: ROOM_ZONES.SERVICE,
    color: '#06b6d4',
  },
  pooja_room: {
    minWidth: 4,
    minArea: 16,
    recommendedArea: 25,
    zone: ROOM_ZONES.SACRED,
    color: '#eab308',
  },
  parking: {
    minWidth: 9,
    minArea: 100,
    recommendedArea: 140,
    zone: ROOM_ZONES.OUTDOOR,
    color: '#10b981',
  },
  balcony: {
    minWidth: 3.5,
    minArea: 20,
    recommendedArea: 45,
    zone: ROOM_ZONES.OUTDOOR,
    color: '#34d399',
  },
  corridor: {
    minWidth: 3,
    minArea: 25,
    recommendedArea: 50,
    zone: ROOM_ZONES.CIRCULATION,
    color: '#64748b',
  },
  entertainment: {
    minWidth: 10,
    minArea: 120,
    recommendedArea: 180,
    zone: ROOM_ZONES.PUBLIC,
    color: '#6366f1',
  },
  pool_room: {
    minWidth: 12,
    minArea: 160,
    recommendedArea: 240,
    zone: ROOM_ZONES.PUBLIC,
    color: '#0284c7',
  },
  utility: {
    minWidth: 4,
    minArea: 20,
    recommendedArea: 35,
    zone: ROOM_ZONES.SERVICE,
    color: '#f97316',
  },
};

/**
 * Formal Layout JSON Schema representation
 */
export const LAYOUT_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ArchAIFloorPlanLayout',
  type: 'object',
  required: ['id', 'metadata', 'plot', 'rooms', 'summary', 'disclaimer'],
  properties: {
    id: { type: 'string' },
    metadata: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        facing: { type: 'string', enum: ['east', 'north', 'west', 'south', 'northeast'] },
        floorsCount: { type: 'integer', minimum: 1 },
        unit: { type: 'string', const: 'ft' },
      },
    },
    plot: {
      type: 'object',
      properties: {
        width: { type: 'number', minimum: 10 },
        length: { type: 'number', minimum: 10 },
        totalAreaSqFt: { type: 'number', minimum: 100 },
      },
    },
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'name', 'level', 'x', 'y', 'width', 'length', 'area', 'zone'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          level: { type: 'integer', minimum: 0 },
          x: { type: 'number', minimum: 0 },
          y: { type: 'number', minimum: 0 },
          width: { type: 'number', minimum: 1 },
          length: { type: 'number', minimum: 1 },
          area: { type: 'number', minimum: 1 },
          zone: { type: 'string' },
          color: { type: 'string' },
          doors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                wall: { type: 'string', enum: ['north', 'south', 'east', 'west'] },
                offset: { type: 'number' },
                width: { type: 'number' },
              },
            },
          },
          windows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                wall: { type: 'string', enum: ['north', 'south', 'east', 'west'] },
                offset: { type: 'number' },
                width: { type: 'number' },
              },
            },
          },
        },
      },
    },
    summary: {
      type: 'object',
      properties: {
        totalBuiltUpAreaSqFt: { type: 'number' },
        totalCarpetAreaSqFt: { type: 'number' },
        groundCoveragePercent: { type: 'number' },
        roomCounts: { type: 'object' },
      },
    },
    disclaimer: { type: 'string' },
  },
};
