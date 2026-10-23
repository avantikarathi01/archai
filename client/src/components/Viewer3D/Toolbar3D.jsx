import React from 'react';
import {
  Sun,
  Palette,
  Building
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
    <div className="canvas-toolbar viewer-3d-toolbar" style={{ padding: '0.45rem 0.85rem' }}>
      {/* Studio Atmosphere & Finishes */}
      <div className="toolbar-group">
        <span className="toolbar-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
          <Building size={14} color="var(--accent-gold)" /> STYLE:
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
        <span className="toolbar-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
          <Sun size={14} color="var(--accent-gold)" /> LIGHT:
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
        <span className="toolbar-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
          <Palette size={14} color="var(--accent-gold)" /> MATERIAL:
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

      <div className="toolbar-group">
        <span className="toolbar-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
          QUALITY:
        </span>
        <select
          className="toolbar-select"
          value={qualityPreset}
          onChange={(e) => onChangeQualityPreset && onChangeQualityPreset(e.target.value)}
          title="Renderer Quality Preset"
        >
          {Object.values(QUALITY_PRESETS).map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
      </div>

      {isProvisional && (
        <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
          Provisional Dimensions
        </span>
      )}
    </div>
  );
}
