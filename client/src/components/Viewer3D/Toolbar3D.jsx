import React from 'react';
import {
  RotateCcw,
  Eye,
  Layers,
  Box,
  Compass,
  Armchair,
  Sun,
  Palette,
  Building,
  Maximize2,
  Minimize2,
  Footprints
} from 'lucide-react';
import {
  LIGHTING_PRESETS,
  MATERIAL_STYLES,
  QUALITY_PRESETS
} from '../../utils/threeMath';
import { DESIGN_CONCEPTS } from '../../utils/designConcepts';

export default function Toolbar3D({
  floorMode = 'all', // 'all' | 'ground' | 'first' | 'cutaway' | 'exploded' | 'topdown'
  onChangeFloorMode,
  cameraPreset = 'iso', // 'iso' | 'top' | 'front' | 'frame'
  onSelectCameraPreset,
  wallHeightMode = 'cutaway', // 'cutaway' | 'full'
  onToggleWallHeight,
  showLabels = true,
  onToggleLabels,
  showFurniture = true,
  onToggleFurniture,
  lightingPreset = 'warm_daylight',
  onChangeLightingPreset,
  materialStyle = 'modern_scandi',
  onChangeMaterialStyle,
  qualityPreset = 'balanced',
  onChangeQualityPreset,
  // First-Person Walkthrough
  isSimulator = false,
  onToggleSimulator,
  isFullscreen = false,
  onToggleFullscreen,
  designConcept = 'contemporary_minimalist',
  onChangeDesignConcept,
  isProvisional = false,
  floors = [0, 1]
}) {
  return (
    <div className="canvas-toolbar viewer-3d-toolbar">
      {/* Primary Mode Switcher: Orbit 3D Studio vs Single Reliable Walkthrough */}
      <div className="toolbar-group">
        <button
          type="button"
          className={`btn ${!isSimulator ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 700
          }}
          onClick={() => isSimulator && onToggleSimulator()}
          title="Orbit Camera: Freely rotate, inspect, and frame the 3D model"
        >
          <Box size={14} /> 3D Orbit View
        </button>

        <button
          type="button"
          className={`btn ${isSimulator ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: isSimulator ? '#0284c7' : undefined,
            color: isSimulator ? '#ffffff' : undefined,
            fontWeight: 700
          }}
          onClick={onToggleSimulator}
          title="Single Walkthrough: Explore the home from ground entrance with WASD and mouse look"
        >
          <Footprints size={15} color={isSimulator ? '#ffffff' : '#38bdf8'} /> {isSimulator ? 'Exit Walkthrough' : 'Enter House'}
        </button>
      </div>

      {/* Orbit & Inspection Controls: Active when not in First-Person Walkthrough */}
      {!isSimulator && (
        <>
          {/* Floor & Cutaway Selector */}
          <div className="toolbar-group">
            <span className="toolbar-label">
              <Layers size={14} /> Levels:
            </span>
            <button
              type="button"
              className={`floor-tab-btn ${floorMode === 'all' ? 'active' : ''}`}
              onClick={() => onChangeFloorMode('all')}
              title="Show complete building with all floors assembled"
            >
              Full House
            </button>
            <button
              type="button"
              className={`floor-tab-btn ${floorMode === 'ground' ? 'active' : ''}`}
              onClick={() => onChangeFloorMode('ground')}
              title="Isolate Ground Floor (Level 0)"
            >
              Ground (L0)
            </button>
            {floors.includes(1) && (
              <button
                type="button"
                className={`floor-tab-btn ${floorMode === 'first' ? 'active' : ''}`}
                onClick={() => onChangeFloorMode('first')}
                title="Isolate First Floor (Level 1)"
              >
                Floor 1 (L1)
              </button>
            )}
            <button
              type="button"
              className={`floor-tab-btn ${floorMode === 'cutaway' ? 'active' : ''}`}
              onClick={() => onChangeFloorMode('cutaway')}
              title="Architectural cutaway view for inspecting room interiors"
            >
              Cutaway
            </button>
          </div>

          {/* Camera Controls & Framing */}
          <div className="toolbar-group">
            <span className="toolbar-label">
              <Compass size={14} /> Camera:
            </span>
            <button
              type="button"
              className={`toolbar-btn ${cameraPreset === 'frame' ? 'active' : ''}`}
              onClick={() => onSelectCameraPreset('frame')}
              title="Fit house and entire property to view"
            >
              <RotateCcw size={13} /> Fit View
            </button>
            <button
              type="button"
              className={`toolbar-btn ${cameraPreset === 'iso' ? 'active' : ''}`}
              onClick={() => onSelectCameraPreset('iso')}
              title="Isometric Perspective View"
            >
              Iso
            </button>
            <button
              type="button"
              className={`toolbar-btn ${cameraPreset === 'top' ? 'active' : ''}`}
              onClick={() => onSelectCameraPreset('top')}
              title="Top-down Overhead View"
            >
              Top
            </button>
            <button
              type="button"
              className={`toolbar-btn ${cameraPreset === 'front' ? 'active' : ''}`}
              onClick={() => onSelectCameraPreset('front')}
              title="Front Elevation View"
            >
              Front
            </button>
          </div>
        </>
      )}

      {/* Architectural Finishes & Atmosphere */}
      <div className="toolbar-group">
        <span className="toolbar-label">
          <Building size={14} /> Style:
        </span>
        <select
          className="toolbar-select"
          value={designConcept}
          onChange={(e) => onChangeDesignConcept && onChangeDesignConcept(e.target.value)}
          title="Architectural facade & finishes"
        >
          {Object.values(DESIGN_CONCEPTS).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">
          <Sun size={14} /> Light:
        </span>
        <select
          className="toolbar-select"
          value={lightingPreset}
          onChange={(e) => onChangeLightingPreset(e.target.value)}
          title="Lighting Atmosphere Preset"
        >
          {Object.values(LIGHTING_PRESETS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">
          <Palette size={14} /> Material:
        </span>
        <select
          className="toolbar-select"
          value={materialStyle}
          onChange={(e) => onChangeMaterialStyle(e.target.value)}
          title="Interior Material Palette"
        >
          {Object.values(MATERIAL_STYLES).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Visibility Toggles & Fullscreen */}
      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn ${showFurniture ? 'active' : ''}`}
          onClick={onToggleFurniture}
          title="Toggle Architectural Furniture & Fixtures"
        >
          <Armchair size={13} /> {showFurniture ? 'Furnished' : 'Empty'}
        </button>

        {!isSimulator && (
          <button
            type="button"
            className={`toolbar-btn ${showLabels ? 'active' : ''}`}
            onClick={onToggleLabels}
            title="Toggle 3D Floating Room Labels"
          >
            <Eye size={13} /> {showLabels ? 'Labels' : 'Off'}
          </button>
        )}

        <button
          type="button"
          className={`toolbar-btn ${isFullscreen ? 'active' : ''}`}
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen 3D Viewer"}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {isProvisional && (
        <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
          Provisional Dimensions
        </span>
      )}
    </div>
  );
}
