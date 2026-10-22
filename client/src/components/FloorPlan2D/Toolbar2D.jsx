import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scan,
  Undo2,
  Redo2,
  RotateCcw,
  Plus,
  Download,
  Printer,
  Grid,
  Layers
} from 'lucide-react';

export default function Toolbar2D({
  floors = [0],
  activeFloor = 0,
  onSelectFloor,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitEntirePlan,
  isFullscreen = false,
  onToggleFullscreen,
  gridSnap = 1.0,
  onChangeGridSnap,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onResetLayout,
  onOpenAddRoom,
  onExportPng,
  onExportSvg,
  onOpenPrintPreview,
  isProvisional = false
}) {
  return (
    <div className="canvas-toolbar">
      {/* Floor selector tabs */}
      <div className="toolbar-group floor-tabs">
        <span className="toolbar-label">
          <Layers size={14} /> Floor:
        </span>
        {floors.map((lvl) => (
          <button
            key={lvl}
            type="button"
            className={`floor-tab-btn ${activeFloor === lvl ? 'active' : ''}`}
            onClick={() => onSelectFloor(lvl)}
          >
            {lvl === 0 ? 'Ground Floor (L0)' : `Floor ${lvl} (L${lvl})`}
          </button>
        ))}
      </div>

      {/* Grid snap selector */}
      <div className="toolbar-group">
        <span className="toolbar-label">
          <Grid size={14} /> Snap:
        </span>
        <select
          className="toolbar-select"
          value={gridSnap}
          onChange={(e) => onChangeGridSnap(Number(e.target.value))}
        >
          <option value={1.0}>1.0 ft (Standard)</option>
          <option value={0.5}>0.5 ft (Precise)</option>
          <option value={0.25}>0.25 ft (Fine)</option>
          <option value={0}>Off (Free Move)</option>
        </select>
      </div>

      {/* Zoom & Viewport controls */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          title="Zoom In"
          onClick={onZoomIn}
        >
          <ZoomIn size={15} />
        </button>
        <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="toolbar-btn"
          title="Zoom Out"
          onClick={onZoomOut}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="Fit Entire Floor Plan (auto-scale and center)"
          onClick={onFitEntirePlan || onZoomReset}
        >
          <Scan size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="Reset Zoom to 100%"
          onClick={onZoomReset}
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${isFullscreen ? 'active' : ''}`}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen 2D Canvas"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* History (Undo / Redo / Reset) */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="Reset to Initial Generated Layout"
          onClick={onResetLayout}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Actions */}
      <div className="toolbar-group toolbar-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem' }}
          onClick={onOpenAddRoom}
        >
          <Plus size={15} /> Add Room
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Export as PNG image"
          onClick={onExportPng}
        >
          <Download size={15} /> PNG
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Export as Standalone SVG"
          onClick={onExportSvg}
        >
          <Download size={15} /> SVG
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Print Floor Plan & Room Schedule"
          onClick={onOpenPrintPreview}
        >
          <Printer size={15} /> Print
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
