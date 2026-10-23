/**
 * Multilingual House-Requirement Parser (English + Hinglish)
 * Accurately extracts architectural constraints, distinguishing floor counts
 * from bedroom counts, preserving unknown values, and isolating floor-specific requests.
 */

const NUMBER_WORDS = {
  ek: 1,
  one: 1,
  '1': 1,
  do: 2,
  two: 2,
  '2': 2,
  teen: 3,
  three: 3,
  '3': 3,
  char: 4,
  chaar: 4,
  four: 4,
  '4': 4,
  panch: 5,
  paanch: 5,
  five: 5,
  '5': 5,
};

/**
 * Extracts floor-specific requirements when prompt mentions
 * "ground floor pe...", "1st floor pe...", etc.
 */
function extractFloorSpecificRequirements(lowerText, totalFloors) {
  const floorMap = {};
  for (let i = 0; i < totalFloors; i++) {
    floorMap[i] = {
      level: i,
      name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
      bedrooms: 0,
      bathrooms: 0,
      livingRoom: false,
      dining: false,
      kitchen: false,
      openKitchen: false,
      parking: false,
      poojaRoom: false,
      balcony: false,
      staircase: totalFloors > 1,
      underStairStorage: false,
      plungePool: false,
      commonWashroom: false,
      attachedBath: false,
      entertainmentRoom: false,
      poolRoom: false,
      specified: false,
    };
  }

  // Detect Ground Floor clause:
  // e.g. "ground floor pe gaadi parking" or "ground floor: one car parking space..."
  const gfMatch = lowerText.match(/(?:ground[- ]*floor|ground[- ]*level|nichli[- ]*manzil|\bground\b)(?:[\s:]*(?:pe|par|me|mein|pr|with))?[\s:,-]+(.+?)(?=(?:1st|first|2nd|second|upper|dusri|pehli)[- ]*(?:floor|manzil)|purab|purav|uttar|pashchim|dakshin|east|west|north|south|$)/i);
  let hasGfSpecific = false;
  if (gfMatch) {
    const clause = gfMatch[1].trim();
    hasGfSpecific = true;
    floorMap[0].specified = true;

    // Check parking on GF
    if (/no\s*parking|without\s*parking|zero\s*parking|bina\s*parking|parking\s*(?:nahi|na\s*ho)/i.test(clause)) {
      floorMap[0].parking = false;
    } else if (/gaadi\s*parking|car\s*parking|parking|garage|porch/i.test(clause)) {
      floorMap[0].parking = true;
    }

    // Check dining on GF
    if (/dining/i.test(clause)) {
      floorMap[0].dining = true;
    }

    // Check open kitchen on GF
    if (/open\s*kitchen|khula\s*kitchen/i.test(clause)) {
      floorMap[0].kitchen = true;
      floorMap[0].openKitchen = true;
    } else if (/kitchen|rasoi/i.test(clause)) {
      floorMap[0].kitchen = true;
    }

    // Check bathrooms on GF (accounting for attached bath + common washroom)
    let gfBathCount = 0;
    if (/attached\s*(?:bath|bathroom|toilet|washroom)/i.test(clause)) {
      floorMap[0].attachedBath = true;
      gfBathCount += 1;
    }
    if (/common\s*(?:washroom|bathroom|toilet)|powder\s*room/i.test(clause)) {
      floorMap[0].commonWashroom = true;
      gfBathCount += 1;
    }

    // Check master bedroom on GF
    if (/master\s*bedroom/i.test(clause)) {
      floorMap[0].masterBedroom = true;
      floorMap[0].bedrooms = Math.max(1, floorMap[0].bedrooms);
    }

    // Check staircase on GF
    if (/stair|sidhi|stairs|staircase/i.test(clause)) {
      floorMap[0].staircase = true;
    }

    // Check under-stair storage on GF
    if (/under[- ]*stair(?:case)?[- ]*storage|storage\s*(?:under|below)\s*stair(?:case)?|under[- ]*stair|usable\s*enclosed\s*storage|enclosed\s*storage|store\s*room|storage\s*room/i.test(clause)) {
      floorMap[0].underStairStorage = true;
    }

    // Check aquatic plunge pool on GF
    if (/plunge\s*pool|swimming\s*pool|splash\s*pool|water\s*pool|dip\s*pool|actual\s*(?:small\s*)?pool/i.test(clause)) {
      floorMap[0].plungePool = true;
    } else if (/pool\s*room|billiards|snooker/i.test(clause)) {
      floorMap[0].poolRoom = 'billiards';
    }

    // Check bedrooms on GF
    const gfBhkMatch = clause.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*[-]?\s*bhk/i);
    const gfBedMatch = clause.match(/(?:exactly\s+)?(\d+|ek|one|do|two|teen|three|char|four)[\s-]*(?:bedroom|bedrooms|bed\s*room|kamre|kamra)/i);
    if (gfBhkMatch) {
      const n = NUMBER_WORDS[gfBhkMatch[1].toLowerCase()] || parseInt(gfBhkMatch[1], 10) || 1;
      floorMap[0].bedrooms = n;
      floorMap[0].livingRoom = true;
      floorMap[0].kitchen = true;
      floorMap[0].bathrooms = Math.max(1, floorMap[0].bathrooms);
    } else if (gfBedMatch) {
      const n = NUMBER_WORDS[gfBedMatch[1].toLowerCase()] || parseInt(gfBedMatch[1], 10) || 1;
      floorMap[0].bedrooms = n;
    }

    // Check living on GF
    if (/living|hall|drawing|baithak/i.test(clause)) {
      floorMap[0].livingRoom = true;
    }

    // Check bath count on GF
    const gfBathMatch = clause.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*(?:bathroom|bathrooms|baths|washroom|washrooms|toilet|toilets|lat-?bath)/i);
    if (gfBathMatch) {
      const n = NUMBER_WORDS[gfBathMatch[1].toLowerCase()] || parseInt(gfBathMatch[1], 10) || 1;
      floorMap[0].bathrooms = Math.max(n, gfBathCount);
    } else if (gfBathCount > 0) {
      floorMap[0].bathrooms = gfBathCount;
    } else if (/bath|toilet|washroom|lat-?bath/i.test(clause)) {
      floorMap[0].bathrooms = Math.max(1, floorMap[0].bathrooms);
    }
  }

  // Detect 1st Floor / Upper Floor clause:
  // e.g. "1st floor pe 2 BHK" or "first floor: exactly two bedrooms..."
  const ffMatch = lowerText.match(/(?:1st|first|pehli|upper)[- ]*(?:floor|manzil)(?:[\s:]*(?:pe|par|me|mein|pr|with))?[\s:,-]+(.+?)(?=(?:2nd|second|ground|nichli)[- ]*(?:floor|manzil)|purab|purav|uttar|pashchim|dakshin|east|west|north|south|$)/i);
  let hasFfSpecific = false;
  if (ffMatch) {
    const clause = ffMatch[1].trim();
    hasFfSpecific = true;
    floorMap[1].specified = true;

    // Check entertainment room on FF
    if (/entertainment|home\s*theatre|media\s*room|multipurpose/i.test(clause)) {
      floorMap[1].entertainmentRoom = true;
    }

    // Check plunge pool vs billiards on FF
    if (/plunge\s*pool|swimming\s*pool|splash\s*pool|water\s*pool|dip\s*pool|actual\s*(?:small\s*)?pool/i.test(clause)) {
      floorMap[1].plungePool = true;
    } else if (/pool\s*room|billiards|snooker/i.test(clause)) {
      floorMap[1].poolRoom = 'billiards';
    }

    // Check attached bath on FF
    let ffBathCount = 0;
    if (/attached\s*(?:bath|bathroom|toilet|washroom)/i.test(clause)) {
      floorMap[1].attachedBath = true;
      ffBathCount += 1;
    }
    if (/common\s*(?:washroom|bathroom|toilet)|powder\s*room/i.test(clause)) {
      floorMap[1].commonWashroom = true;
      ffBathCount += 1;
    }

    // Check staircase on FF
    if (/stair|sidhi|stairs|staircase/i.test(clause)) {
      floorMap[1].staircase = true;
    }

    // Check bedrooms on FF
    const ffBhkMatch = clause.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*[-]?\s*bhk/i);
    const ffBedMatch = clause.match(/(?:exactly\s+)?(\d+|ek|one|do|two|teen|three|char|four)[\s-]*(?:bedroom|bedrooms|bed\s*room|kamre|kamra)/i);
    if (ffBhkMatch) {
      const n = NUMBER_WORDS[ffBhkMatch[1].toLowerCase()] || parseInt(ffBhkMatch[1], 10) || 1;
      floorMap[1].bedrooms = n;
      floorMap[1].livingRoom = true;
      floorMap[1].kitchen = true;
      floorMap[1].bathrooms = Math.max(1, floorMap[1].bathrooms);
    } else if (ffBedMatch) {
      const n = NUMBER_WORDS[ffBedMatch[1].toLowerCase()] || parseInt(ffBedMatch[1], 10) || 1;
      floorMap[1].bedrooms = n;
    } else if (/bedroom|kamra/i.test(clause)) {
      floorMap[1].bedrooms = Math.max(1, floorMap[1].bedrooms);
    }

    // Check kitchen on FF
    if (/kitchen|rasoi/i.test(clause)) {
      floorMap[1].kitchen = true;
    }

    // Check living on FF
    if (/living|hall|drawing|baithak|lounge/i.test(clause)) {
      floorMap[1].livingRoom = true;
    }

    // Check bath on FF
    const ffBathMatch = clause.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*(?:bathroom|bathrooms|baths|washroom|washrooms|toilet|toilets|lat-?bath)/i);
    if (ffBathMatch) {
      const n = NUMBER_WORDS[ffBathMatch[1].toLowerCase()] || parseInt(ffBathMatch[1], 10) || 1;
      floorMap[1].bathrooms = Math.max(n, ffBathCount);
    } else if (ffBathCount > 0) {
      floorMap[1].bathrooms = ffBathCount;
    } else if (/bath|toilet|washroom|lat-?bath/i.test(clause)) {
      floorMap[1].bathrooms = Math.max(1, floorMap[1].bathrooms);
    }

    // Check balcony on FF
    if (/balcony|balkani|terrace/i.test(clause)) {
      floorMap[1].balcony = true;
    }
  }

  return {
    floorMap,
    hasFloorSpecificClauses: hasGfSpecific || hasFfSpecific,
  };
}

export function parsePromptRequirements(promptText = '') {
  const raw = String(promptText).trim();
  const lower = raw.toLowerCase();

  const clarifications = [];
  const warnings = [];
  const specialRequests = [];

  // ==========================================
  // 1. Plot Dimensions & Area
  // ==========================================
  let plotWidth = null;
  let plotLength = null;
  let totalAreaSqFt = null;
  let isDimensionsExplicit = false;

  // Check if dimensions are explicitly in meters (e.g. 10x15m, 10 by 15 meters, 10m x 15m)
  const isMeterDimensions = /(?:\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)\s*(?:x|\*|by|into|X|×|\u00d7)|(?:x|\*|by|into|X|×|\u00d7)\s*(?:\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)\b/i.test(lower);

  // Patterns like "30x40", "30*40", "30 by 40", "30 x 40 ft", "30 × 40 ft", "Plot: 30 × 40 ft"
  const dimMatch = lower.match(/(?:plot\s*[:\s-]*)?(\d+(?:\.\d+)?)\s*(?:x|\*|by|into|X|×|\u00d7)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|fit|foot|m|meter|meters|metre|metres)?/i);
  if (dimMatch) {
    let d1 = parseFloat(dimMatch[1]);
    let d2 = parseFloat(dimMatch[2]);
    if (isMeterDimensions) {
      const origD1 = d1;
      const origD2 = d2;
      d1 = Math.round(d1 * 3.28084 * 10) / 10;
      d2 = Math.round(d2 * 3.28084 * 10) / 10;
      specialRequests.push(`Original plot specified in meters: ${origD1}m x ${origD2}m (converted to ${d1}x${d2} ft)`);
    }
    plotWidth = Math.min(d1, d2);
    plotLength = Math.max(d1, d2);
    totalAreaSqFt = Math.round(plotWidth * plotLength);
    isDimensionsExplicit = true;
  } else {
    // Only area given: e.g. "1200 sq ft", "150 gaj", "100 sqm"
    const sqFtMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|square\s*feet|varg\s*fit|sq\s*feet)/i);
    const gajMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:gaj|sq\s*yards?|square\s*yards?)/i);
    const sqMMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*m|sqm|square\s*meters?|square\s*metres?)/i);

    if (sqFtMatch) {
      totalAreaSqFt = Math.round(parseFloat(sqFtMatch[1]));
    } else if (gajMatch) {
      const gaj = parseFloat(gajMatch[1]);
      totalAreaSqFt = Math.round(gaj * 9); // 1 gaj ≈ 9 sq ft
      specialRequests.push(`Original plot specified as ${gaj} gaj (~${totalAreaSqFt} sq ft)`);
    } else if (sqMMatch) {
      const sqM = parseFloat(sqMMatch[1]);
      totalAreaSqFt = Math.round(sqM * 10.7639);
      specialRequests.push(`Original plot area specified as ${sqM} sq m (~${totalAreaSqFt} sq ft)`);
    }

    // Since width and length were not explicitly supplied, do NOT silently assume 30x40 ft.
    // Keep width and length null and ask for clarification!
    if (totalAreaSqFt) {
      clarifications.push({
        field: 'plotDimensions',
        question: `Plot dimensions are missing. What are your plot width and length (e.g. 30x40 ft, 25x48 ft, or 20x60 ft) for your ${totalAreaSqFt} sq ft plot?`,
        defaultAssumed: '30x40 ft (estimated based on standard urban plot ratio)',
      });
    } else {
      clarifications.push({
        field: 'plotDimensions',
        question: 'Plot dimensions and area are missing. What is your plot width and length (e.g. 30x40 ft)?',
        defaultAssumed: '30x40 ft (1200 sq ft)',
      });
    }
  }

  // ==========================================
  // 2. Floors Count (Levels)
  // Distinguish floor count from bedroom count!
  // ==========================================
  let floorsCount = 1;
  let floorsSpecified = false;

  // 1. Patterns for 3 floors
  if (/g\s*\+\s*2|3[- ]*floor|teen[- ]*manzil|3[- ]*stor(?:y|ey)|triple[- ]*stor(?:y|ey)|three[- ]*floor/i.test(lower)) {
    floorsCount = 3;
    floorsSpecified = true;
  }
  // 2. Patterns for explicit single floor (takes priority over general room mentions)
  else if (/single[- ]*floor|ground[- ]*floor\s*only|1[- ]*floor\s*ka\s*makan|ek[- ]*manzil|single[- ]*stor(?:y|ey)|one[- ]*floor/i.test(lower)) {
    floorsCount = 1;
    floorsSpecified = true;
  }
  // 3. Patterns for 2 floors (two-floor, 2-floor, G+1, two-storey, first-floor, double story)
  else if (/g\s*\+\s*1|(\d+|do|two|double)[- ]*floor\s*ka\s*makan|(\d+|do|two|double)[- ]*floors?\b|(\d+|do|two|double)[- ]*manzil\b|(?:two|\d+|do|double)[- ]*stor(?:y|ey)|two[- ]*storeys?|first[- ]*floor|1st[- ]*floor|upper[- ]*floor|pehli[- ]*manzil/i.test(lower)) {
    floorsCount = 2;
    floorsSpecified = true;
  }

  // ==========================================
  // 3. Floor-Specific Distribution & Bedrooms
  // ==========================================
  const { floorMap, hasFloorSpecificClauses } = extractFloorSpecificRequirements(lower, floorsCount);

  // If first-floor clauses were parsed, ensure floorsCount is at least 2
  if (floorMap[1]?.specified && floorsCount < 2) {
    floorsCount = 2;
    floorsSpecified = true;
  }

  let totalBedrooms = 0;
  let totalBathrooms = 0;

  if (hasFloorSpecificClauses) {
    // Floor-specific parsing
    for (let f = 0; f < floorsCount; f++) {
      totalBedrooms += floorMap[f].bedrooms;
      totalBathrooms += floorMap[f].bathrooms;
    }
    // If bedrooms were not specified on individual floors, check if a global bedroom count was mentioned
    if (totalBedrooms === 0) {
      const bhkMatch = lower.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*[-]?\s*bhk/i);
      const bedMatch = lower.match(/(?:exactly\s+)?(\d+|ek|one|do|two|teen|three|char|four)[\s-]*(?:bedroom|bedrooms|bed\s*room|kamre|kamra)/i);
      if (bhkMatch) {
        const val = bhkMatch[1].toLowerCase();
        totalBedrooms = NUMBER_WORDS[val] || parseInt(val, 10) || 0;
      } else if (bedMatch) {
        const val = bedMatch[1].toLowerCase();
        totalBedrooms = NUMBER_WORDS[val] || parseInt(val, 10) || 0;
      }
    }
  } else {
    // Global bedrooms extraction
    const bhkMatch = lower.match(/(\d+|ek|one|do|two|teen|three|char|four)\s*[-]?\s*bhk/i);
    const bedMatch = lower.match(/(\d+|ek|one|do|two|teen|three|char|four)[\s-]*(?:bedroom|bedrooms|bed\s*room|kamre|kamra)/i);

    if (bhkMatch) {
      const val = bhkMatch[1].toLowerCase();
      totalBedrooms = NUMBER_WORDS[val] || parseInt(val, 10) || 2;
    } else if (bedMatch) {
      const val = bedMatch[1].toLowerCase();
      totalBedrooms = NUMBER_WORDS[val] || parseInt(val, 10) || 2;
    } else {
      totalBedrooms = 2;
      clarifications.push({
        field: 'bedrooms',
        question: 'How many bedrooms or BHK do you need?',
        defaultAssumed: '2 BHK',
      });
    }

    // Global bathrooms
    const bathMatch = lower.match(/(\d+|ek|one|do|two|teen|three|char|four)[\s-]*(?:bathroom|bathrooms|baths|washroom|washrooms|toilet|toilets|lat-?bath)/i);
    if (bathMatch) {
      const val = bathMatch[1].toLowerCase();
      totalBathrooms = NUMBER_WORDS[val] || parseInt(val, 10) || 2;
    } else {
      totalBathrooms = totalBedrooms === 1 ? 1 : 2;
    }

    // Distribute across floors
    if (floorsCount === 1) {
      floorMap[0].bedrooms = totalBedrooms;
      floorMap[0].bathrooms = totalBathrooms;
      floorMap[0].livingRoom = true;
      floorMap[0].kitchen = true;
    } else {
      // 2 floors without floor-specific clause:
      // Level 0 gets Living, Kitchen, 1 Bedroom (if 2+ BHK), 1 Bath
      // Level 1 gets remaining Bedrooms, 1 Bath
      const gfBeds = Math.min(1, totalBedrooms - 1);
      floorMap[0].bedrooms = gfBeds;
      floorMap[0].livingRoom = true;
      floorMap[0].kitchen = true;
      floorMap[0].bathrooms = 1;

      floorMap[1].bedrooms = totalBedrooms - gfBeds;
      floorMap[1].livingRoom = true;
      floorMap[1].kitchen = false;
      floorMap[1].bathrooms = Math.max(1, totalBathrooms - 1);
    }
  }

  // Ensure total bathrooms is at least 1
  if (totalBathrooms === 0) {
    totalBathrooms = 1;
    // assign to floor where bedrooms exist
    const bedFloor = Object.values(floorMap).find((f) => f.bedrooms > 0) || floorMap[0];
    bedFloor.bathrooms = Math.max(1, bedFloor.bathrooms);
  }

  // ==========================================
  // 4. Kitchen Style
  // Unspecified unless user explicitly mentions it!
  // ==========================================
  const kitchen = {
    specified: false,
    type: 'unspecified', // 'open' | 'closed' | 'modular' | 'unspecified'
  };

  if (/open\s*kitchen|khula\s*kitchen|american\s*kitchen/i.test(lower)) {
    kitchen.specified = true;
    kitchen.type = 'open';
  } else if (/closed\s*kitchen|band\s*kitchen/i.test(lower)) {
    kitchen.specified = true;
    kitchen.type = 'closed';
  } else if (/modular\s*kitchen/i.test(lower)) {
    kitchen.specified = true;
    kitchen.type = 'modular';
  } else if (/kitchen|rasoi/i.test(lower)) {
    kitchen.specified = true;
    kitchen.type = 'unspecified';
  }

  // ==========================================
  // 5. Parking
  // ==========================================
  const parking = {
    specified: false,
    required: false,
    type: 'none',
    capacity: 0,
    floor: 0,
  };

  const hasNoParking = /no\s*parking|without\s*parking|zero\s*parking|bina\s*parking|parking\s*(?:nahi|na\s*ho|mat|nahin)/i.test(lower);
  if (hasNoParking) {
    parking.specified = true;
    parking.required = false;
    parking.type = 'none';
    parking.capacity = 0;
    floorMap[0].parking = false;
  } else if (/gaadi\s*parking|car\s*parking|parking|garage|porch/i.test(lower)) {
    parking.specified = true;
    parking.required = true;
    parking.type = 'car';
    parking.capacity = /2\s*cars?|do\s*gaadi/i.test(lower) ? 2 : 1;
    floorMap[0].parking = true;
  }

  // ==========================================
  // 6. Balcony
  // ==========================================
  const balcony = {
    specified: false,
    required: false,
  };

  if (/balcony|balkani|balconies|terrace/i.test(lower)) {
    balcony.specified = true;
    balcony.required = true;
    if (floorsCount > 1) {
      floorMap[1].balcony = true;
    } else {
      floorMap[0].balcony = true;
    }
  }

  // ==========================================
  // 7. Pooja Room / Mandir
  // Unspecified unless mentioned!
  // ==========================================
  const poojaRoom = {
    specified: false,
    required: false,
  };

  if (/pooja\s*room|puja\s*room|mandir|prayer\s*room|pooja\s*ghar/i.test(lower)) {
    poojaRoom.specified = true;
    poojaRoom.required = true;
    floorMap[0].poojaRoom = true;
  }

  // ==========================================
  // 7.5 Special Functional Rooms: Dining, Entertainment, Pool Room, Washroom, Storage, Plunge Pool
  // ==========================================
  const dining = /dining/i.test(lower);
  const entertainmentRoom = /entertainment|home\s*theatre|media\s*room|multipurpose/i.test(lower);
  const isAquaticPool = /plunge\s*pool|swimming\s*pool|splash\s*pool|water\s*pool|dip\s*pool|actual\s*(?:small\s*)?pool/i.test(lower);
  const isBilliards = /billiards|snooker|pool\s*table/i.test(lower);
  const poolRoom = isBilliards ? 'billiards' : false;
  const commonWashroom = /common\s*(?:washroom|bathroom|toilet)|powder\s*room/i.test(lower);
  const masterBedroom = /master\s*bedroom/i.test(lower);
  const attachedBath = /attached\s*(?:bath|bathroom|toilet|washroom)/i.test(lower);

  const underStairStorage = /under[- ]*stair(?:case)?[- ]*storage|storage\s*(?:under|below)\s*stair(?:case)?|under[- ]*stair\s*store|usable\s*enclosed\s*under[- ]*stair\s*storage|enclosed\s*under[- ]*stair/i.test(lower) || Object.values(floorMap).some(f => f.underStairStorage);

  const plungePool = {
    specified: isAquaticPool || Object.values(floorMap).some(f => f.plungePool),
    required: isAquaticPool || Object.values(floorMap).some(f => f.plungePool),
  };

  if (dining) floorMap[0].dining = true;
  if (entertainmentRoom && floorsCount > 1) floorMap[1].entertainmentRoom = true;
  if (poolRoom && floorsCount > 1) floorMap[1].poolRoom = poolRoom;
  if (isAquaticPool) {
    // If not already floor-assigned, default to Ground Floor or all floors if multi
    if (!floorMap[0].plungePool && !floorMap[1]?.plungePool) {
      floorMap[0].plungePool = true;
    }
  }
  if (underStairStorage) {
    floorMap[0].underStairStorage = true;
  }
  if (commonWashroom) floorMap[0].commonWashroom = true;
  if (attachedBath) floorMap[0].attachedBath = true;
  if (masterBedroom) {
    floorMap[0].masterBedroom = true;
    floorMap[0].attachedBath = true;
    floorMap[0].bedrooms = Math.max(1, floorMap[0].bedrooms);
  }

  // ==========================================
  // 8. Facing / Orientation
  // Unspecified unless explicitly mentioned!
  // ==========================================
  let facing = 'unspecified';
  let facingSpecified = false;

  if (/east\s*facing|purav\s*mukhi|purab\s*mukhi|\beast\b/i.test(lower)) {
    facing = 'east';
    facingSpecified = true;
  } else if (/north\s*facing|uttar\s*mukhi|\bnorth\b/i.test(lower)) {
    facing = 'north';
    facingSpecified = true;
  } else if (/west\s*facing|pashchim\s*mukhi|\bwest\b/i.test(lower)) {
    facing = 'west';
    facingSpecified = true;
  } else if (/south\s*facing|dakshin\s*mukhi|\bsouth\b/i.test(lower)) {
    facing = 'south';
    facingSpecified = true;
  } else if (/north\s*-\s*east|northeast|ishan/i.test(lower)) {
    facing = 'northeast';
    facingSpecified = true;
  } else {
    clarifications.push({
      field: 'facing',
      question: 'Which direction does the main entrance or road face (East, North, West, South)?',
      defaultAssumed: 'East',
    });
  }

  // ==========================================
  // 9. Natural Light / Ventilation
  // ==========================================
  let naturalLight = 'unspecified';
  if (/airy|ventilated|hawa\s*dar|hawadaar|sunlight|dhup|dhoop|cross\s*ventilation|natural\s*light|badi\s*khidki/i.test(lower)) {
    naturalLight = 'high';
    specialRequests.push('Enhanced natural light and ventilation with larger window openings requested');
  }

  // ==========================================
  // 10. Budget
  // Unspecified unless mentioned!
  // ==========================================
  const budget = {
    specified: false,
    tier: 'unspecified',
    amountLakhs: null,
    currency: 'INR',
  };

  const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)/i);
  const crMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);

  if (lakhMatch) {
    const lakhs = parseFloat(lakhMatch[1]);
    budget.specified = true;
    budget.amountLakhs = lakhs;
    if (lakhs < 25) budget.tier = 'economy';
    else if (lakhs <= 55) budget.tier = 'standard';
    else if (lakhs <= 90) budget.tier = 'premium';
    else budget.tier = 'luxury';
  } else if (crMatch) {
    budget.specified = true;
    budget.amountLakhs = parseFloat(crMatch[1]) * 100;
    budget.tier = 'luxury';
  } else if (/low\s*budget|economy|budget\s*friendly|sasta/i.test(lower)) {
    budget.specified = true;
    budget.tier = 'economy';
  } else if (/luxury|premium|high\s*end|alishan/i.test(lower)) {
    budget.specified = true;
    budget.tier = 'luxury';
  }

  // ==========================================
  // 11. Design Style
  // ==========================================
  let designStyle = 'unspecified';
  if (/indian\s*modern|modern\s*indian/i.test(lower)) {
    designStyle = 'indian_modern';
  } else if (/contemporary|minimalist|clean\s*lines/i.test(lower)) {
    designStyle = 'contemporary_minimalist';
  } else if (/japandi|japanese|scandinavian|biophilic/i.test(lower)) {
    designStyle = 'warm_japandi';
  } else if (/traditional|haveli|classic|heritage/i.test(lower)) {
    designStyle = 'traditional';
  }

  // ==========================================
  // 12. Staircase / Vertical Access
  // ==========================================
  let stairsPreference = 'unspecified';
  if (/internal\s*stair|andar\s*se\s*sidhi|inside\s*stair/i.test(lower)) {
    stairsPreference = 'internal';
  } else if (/external\s*stair|bahar\s*se\s*sidhi|outside\s*stair/i.test(lower)) {
    stairsPreference = 'external';
  } else if (/duplex/i.test(lower)) {
    stairsPreference = 'duplex';
  }

  // ==========================================
  // Facts vs Assumptions Segregation
  // ==========================================
  const extractedFacts = {
    plotDimensionsConfirmed: isDimensionsExplicit,
    plotWidth,
    plotLength,
    plotAreaSqFt: totalAreaSqFt,
    floors: floorsCount,
    floorsExplicit: floorsSpecified,
    bedrooms: totalBedrooms,
    bathrooms: totalBathrooms,
    facing: facingSpecified ? facing : null,
    kitchenSpecified: kitchen.specified,
    parkingRequested: parking.required,
    balconyRequested: balcony.required,
    poojaRoomRequested: poojaRoom.required,
    designStyle: designStyle !== 'unspecified' ? designStyle : null,
    stairsPreference: stairsPreference !== 'unspecified' ? stairsPreference : null,
  };

  const assumptions = [];
  if (!isDimensionsExplicit) {
    assumptions.push('Plot width and length not confirmed; estimated standard urban aspect ratio used for conceptual preview.');
  }
  if (!facingSpecified) {
    assumptions.push('Entrance facing not specified; default East orientation assumed for morning sunlight & Vastu.');
  }
  if (!kitchen.specified) {
    assumptions.push('Kitchen layout style not specified; default standard functional kitchen assumed.');
  }
  if (!floorsSpecified) {
    assumptions.push('Floor count not explicitly mentioned; single-storey layout assumed by default.');
  }

  return {
    rawPrompt: raw,
    extractedFacts,
    assumptions,
    clarifications,
    warnings,
    specialRequests,
    requirements: {
      plot: {
        width: plotWidth,
        length: plotLength,
        totalAreaSqFt,
        unit: 'ft',
        isDimensionsExplicit,
      },
      floors: floorsCount,
      floorsSpecified,
      bedrooms: totalBedrooms,
      bathrooms: totalBathrooms,
      floorRequirements: floorMap,
      kitchen,
      balcony,
      parking,
      poojaRoom,
      entertainmentRoom,
      poolRoom,
      plungePool,
      underStairStorage: {
        specified: underStairStorage,
        required: underStairStorage,
      },
      commonWashroom,
      masterBedroom,
      attachedBath,
      dining,
      facing,
      facingSpecified,
      naturalLight,
      budget,
      designStyle,
      stairsPreference,
      specialRequests,
      clarifications,
      warnings,
      assumptions,
      extractedFacts,
    },
  };
}
