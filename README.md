# ArchAI 🏛️✨
> AI-Powered Architectural Design Platform

ArchAI is a modern web platform designed to translate natural language house requirements (English and Hinglish) into 2D editable floor plans, interactive 3D house models, architectural validation checks, and construction cost estimates.

---

## Current Status: Phase 6 Immersive 3D House Simulator Complete 🏛️🎮✨

ArchAI now features a game-like first-person architectural simulator (inspired by the open-world exploration mechanics of *The Sims* and *GTA*, designed strictly for architectural exploration):

- **Complete House & Property Estate Generator:**
  - *Boundary Compound Walls:* 6 ft perimeter masonry walls with coping slabs and setbacks framing the property.
  - *Main & Pedestrian Entrance Gates:* Double-leaf vehicular gate (12 ft) and pedestrian wicket gate (3.5 ft) with realistic hinge pivots.
  - *Gate Pillars & Lanterns:* Sturdy entrance gate pillars with illuminated pyramidal caps and warm exterior point-light lanterns.
  - *Paved Driveway & Walkway:* Driveway connecting the vehicular gate directly into the parking bay, and pedestrian walkway linking the wicket gate to the entrance steps.
  - *Garden Lawns & Landscaping:* Lush green lawns, procedural tiered architectural trees (trunks + stylized foliage cones), and perimeter boxwood hedges along compound walls.
  - *Entrance Steps & Porch Canopy:* Raised entrance plinth steps and a cantilevered floating porch awning with slim steel columns and recessed downlights.
  - *Roof Terrace & Parapet:* Upper roof terrace with perimeter safety parapet / railing.

- **Direct User-Controlled First-Person Simulator (FPS):**
  - *Controls:* `[W][A][S][D]` / Arrow keys for movement, `[Shift]` to sprint ($13.5\text{ ft/s}$ vs $7.0\text{ ft/s}$ walk), `[Space]` to jump/step up, `[Esc]` to exit.
  - *Mouse Look:* High-precision mouse look with Pointer Lock API support and smooth drag-look fallback. Vertical pitch clamped strictly to $[-83^\circ, +83^\circ]$ to prevent gimbal flipping.
  - *Virtual Touch Controls:* On-screen touch D-pad, sprint toggle, and interaction buttons for mobile and tablet touchscreens.
  - *Outside Spawn Point:* Automatically spawns outside on the approach street in front of the entrance gate, looking directly toward the house at eye level ($Y = 5.5\text{ ft}$).

- **Solid Collision Detection & Smooth Wall Sliding:**
  - *Axis-Separated Collision Solver:* Decomposes movement into independent $X$ and $Z$ axes. When moving diagonally into a wall or corner, the colliding axis stops while the perpendicular axis glides freely along the wall face (player never gets stuck).
  - *Automatic Step-Up Allowance:* Obstacles $\le 0.85\text{ ft}$ (porch plinth, curbs, stairs) step up automatically.
  - *Collision Boundaries:* Compound boundary walls, gate pillars, house walls, closed doors, large furniture (beds, sofas, kitchen island, car), and tree trunks.

- **Continuous Staircase Flight Climbing:**
  - Real-time detection when entering a staircase room on Ground Floor (Level 0).
  - Calculates normalized progression $t \in [0, 1]$ along the stair flight length.
  - Smoothly elevates player from $Y = 5.5\text{ ft}$ (Level 0 eye-level) to $Y = 15.5\text{ ft}$ (Level 1 eye-level, $10\text{ ft}$ story height) and transitions active floor state seamlessly.

- **Interactive Architectural Elements:**
  - *Animated Doors & Gates:* Pressing `[E]` or clicking within $5\text{ ft}$ smoothly rotates doors and gates open/closed ($90^\circ$ swing). Dynamically updates collision boxes (can walk freely through open doors; blocked when closed).
  - *Lighting Toggle:* Pressing `[F]` or clicking the HUD button switches all room ceiling lights and exterior lanterns ON or OFF with immediate visual feedback.
  - *Furniture Inspection HUD Card:* Aiming at any furniture item within $10\text{ ft}$ triggers a floating HUD card displaying item name, exact dimensions ($W \times L \times H$), material finish, and architectural circulation clearance.

- **4 Architectural Design Concepts:**
  1. *Contemporary Minimalist:* Clean off-white stucco, slate metal trims, frameless glass, horizontal slat gates, emerald lawn.
  2. *Warm Modern Japandi:* Warm lime wash, cedar/teak timber battens, warm bronze trim, vertical timber gates, organic biophilic garden.
  3. *Luxury Mediterranean Villa:* Sun-drenched sandstone cream, terracotta coping, wrought-iron decorative gates, olive-tinted lawn.
  4. *Industrial Urban Loft:* Charcoal concrete stucco, exposed brick accents, graphite structural steel, perforated steel mesh gates.
  - Each concept includes architectural trade-offs, advantages, estimated cost multipliers, and maintenance requirements displayed in the 3D Studio Inspector.

- **Preservation of All Studio Features:**
  - The 7 viewing modes (`all`, `ground`, `first`, `cutaway`, `exploded`, `topdown`, `exterior`), reveal animation sequence, guided walkthrough tour, live 2D-to-3D sync, and statutory architectural disclaimer remain fully operational with zero regressions.

---

## Project Structure

```text
innotech/
├── client/                               # Frontend Application (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── FloorPlan2D/
│   │   │   │   ├── Canvas2D.jsx          # Interactive SVG canvas (drag, resize, walls, stairs)
│   │   │   │   ├── Toolbar2D.jsx         # Floor switcher, zoom, snap, undo/redo, export buttons
│   │   │   │   ├── PropertiesPanel.jsx   # Selected room inspector & floor metrics
│   │   │   │   ├── AddRoomModal.jsx      # Modal dialog to add custom or preset rooms
│   │   │   │   ├── DeleteConfirmModal.jsx# Safe room deletion with confirmation
│   │   │   │   ├── PrintPreviewModal.jsx # High-contrast print view & room schedule
│   │   │   │   └── FloorPlan2D.jsx       # Canvas orchestrator & history stack
│   │   │   └── Viewer3D/
│   │   │       ├── Canvas3D.jsx          # Three.js WebGL viewport, property site, extruded walls, lights
│   │   │       ├── Toolbar3D.jsx         # Simulator toggle, concepts, floor modes, camera presets
│   │   │       └── Viewer3D.jsx          # Simulator orchestrator, HUD overlay & concept tradeoffs card
│   │   ├── services/
│   │   │   └── api.js                    # API service for health, parser & layout calls
│   │   ├── utils/
│   │   │   ├── canvasMath.js             # Feet/pixel scaling, snapping, AABB overlaps, exports
│   │   │   ├── threeMath.js              # 2D-to-3D coordinates, floor elevation, walls & stairs
│   │   │   ├── propertyGenerator.js      # Site compound walls, gates, pillars, landscaping & canopy
│   │   │   ├── FirstPersonController.js  # WASD, mouse look, wall sliding, stairs climbing & doors
│   │   │   └── designConcepts.js         # 4 Architectural design concepts & trade-offs
│   │   ├── App.jsx                       # Interactive Phase 2, 3, 4 & 6 studio
│   │   ├── index.css                     # Dark theme UI, simulator HUD, crosshair & touch controls
│   │   └── main.jsx                      # React root mount
│   ├── index.html
│   ├── package.json
│   └── vite.config.js                    # Port 5173 with /api reverse-proxy to port 5000
│
├── server/                               # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── routes/
│   │   │   └── api.js                    # Endpoints for parse, generate, validate, recommend
│   │   ├── schemas/
│   │   │   └── layoutSchema.js           # Documented JSON schema & standard room dimensions
│   │   ├── services/
│   │   │   ├── promptParser.js           # Multilingual (English + Hinglish) NLP parser
│   │   │   ├── layoutGenerator.js        # Deterministic 2D room coordinate generator
│   │   │   └── architecturalRules.js     # Overlap detection, boundary checks & Vastu advice
│   │   ├── app.js                        # Express application with CORS & routes
│   │   └── index.js                      # Server entry point listening on port 5000
│   ├── tests/
│   │   ├── health.test.js                # Server health tests
│   │   ├── phase2.test.js                # Parser, Hinglish, overlap & impossible layout tests
│   │   ├── phase3_canvas.test.js         # Canvas math, snapping, drag/resize, history & floors
│   │   ├── phase4_3d.test.js             # 3D coordinates, elevations, walls, stairs & live updates
│   │   └── phase6_simulator.test.js      # Property setbacks, AABB collision, wall sliding & stairs
│   ├── .env.example                      # Environment variables template
│   ├── .env                              # Local environment config
│   └── package.json
│
├── .gitignore
├── package.json                          # Workspace helper scripts
└── README.md                             # Setup, documentation, and API reference
```

---

## Quick Start (Windows PowerShell)

> **Note for Windows PowerShell users:** If script execution is restricted on your system, execute commands using `npm.cmd`.

### Step 1: Install Dependencies
```powershell
# In innotech/server
cd server
npm.cmd install
cd ..

# In innotech/client
cd client
npm.cmd install
cd ..
```

### Step 2: Start the Backend Server
```powershell
cd server
npm.cmd run dev
```
* **Server URL:** `http://localhost:5000`

### Step 3: Start the Frontend Client
```powershell
cd client
npm.cmd run dev
```
* **Client App:** `http://localhost:5173`

### Step 4: Run Automated Tests
```powershell
cd server
npm.cmd test
```
* Runs **48 automated unit & integration tests** across `health.test.js`, `phase2.test.js`, `phase3_canvas.test.js`, `phase4_3d.test.js`, and `phase6_simulator.test.js` covering English/Hinglish parsing, boundary checks, AABB overlap detection, coordinate conversions, grid snapping, drag/resize editing, history undo/redo transitions, floor switching, 3D coordinate centering, floor elevations, wall extrusions, 3D stair generation, real-time layout updates, schematic furniture generation, smart anti-overlap label scaling, dynamic camera auto-framing, deterministic reveal sequence states, walkthrough tour waypoints at 5.5 ft eye-level, 5 cinematic lighting presets, 4 architectural material finish styles, 3 quality performance presets, the 7 architectural viewing modes, walkthrough camera distance safety, property site setbacks, gate and pillar placement, outside spawn safety, 3D AABB collision detection, axis-separated wall sliding math, dynamic door collision toggling, continuous stair climbing progression, and the 4 architectural design concepts with trade-offs.

---

## Phase 2 API Reference

### 1. `POST /api/parse-requirements`
Parses freeform English or Hinglish text into structured architectural constraints.

#### Request Example:
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/parse-requirements -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"prompt": "3 BHK east facing on 30x40 ft plot with car parking, open kitchen and pooja room"}'
```

#### Response Example:
```json
{
  "status": "success",
  "rawPrompt": "3 BHK east facing on 30x40 ft plot with car parking, open kitchen and pooja room",
  "requirements": {
    "plot": {
      "width": 30,
      "length": 40,
      "totalAreaSqFt": 1200,
      "unit": "ft"
    },
    "floors": 1,
    "bedrooms": 3,
    "bathrooms": 2,
    "kitchen": {
      "type": "open",
      "modular": false
    },
    "parking": {
      "required": true,
      "type": "car",
      "capacity": 1
    },
    "poojaRoom": true,
    "facing": "east",
    "budget": {
      "tier": "standard"
    },
    "clarifications": []
  }
}
```

---

### 2. `POST /api/generate-design`
Generates a complete 2D room layout with exact coordinates, doors, windows, and geometry validation.

#### Request Example:
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/generate-design -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"prompt": "2 BHK east facing on 30x40 plot with car parking"}'
```

#### Response Example (Truncated):
```json
{
  "status": "success",
  "layout": {
    "id": "archai-plan-1729416000000",
    "metadata": {
      "title": "2 BHK EAST-Facing Residential Design",
      "facing": "east",
      "floorsCount": 1,
      "unit": "ft"
    },
    "plot": {
      "width": 30,
      "length": 40,
      "totalAreaSqFt": 1200
    },
    "rooms": [
      {
        "id": "room-1",
        "type": "parking",
        "name": "Car Porch / Parking",
        "level": 0,
        "x": 0,
        "y": 3,
        "width": 11,
        "length": 12,
        "area": 132,
        "zone": "outdoor"
      },
      {
        "id": "room-2",
        "type": "living_room",
        "name": "Living Room / Drawing Hall",
        "level": 0,
        "x": 11,
        "y": 3,
        "width": 19,
        "length": 12,
        "area": 228,
        "zone": "public"
      }
    ],
    "summary": {
      "totalBuiltUpAreaSqFt": 768,
      "totalCarpetAreaSqFt": 630,
      "groundCoveragePercent": 64
    },
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": []
    }
  },
  "disclaimer": "DISCLAIMER: ArchAI plans are conceptual architectural layouts for planning and design exploration..."
}
```

---

### 3. `POST /api/validate-design`
Checks a layout for room overlaps, boundary infractions, and minimum room sizes.

#### Request Example:
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/validate-design -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{ "layout": { "plot": {"width": 30, "length": 40}, "rooms": [...] } }'
```

---

### 4. `POST /api/recommendations`
Returns architectural and Vastu suggestions for room placement, cross-ventilation, and privacy.

---

## How to Test in the Running Application

1. Open `http://localhost:5173` in your browser.
2. In the **Multilingual Requirement Parser & Layout Generator** studio:
   * Click **"3 BHK Modern (English)"** or **"2 BHK Do Manzil (Hinglish)"** from the sample chips.
   * Click **"Generate 2D Floor Plan"** to see extracted parameters, room coordinates, area totals, and Vastu insights.
   * Click the **"Rooms"**, **"Validation & Advice"**, or **"Schema JSON"** tabs to inspect the generated geometry.
   * Click **"Missing Dimensions (Test Clarification)"** to observe the clarification questions engine in action.
   * Click **"Impossible Layout (Test Error)"** to verify impossible layout detection (e.g., trying to fit 5 bedrooms on a 150 sq ft plot).

---

## Disclaimers & Known Limitations

> [!IMPORTANT]
> **Engineering Disclaimer:** Floor plans generated by ArchAI are **conceptual architectural layouts** intended for initial space planning, requirement visualization, and design exploration. They do not claim structural safety compliance, seismic load suitability, or local municipal building bye-law certification. A licensed architect and structural engineer must review and approve all structural drawings before excavation or construction.

### Current Engine Limitations:
1. **Plot Shapes:** The current procedural engine is optimized for rectangular and square urban plots. Irregular polygons and cul-de-sac plots will be addressed in future versions.
2. **Multi-Storey Stairwells:** In G+1 designs, circulation passages represent vertical access zones; explicit 3D stair flight geometry will be detailed in Phase 4.
