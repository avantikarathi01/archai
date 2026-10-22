/**
 * Canonical Architectural & Geometric Data Schema
 * 
 * Defines structured architectural requirements, topological adjacency graphs,
 * and canonical geometry compatible with openPlan3D and ArchiGen data models.
 * 
 * -----------------------------------------------------------------------------
 * COPYRIGHT & LICENSE NOTICES:
 * 
 * Portions of the adjacency specifications, relationship taxonomy, and cleanup
 * concepts are derived from ArchiGen (https://github.com/Dropio12/archigen).
 * Copyright (c) 2025 Anass El Hallaoui
 * Licensed under the MIT License.
 * 
 * Portions of the vector wall, opening, and multi-floor representation are derived
 * from openPlan3D (https://github.com/laanlabs/openPlan3D).
 * Copyright (c) 2026 theLodgeStudio / Laan Labs
 * Licensed under the MIT License.
 * -----------------------------------------------------------------------------
 */

/**
 * Adjacency relationship types between rooms
 * (Derived from ArchiGen relationship taxonomy)
 */
export const ADJACENCY_RELATIONSHIPS = {
  CONNECTED: 'connected',     // Direct doorway connection (e.g. Master Bed -> Attached Bath)
  ADJACENT: 'adjacent',       // Shares a wall, separate door or direct opening (e.g. Living <-> Dining)
  NEARBY: 'nearby',           // In same zone / connected by corridor (e.g. Bed 2 <-> Common Bath)
  SEPARATED: 'separated',     // Must NOT be directly adjacent (e.g. Parking <-> Master Bed)
};

/**
 * Functional architectural zones
 */
export const ARCHITECTURAL_ZONES = {
  PUBLIC: 'public',           // Living, Drawing, Dining, Foyer
  PRIVATE: 'private',         // Master Bedroom, Bedrooms
  SERVICE: 'service',         // Kitchen, Utility, Bathrooms
  OUTDOOR: 'outdoor',         // Parking, Verandah, Balcony, Terrace
  CIRCULATION: 'circulation', // Stairs, Hallways, Corridors
  SACRED: 'sacred',           // Pooja Room
};

/**
 * Standard minimum dimensions in feet for Indian & International residential planning
 */
export const ROOM_STANDARDS = {
  living_room: { minWidth: 10, minArea: 120, maxAspectRatio: 1.8, zone: ARCHITECTURAL_ZONES.PUBLIC },
  dining: { minWidth: 8, minArea: 64, maxAspectRatio: 1.6, zone: ARCHITECTURAL_ZONES.PUBLIC },
  kitchen: { minWidth: 6, minArea: 48, maxAspectRatio: 1.7, zone: ARCHITECTURAL_ZONES.SERVICE, requiresExteriorWall: true },
  master_bedroom: { minWidth: 10, minArea: 110, maxAspectRatio: 1.6, zone: ARCHITECTURAL_ZONES.PRIVATE },
  bedroom: { minWidth: 9, minArea: 90, maxAspectRatio: 1.6, zone: ARCHITECTURAL_ZONES.PRIVATE },
  attached_bathroom: { minWidth: 4, minArea: 24, maxAspectRatio: 1.8, zone: ARCHITECTURAL_ZONES.SERVICE },
  common_bathroom: { minWidth: 4, minArea: 20, maxAspectRatio: 1.8, zone: ARCHITECTURAL_ZONES.SERVICE },
  pooja_room: { minWidth: 4, minArea: 16, maxAspectRatio: 1.4, zone: ARCHITECTURAL_ZONES.SACRED },
  parking: { minWidth: 9.5, minLength: 15, minArea: 142.5, maxAspectRatio: 2.2, zone: ARCHITECTURAL_ZONES.OUTDOOR },
  staircase: { minWidth: 6.5, minLength: 9.0, minArea: 58.5, maxAspectRatio: 2.0, zone: ARCHITECTURAL_ZONES.CIRCULATION },
  balcony: { minWidth: 3.5, minArea: 21, maxAspectRatio: 3.0, zone: ARCHITECTURAL_ZONES.OUTDOOR },
  foyer: { minWidth: 4.5, minArea: 25, maxAspectRatio: 2.0, zone: ARCHITECTURAL_ZONES.CIRCULATION },
  corridor: { minWidth: 3.0, minArea: 20, maxAspectRatio: 4.0, zone: ARCHITECTURAL_ZONES.CIRCULATION },
};

/**
 * Default architectural adjacency rules
 * (Adapted from ArchiGen _DEFAULT_ADJACENCY_RULES)
 */
export const DEFAULT_ADJACENCY_RULES = [
  // Public core
  { roomA: 'living_room', roomB: 'dining', relationship: ADJACENCY_RELATIONSHIPS.ADJACENT },
  { roomA: 'living_room', roomB: 'foyer', relationship: ADJACENCY_RELATIONSHIPS.CONNECTED },
  { roomA: 'dining', roomB: 'kitchen', relationship: ADJACENCY_RELATIONSHIPS.ADJACENT },
  
  // Master Suite
  { roomA: 'master_bedroom', roomB: 'attached_bathroom', relationship: ADJACENCY_RELATIONSHIPS.CONNECTED },
  
  // Circulation & Access
  { roomA: 'foyer', roomB: 'staircase', relationship: ADJACENCY_RELATIONSHIPS.CONNECTED },
  { roomA: 'foyer', roomB: 'parking', relationship: ADJACENCY_RELATIONSHIPS.NEARBY },
  { roomA: 'bedroom', roomB: 'common_bathroom', relationship: ADJACENCY_RELATIONSHIPS.NEARBY },
  { roomA: 'bedroom', roomB: 'corridor', relationship: ADJACENCY_RELATIONSHIPS.CONNECTED },
];

/**
 * Validates a structured architectural requirement specification
 * 
 * @param {object} req - Structured requirements
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validateStructuredRequirements(req) {
  const errors = [];
  if (!req || typeof req !== 'object') {
    return { isValid: false, errors: ['Requirements payload must be an object.'] };
  }

  const plot = req.plot;
  if (!plot) {
    errors.push('Plot specification is required.');
  } else {
    if (!plot.width || Number(plot.width) <= 0) errors.push('Plot width must be a positive number.');
    if (!plot.length || Number(plot.length) <= 0) errors.push('Plot length must be a positive number.');
  }

  const floors = req.floors !== undefined ? parseInt(req.floors, 10) : 1;
  if (isNaN(floors) || floors < 1 || floors > 4) {
    errors.push('Floors must be an integer between 1 and 4.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
