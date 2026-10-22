# ArchAI Backend Architecture & API Specification

This document details the backend architectural intelligence layer, modular services, and API contract for ArchAI.

---

## 1. Modular Services Architecture

The ArchAI backend architecture is organized into dedicated, decoupled modules in `server/src/services`:

```
server/src/
├── app.js                          # Express application configuration & CORS
├── index.js                        # HTTP Server bootstrap & listening
├── routes/
│   └── api.js                      # RESTful routes + backward-compatible aliases
├── schemas/
│   └── layoutSchema.js             # Canonical JSON schema, room specs & zones
└── services/
    ├── aiProvider.js               # Pluggable AI / LLM interface with deterministic fallback
    ├── architecturalRules.js       # Geometric validation (AABB, SAT, boundary, doors, windows) & Vastu
    ├── costEstimator.js            # Construction cost estimation & itemized civil/MEP/finishes breakdown
    ├── designService.js            # Central intelligence orchestrator & architectural brief builder
    ├── layoutGenerator.js          # Procedural 2D layout generation engine
    ├── modificationEngine.js       # Natural language & conversational layout modification engine
    └── promptParser.js             # Multilingual (English + Hinglish) requirement parser & unit normalizer
```

---

## 2. API Contract Specification

All request and response payloads use JSON. Coordinates and room dimensions are measured in feet (`ft`). Areas are measured in square feet (`sq ft`). Currency is in Indian Rupees (`INR`) formatted as raw numbers and Lakhs (`L`).

### A. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Verifies backend server availability, uptime, and service status.
- **Example Response (200)**:
  ```json
  {
    "status": "ok",
    "service": "archai-server",
    "message": "ArchAI Backend API is up and running smoothly.",
    "timestamp": "2026-10-22T12:30:00.000Z",
    "uptimeSeconds": 142,
    "environment": "development"
  }
  ```

---

### B. Parse Requirements
- **Endpoints**: `POST /api/requirements/parse` (also available via `POST /api/parse-requirements`)
- **Description**: Extracts structured architectural constraints from English or Hinglish natural language prompts. Distinguishes explicitly stated facts from defaulted assumptions.
- **Example Request**:
  ```json
  {
    "prompt": "Mujhe 1200 sq ft ke plot par 2 floor ka Indian modern ghar chahiye. Ground floor par car parking, living room aur kitchen chahiye. First floor par 2 bedrooms, 2 bathrooms aur balcony chahiye."
  }
  ```
- **Example Response (200)**:
  ```json
  {
    "status": "success",
    "rawPrompt": "Mujhe 1200 sq ft ke plot par 2 floor ka Indian modern ghar chahiye...",
    "generationMethod": "deterministic_engine",
    "requirements": {
      "plot": {
        "width": null,
        "length": null,
        "totalAreaSqFt": 1200,
        "unit": "ft",
        "isDimensionsExplicit": false
      },
      "floors": 2,
      "floorsSpecified": true,
      "bedrooms": 2,
      "bathrooms": 2,
      "floorRequirements": {
        "0": { "level": 0, "parking": true, "livingRoom": true, "kitchen": true, "bedrooms": 0 },
        "1": { "level": 1, "bedrooms": 2, "bathrooms": 2, "balcony": true }
      },
      "designStyle": "indian_modern",
      "facing": "unspecified"
    },
    "extractedFacts": {
      "plotDimensionsConfirmed": false,
      "plotAreaSqFt": 1200,
      "floors": 2,
      "bedrooms": 2,
      "bathrooms": 2,
      "designStyle": "indian_modern"
    },
    "assumptions": [
      "Plot width and length not confirmed; estimated standard urban aspect ratio used for conceptual preview.",
      "Entrance facing not specified; default East orientation assumed for morning sunlight & Vastu."
    ],
    "clarifications": [
      {
        "field": "plotDimensions",
        "question": "Plot dimensions are missing. What are your plot width and length (e.g. 30x40 ft, 25x48 ft, or 20x60 ft) for your 1200 sq ft plot?",
        "defaultAssumed": "30x40 ft (estimated based on standard urban plot ratio)"
      }
    ],
    "brief": {
      "projectType": "Residential Independent House",
      "floorsCount": 2,
      "totalBedrooms": 2,
      "totalBathrooms": 2,
      "designStyle": "indian_modern",
      "floorPrograms": [
        { "level": 0, "name": "Ground Floor", "spaces": ["Covered Parking", "Living / Drawing Lounge", "Kitchen", "Staircase Flight"] },
        { "level": 1, "name": "Floor 1", "spaces": ["2 Bedroom(s)", "2 Bathroom(s)", "Balcony / Terrace", "Staircase Flight"] }
      ]
    },
    "disclaimer": "DISCLAIMER: ArchAI plans are conceptual architectural layouts..."
  }
  ```

---

### C. Generate Design
- **Endpoints**: `POST /api/designs/generate` (also available via `POST /api/generate-design`)
- **Description**: Generates procedural 2D floor-plan design, validates geometry, evaluates Vastu recommendations, and calculates preliminary construction cost.
- **Example Request**:
  ```json
  {
    "prompt": "3 BHK house on a 40x60 ft plot with two bathrooms and parking.",
    "plotDimensions": { "width": 40, "length": 60 }
  }
  ```
- **Example Response (200)**:
  ```json
  {
    "status": "success",
    "generationMethod": "deterministic_engine",
    "requirements": { ... },
    "layout": {
      "id": "archai-plan-1718000000000",
      "status": "confirmed",
      "isProvisional": false,
      "metadata": {
        "title": "3 BHK Residential Design (1 Floor)",
        "facing": "east",
        "floorsCount": 1,
        "unit": "ft"
      },
      "plot": { "width": 40, "length": 60, "totalAreaSqFt": 2400, "isDimensionsExplicit": true },
      "rooms": [
        {
          "id": "room-0",
          "type": "parking",
          "name": "Car Porch / Parking",
          "level": 0,
          "x": 2, "y": 2, "width": 14, "length": 18, "area": 252,
          "zone": "outdoor",
          "color": "#10b981",
          "doors": [{ "wall": "north", "offset": 7, "width": 8 }],
          "windows": []
        },
        {
          "id": "room-1",
          "type": "living_room",
          "name": "Living Room",
          "level": 0,
          "x": 16, "y": 2, "width": 20, "length": 18, "area": 360,
          "zone": "public",
          "color": "#38bdf8",
          "doors": [{ "wall": "north", "offset": 2, "width": 3.5 }],
          "windows": [{ "wall": "north", "offset": 8, "width": 4 }]
        }
      ],
      "summary": {
        "totalBuiltUpAreaSqFt": 1540,
        "totalCarpetAreaSqFt": 1340,
        "groundCoveragePercent": 56,
        "totalBedrooms": 3
      }
    },
    "validation": { "status": "confirmed_valid", "isValid": true, "errors": [], "warnings": [] },
    "recommendations": [ ... ],
    "costEstimate": {
      "status": "success",
      "totalCost": {
        "currency": "INR",
        "expectedINR": 3234000,
        "expectedLakhs": 32.34,
        "rangeLakhs": { "min": 29.11, "max": 36.22 }
      },
      "itemizedBreakdown": {
        "civilAndStructure": { "percentage": 48, "estimatedINR": 1552320 },
        "finishingAndFlooring": { "percentage": 24, "estimatedINR": 776160 },
        "mepAndPlumbing": { "percentage": 16, "estimatedINR": 517440 },
        "doorsAndWindows": { "percentage": 8, "estimatedINR": 258720 },
        "exteriorAndBoundary": { "percentage": 4, "estimatedINR": 129360 }
      }
    }
  }
  ```

---

### D. Validate Design
- **Endpoints**: `POST /api/designs/validate` (also available via `POST /api/validate-design`)
- **Description**: Validates geometry, multi-floor containment, room overlap (AABB/SAT), door spans, window offsets, and staircase accessibility.
- **Example Request**:
  ```json
  {
    "layout": { ... }
  }
  ```
- **Example Response (200)**:
  ```json
  {
    "status": "success",
    "validation": {
      "status": "confirmed_valid",
      "isValid": true,
      "isProvisional": false,
      "errors": [],
      "warnings": [],
      "practicalityAlerts": [],
      "info": ["Ground coverage is 62%, leaving 38% for setbacks and light wells."],
      "metrics": {
        "plotAreaSqFt": 1200,
        "builtUpAreaSqFt": 880,
        "carpetAreaSqFt": 765,
        "groundCoveragePercent": 62
      }
    }
  }
  ```

---

### E. Modify Design
- **Endpoint**: `POST /api/designs/modify`
- **Description**: Applies natural-language modifications to an existing floor plan layout.
- **Supported Operations**:
  1. *"Make the living room larger"* (Expands living room dimensions within boundary)
  2. *"Change the kitchen to an open kitchen"* (Converts to open kitchen with serving counter)
  3. *"Add a balcony"* (Allocates exterior balcony room on upper or ground level)
  4. *"Move a bathroom closer to the bedroom"* (Attaches bathroom directly as an ensuite)
  5. *"Increase bedroom width to 12 ft"* (Resizes bedroom width to specified ft, respecting plot boundary)
  6. *"Add another floor"* (Increments floor level, synthesizes terrace bedroom, bath, landing, and balcony)
  7. *"Generate a more compact layout"* (Optimizes and compresses room areas toward minimum standards)
- **Example Request**:
  ```json
  {
    "layout": { ... },
    "prompt": "Change the kitchen to an open kitchen"
  }
  ```
- **Example Response (200)**:
  ```json
  {
    "status": "success",
    "applied": true,
    "changeType": "kitchen_style",
    "targetRoom": "Open Concept Modular Kitchen",
    "message": "Successfully converted kitchen to an Open Concept kitchen with a wide serving counter connected to dining/living.",
    "layout": { ... },
    "validation": { "isValid": true, "errors": [] },
    "costEstimate": { ... }
  }
  ```

---

### F. Design Recommendations
- **Endpoints**: `POST /api/designs/recommendations` (also available via `POST /api/recommendations`)
- **Description**: Evaluates Vastu orientation (North/East entrance, SE Agni kitchen), acoustic rest zoning, and ventilation.

---

### G. Construction Cost Estimate
- **Endpoint**: `POST /api/designs/cost-estimate`
- **Description**: Estimates construction costs by quality tier (`economy`, `standard`, `premium`, `luxury`) and architectural style (`contemporary_minimalist`, `warm_japandi`, `indian_modern`, `traditional`).
- **Example Request**:
  ```json
  {
    "layout": { ... },
    "options": {
      "tier": "premium",
      "designStyle": "indian_modern"
    }
  }
  ```
- **Example Response (200)**:
  ```json
  {
    "status": "success",
    "metrics": {
      "builtUpAreaSqFt": 1540,
      "floorsCount": 2,
      "qualityTier": "premium",
      "tierName": "Premium Designer",
      "designStyle": "indian_modern",
      "styleMultiplier": 1.10,
      "ratePerSqFtINR": 3245
    },
    "totalCost": {
      "currency": "INR",
      "expectedINR": 4997300,
      "expectedLakhs": 49.97,
      "rangeLakhs": { "min": 44.98, "max": 55.97 }
    },
    "itemizedBreakdown": {
      "civilAndStructure": { "percentage": 48, "estimatedINR": 2398704, "scope": "Excavation, foundation, RCC columns, beams, slabs..." },
      "finishingAndFlooring": { "percentage": 24, "estimatedINR": 1199352, "scope": "Vitrified/marble flooring, wall putty, paint..." },
      "mepAndPlumbing": { "percentage": 16, "estimatedINR": 799568, "scope": "Concealed electrical wiring, CPVC plumbing..." },
      "doorsAndWindows": { "percentage": 8, "estimatedINR": 399784, "scope": "Main entrance door, UPVC window frames..." },
      "exteriorAndBoundary": { "percentage": 4, "estimatedINR": 199892, "scope": "Compound wall, MS entrance gate..." }
    },
    "assumptions": [
      "Assumes Premium Designer specification standard.",
      "Built-up area calculated at 1540 sq ft including 15% structural wall and passage overhead.",
      "Excludes land acquisition cost and interior loose furniture."
    ],
    "disclaimer": "DISCLAIMER: Cost figures are preliminary conceptual estimates for budgeting only..."
  }
  ```
