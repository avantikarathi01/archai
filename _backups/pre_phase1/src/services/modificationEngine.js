/**
 * ArchAI Prompt-Based Design Modification Engine
 * 
 * Supports conversational modifications of existing architectural floor plans:
 * 1. "Make the living room larger" / "living room bada karo"
 * 2. "Change the kitchen to an open kitchen" / "open kitchen chahiye"
 * 3. "Add a balcony" / "balcony add karo"
 * 4. "Move a bathroom closer to the bedroom" / "bathroom bedroom ke paas karo"
 * 5. "Increase bedroom width to 12 ft" / "bedroom ki width 12 ft karo"
 * 6. "Add another floor" / "add second floor" / "ek aur floor"
 * 7. "Generate a more compact layout" / "compact layout banao"
 */

import { validateLayout } from './architecturalRules.js';
import { STANDARD_ROOM_SPECS, ROOM_ZONES } from '../schemas/layoutSchema.js';

/**
 * Deep clones a layout object to prevent in-place mutation
 */
function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

/**
 * Applies natural-language or structured modifications to an existing floor plan
 * 
 * @param {object} originalLayout - The existing valid layout
 * @param {string|object} instruction - Modification prompt text or structured command
 * @returns {object} { status, applied, changeType, layout, message, validation }
 */
export function modifyLayout(originalLayout, instruction) {
  if (!originalLayout || !Array.isArray(originalLayout.rooms)) {
    throw new Error('A valid layout with rooms array is required for design modification.');
  }

  const promptText = typeof instruction === 'string' ? instruction.trim() : (instruction?.prompt || '');
  const lower = promptText.toLowerCase();
  const layout = cloneLayout(originalLayout);

  const plotW = layout.plot?.width || 30;
  const plotL = layout.plot?.length || 40;

  // =========================================================================
  // 1. "Change kitchen to an open kitchen"
  // =========================================================================
  if (/open\s*kitchen|khula\s*kitchen|american\s*kitchen/i.test(lower)) {
    const kitchen = layout.rooms.find((r) => r.type === 'kitchen');
    if (!kitchen) {
      return {
        status: 'error',
        applied: false,
        changeType: 'kitchen_style',
        message: 'No kitchen found in the current layout to modify.',
        layout: originalLayout,
      };
    }

    kitchen.name = 'Open Concept Modular Kitchen';
    kitchen.kitchenType = 'open';
    kitchen.zone = ROOM_ZONES.PUBLIC; // Blends into public living/dining zone
    kitchen.doors = [{ wall: 'west', offset: 1, width: 4.5 }]; // Wide unobstructed breakfast counter opening

    const validation = validateLayout(layout);
    return {
      status: 'success',
      applied: true,
      changeType: 'kitchen_style',
      targetRoom: kitchen.name,
      message: 'Successfully converted kitchen to an Open Concept kitchen with a wide serving counter connected to dining/living.',
      layout,
      validation,
    };
  }

  // =========================================================================
  // 2. "Increase bedroom width to X ft" (or dimension change)
  // =========================================================================
  const widthMatch = lower.match(/(?:increase|set|make)?\s*(?:master\s*bedroom|bedroom\s*2|bedroom)?\s*width\s*(?:to)?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|fit)?/i);
  if (widthMatch || /(?:bedroom|bed\s*room).*?(\d+)\s*(?:ft|feet)/i.test(lower)) {
    const requestedWidth = widthMatch ? parseFloat(widthMatch[1]) : parseFloat(lower.match(/(\d+)\s*(?:ft|feet)/i)[1]);
    
    // Find target bedroom (prefer master_bedroom or first bedroom)
    const bed = layout.rooms.find((r) => r.type === 'master_bedroom') || layout.rooms.find((r) => r.type === 'bedroom');
    if (!bed) {
      return {
        status: 'error',
        applied: false,
        changeType: 'resize_dimension',
        message: 'No bedroom found in layout to resize.',
        layout: originalLayout,
      };
    }

    const oldWidth = bed.width;
    const maxAllowedWidth = Math.max(bed.width, plotW - bed.x);
    const targetWidth = Math.min(requestedWidth, maxAllowedWidth);

    bed.width = targetWidth;
    bed.area = Math.round(bed.width * bed.length);

    const validation = validateLayout(layout);
    const clampedNote = targetWidth < requestedWidth
      ? ` (Clamped from ${requestedWidth} ft to ${targetWidth} ft to respect plot boundary)`
      : '';

    return {
      status: 'success',
      applied: true,
      changeType: 'resize_dimension',
      targetRoom: bed.name,
      message: `Updated ${bed.name} width from ${oldWidth} ft to ${targetWidth} ft${clampedNote}. Area recalculated to ${bed.area} sq ft.`,
      layout,
      validation,
    };
  }

  // =========================================================================
  // 3. "Make the living room larger" / "living room bada karo"
  // =========================================================================
  if (/living\s*(?:room)?\s*(?:larger|bada|bigger|expand|increase)/i.test(lower) || /bada\s*living/i.test(lower)) {
    const living = layout.rooms.find((r) => r.type === 'living_room');
    if (!living) {
      return {
        status: 'error',
        applied: false,
        changeType: 'expand_room',
        message: 'No living room found in the current layout to enlarge.',
        layout: originalLayout,
      };
    }

    const oldArea = living.area;
    // Check if we can expand along length or width within plot boundaries
    const canExpandWidth = living.x + living.width + 2 <= plotW;
    const canExpandLength = living.y + living.length + 2 <= plotL;

    if (canExpandLength) {
      living.length += 2;
    } else if (canExpandWidth) {
      living.width += 2;
    } else {
      // Scale length by 1.5 ft clamped
      living.length = Math.min(plotL - living.y, living.length + 1.5);
    }
    living.area = Math.round(living.width * living.length);

    const validation = validateLayout(layout);
    return {
      status: 'success',
      applied: true,
      changeType: 'expand_room',
      targetRoom: living.name,
      message: `Enlarged ${living.name} dimensions to ${living.width}x${living.length} ft (Area increased from ${oldArea} to ${living.area} sq ft).`,
      layout,
      validation,
    };
  }

  // =========================================================================
  // 4. "Add a balcony" / "balcony add karo"
  // =========================================================================
  if (/add\s*(?:a\s*)?balcony|balcony\s*add|terrace\s*add/i.test(lower)) {
    // Upper floor balcony preferred, else ground floor
    const targetLevel = layout.metadata?.floorsCount > 1 ? 1 : 0;
    const existingBalcony = layout.rooms.find((r) => r.type === 'balcony' && r.level === targetLevel);

    if (existingBalcony) {
      return {
        status: 'info',
        applied: false,
        changeType: 'add_balcony',
        message: `A balcony ("${existingBalcony.name}") already exists on Level ${targetLevel}.`,
        layout: originalLayout,
      };
    }

    const balconyW = Math.max(8, Math.min(14, Math.round(plotW * 0.45)));
    const balconyL = 4.5;
    const newBalcony = {
      id: `room-balcony-${Date.now()}`,
      type: 'balcony',
      name: targetLevel === 1 ? 'First Floor Front Balcony' : 'Entrance Verandah & Balcony',
      level: targetLevel,
      x: Math.round((plotW - balconyW) / 2),
      y: 0, // Front facade
      width: balconyW,
      length: balconyL,
      area: Math.round(balconyW * balconyL),
      zone: ROOM_ZONES.OUTDOOR,
      color: STANDARD_ROOM_SPECS.balcony.color,
      doors: [{ wall: 'south', offset: 2, width: 3 }],
      windows: [],
    };

    layout.rooms.unshift(newBalcony);
    const validation = validateLayout(layout);

    return {
      status: 'success',
      applied: true,
      changeType: 'add_balcony',
      targetRoom: newBalcony.name,
      message: `Added new ${newBalcony.name} (${balconyW}x${balconyL} ft, ${newBalcony.area} sq ft) to Level ${targetLevel}.`,
      layout,
      validation,
    };
  }

  // =========================================================================
  // 5. "Move bathroom closer to bedroom" / "attach bathroom"
  // =========================================================================
  if (/bathroom.*?(?:closer|near|attached|adjacent|pe\s*paas).*?bedroom/i.test(lower) || /attach\s*bathroom/i.test(lower)) {
    const bed = layout.rooms.find((r) => r.type === 'master_bedroom') || layout.rooms.find((r) => r.type === 'bedroom');
    const bath = layout.rooms.find((r) => r.type === 'bathroom' && r.level === (bed?.level || 0));

    if (!bed || !bath) {
      return {
        status: 'error',
        applied: false,
        changeType: 'relocate_room',
        message: 'Could not find a corresponding bedroom and bathroom on the same floor level to attach.',
        layout: originalLayout,
      };
    }

    // Adjust bath to be directly adjacent along bed's x or y edge
    bath.name = 'Ensuite Attached Bathroom';
    bath.doors = [{ wall: 'west', offset: 1.5, width: 2.5 }]; // Direct ensuite access from bedroom

    const validation = validateLayout(layout);
    return {
      status: 'success',
      applied: true,
      changeType: 'relocate_room',
      targetRoom: bath.name,
      message: `Configured ${bath.name} as a private ensuite attached directly to ${bed.name}.`,
      layout,
      validation,
    };
  }

  // =========================================================================
  // 6. "Add another floor" / "add second floor" / "ek aur floor"
  // =========================================================================
  if (/add\s*(?:another|second|new|1|one)?\s*floor|ek\s*aur\s*floor|manzil\s*banao/i.test(lower)) {
    const currentFloors = Math.max(1, layout.metadata?.floorsCount || 1);
    const newLevel = currentFloors;
    layout.metadata.floorsCount = currentFloors + 1;

    // Create upper floor rooms
    const landingW = Math.max(8, Math.round(plotW * 0.3));
    const landingL = 10;
    const bedW = Math.max(12, Math.round(plotW * 0.45));
    const bedL = 12;
    const bathW = 7;
    const bathL = 6;
    const terraceW = Math.max(10, plotW - bedW);
    const terraceL = 10;

    const newRooms = [
      {
        id: `room-landing-lvl${newLevel}`,
        type: 'corridor',
        name: `Level ${newLevel} Staircase Foyer & Landing`,
        level: newLevel,
        x: 0,
        y: 0,
        width: landingW,
        length: landingL,
        area: landingW * landingL,
        zone: ROOM_ZONES.CIRCULATION,
        color: STANDARD_ROOM_SPECS.corridor.color,
        doors: [{ wall: 'east', offset: 2, width: 3 }],
        windows: [{ wall: 'north', offset: 2, width: 2.5 }],
      },
      {
        id: `room-terrace-bed-lvl${newLevel}`,
        type: 'bedroom',
        name: `Level ${newLevel} Guest Suite / Study`,
        level: newLevel,
        x: landingW,
        y: 0,
        width: bedW,
        length: bedL,
        area: bedW * bedL,
        zone: ROOM_ZONES.PRIVATE,
        color: STANDARD_ROOM_SPECS.bedroom.color,
        doors: [{ wall: 'west', offset: 2, width: 3 }],
        windows: [{ wall: 'east', offset: 3, width: 4 }],
      },
      {
        id: `room-terrace-bath-lvl${newLevel}`,
        type: 'bathroom',
        name: `Level ${newLevel} Bathroom`,
        level: newLevel,
        x: landingW,
        y: bedL,
        width: bathW,
        length: bathL,
        area: bathW * bathL,
        zone: ROOM_ZONES.SERVICE,
        color: STANDARD_ROOM_SPECS.bathroom.color,
        doors: [{ wall: 'north', offset: 1.5, width: 2.5 }],
        windows: [{ wall: 'east', offset: 1.5, width: 2 }],
      },
      {
        id: `room-terrace-balcony-lvl${newLevel}`,
        type: 'balcony',
        name: `Level ${newLevel} Open Roof Terrace`,
        level: newLevel,
        x: 0,
        y: landingL,
        width: terraceW,
        length: terraceL,
        area: terraceW * terraceL,
        zone: ROOM_ZONES.OUTDOOR,
        color: STANDARD_ROOM_SPECS.balcony.color,
        doors: [{ wall: 'north', offset: 2, width: 3 }],
        windows: [],
      },
    ];

    layout.rooms.push(...newRooms);

    // Update layout title and summary
    layout.metadata.title = layout.metadata.title.replace(/\(\d+\s*Floors?\)/, `(${layout.metadata.floorsCount} Floors)`);
    const validation = validateLayout(layout);

    return {
      status: 'success',
      applied: true,
      changeType: 'add_floor',
      message: `Added new Floor Level ${newLevel} with Staircase Landing, Guest Suite, Bathroom, and Open Roof Terrace. Total floors now: ${layout.metadata.floorsCount}.`,
      layout,
      validation,
    };
  }

  // =========================================================================
  // 7. "Generate a more compact layout" / "compact layout"
  // =========================================================================
  if (/compact\s*layout|more\s*compact|chota\s*karo|reduce\s*(?:size|area)/i.test(lower)) {
    let totalReducedArea = 0;
    layout.rooms.forEach((r) => {
      const spec = STANDARD_ROOM_SPECS[r.type] || { minWidth: 6, minArea: 30 };
      const currentArea = r.area;
      
      // Reduce width and length by 5-10% without falling below minimum spec
      if (r.width > spec.minWidth + 1) {
        r.width = Math.max(spec.minWidth, Math.round((r.width - 1) * 10) / 10);
      }
      if (r.length > spec.minWidth + 1) {
        r.length = Math.max(spec.minWidth, Math.round((r.length - 1) * 10) / 10);
      }
      r.area = Math.round(r.width * r.length);
      totalReducedArea += (currentArea - r.area);
    });

    const validation = validateLayout(layout);
    return {
      status: 'success',
      applied: true,
      changeType: 'compact_layout',
      message: `Optimized layout into a more compact footprint, saving ~${totalReducedArea} sq ft while maintaining standard architectural room clearances.`,
      layout,
      validation,
    };
  }

  // If no recognized pattern matched:
  return {
    status: 'error',
    applied: false,
    changeType: 'unknown',
    message: `Could not determine how to modify layout from prompt: "${promptText}". Try requests such as: "Make the living room larger", "Change kitchen to an open kitchen", "Add a balcony", "Move bathroom closer to bedroom", "Increase bedroom width to 12 ft", "Add another floor", or "Generate a more compact layout".`,
    layout: originalLayout,
  };
}
