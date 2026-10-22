import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Box,
  Compass,
  ArrowRight,
  Info,
  Maximize
} from 'lucide-react';
import { doRoomsOverlap, isRoomWithinBounds, getRoomBoundingBox } from '../../utils/canvasMath';

export default function PropertiesPanel({
  selectedRoom,
  allRooms = [],
  plotWidth = 30,
  plotLength = 40,
  plotArea = 1200,
  isDimensionsExplicit = true,
  activeFloor = 0,
  onUpdateRoom,
  onDeleteRoomClick,
  onDeselectRoom,
  onOpenAddRoom,
  metrics = {}
}) {
  // Controlled input string states for robust typing & decimal entries
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputW, setInputW] = useState('');
  const [inputL, setInputL] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputRot, setInputRot] = useState('0');
  const [validationErrors, setValidationErrors] = useState({});

  // Synchronize local input state whenever selectedRoom changes
  useEffect(() => {
    if (selectedRoom) {
      setInputX(String(Number(selectedRoom.x.toFixed(2))));
      setInputY(String(Number(selectedRoom.y.toFixed(2))));
      setInputW(String(Number(selectedRoom.width.toFixed(2))));
      setInputL(String(Number(selectedRoom.length.toFixed(2))));
      setInputName(selectedRoom.name || '');
      setInputRot(String(selectedRoom.rotation || 0));
      setValidationErrors({});
    }
  }, [
    selectedRoom?.id,
    selectedRoom?.x,
    selectedRoom?.y,
    selectedRoom?.width,
    selectedRoom?.length,
    selectedRoom?.rotation,
    selectedRoom?.name
  ]);

  // If no room is selected, show floor & plot statistics
  if (!selectedRoom) {
    const floorRooms = allRooms.filter(r => r.level === activeFloor);
    const floorArea = floorRooms.reduce((acc, r) => acc + (r.width * r.length), 0);

    return (
      <div className="properties-panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <Sliders size={18} color="#38bdf8" /> Floor Inspector
          </h3>
          <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
            Level {activeFloor}
          </span>
        </div>

        <div className="panel-section">
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Select any room on the canvas to inspect coordinates, adjust dimensions, or drag/resize it interactively.
          </div>

          <div className="stats-mini-grid">
            <div className="stat-card">
              <span className="stat-label">Plot Footprint</span>
              <span className="stat-value">{plotWidth} × {plotLength} ft</span>
              <span className="stat-sub">{plotArea} sq ft</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Floor Level</span>
              <span className="stat-value">{activeFloor === 0 ? 'Ground' : `Floor ${activeFloor}`}</span>
              <span className="stat-sub">{floorRooms.length} Rooms</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Floor Area</span>
              <span className="stat-value">{Math.round(floorArea)} sq ft</span>
              <span className="stat-sub">Carpet + Circulation</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Ground Coverage</span>
              <span className="stat-value">
                {metrics.groundCoveragePercent !== null
                  ? `${metrics.groundCoveragePercent}%`
                  : `~${metrics.groundCoverageEstimatedPercent}%`}
              </span>
              <span className="stat-sub">{isDimensionsExplicit ? 'Confirmed' : 'Estimated'}</span>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={14} color="#38bdf8" /> Rooms on this Floor ({floorRooms.length}):
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto' }}>
            {floorRooms.map((r) => (
              <div
                key={r.id}
                className="room-list-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.8125rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: r.color }}></span>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  {r.width} × {r.length} ft ({Math.round(r.width * r.length)} sq ft)
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8125rem', justifyContent: 'center' }}
            onClick={onOpenAddRoom}
          >
            + Add Another Room
          </button>
        </div>

        <div className="panel-section" style={{ borderBottom: 'none' }}>
          <div className="canvas-hint-box">
            <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Canvas Controls:</strong> Click to select a room. Drag to reposition with snapping. Drag the corner handles to resize.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // A room is selected
  const overlaps = allRooms.filter((r) => doRoomsOverlap(selectedRoom, r));
  const isInside = isRoomWithinBounds(selectedRoom, plotWidth, plotLength);
  const bbox = getRoomBoundingBox(selectedRoom);
  const aspectRatio = (selectedRoom.width / selectedRoom.length).toFixed(2);
  const roomArea = Math.round(selectedRoom.width * selectedRoom.length);

  // Calculate rotated bounds valid range for X and Y inside plot
  const sampleBbox = getRoomBoundingBox({
    x: 0,
    y: 0,
    width: selectedRoom.width,
    length: selectedRoom.length,
    rotation: selectedRoom.rotation
  });
  const minValidX = Math.max(0, -sampleBbox.minX);
  const maxValidX = Math.max(0, plotWidth - sampleBbox.maxX);
  const minValidY = Math.max(0, -sampleBbox.minY);
  const maxValidY = Math.max(0, plotLength - sampleBbox.maxY);

  const handleXChange = (valStr) => {
    setInputX(valStr);
    if (!valStr || valStr.trim() === '') {
      setValidationErrors((prev) => ({ ...prev, x: 'Position X cannot be empty' }));
      return;
    }
    const num = Number(valStr);
    if (isNaN(num)) {
      setValidationErrors((prev) => ({ ...prev, x: 'Position X must be a valid number' }));
      return;
    }
    if (num < 0) {
      setValidationErrors((prev) => ({ ...prev, x: 'Position X must be ≥ 0' }));
      return;
    }
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.x;
      return next;
    });

    onUpdateRoom({
      ...selectedRoom,
      x: num,
    });
  };

  const handleYChange = (valStr) => {
    setInputY(valStr);
    if (!valStr || valStr.trim() === '') {
      setValidationErrors((prev) => ({ ...prev, y: 'Position Y cannot be empty' }));
      return;
    }
    const num = Number(valStr);
    if (isNaN(num)) {
      setValidationErrors((prev) => ({ ...prev, y: 'Position Y must be a valid number' }));
      return;
    }
    if (num < 0) {
      setValidationErrors((prev) => ({ ...prev, y: 'Position Y must be ≥ 0' }));
      return;
    }
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.y;
      return next;
    });

    onUpdateRoom({
      ...selectedRoom,
      y: num,
    });
  };

  const handleWidthChange = (valStr) => {
    setInputW(valStr);
    const num = Number(valStr);
    if (isNaN(num) || num < 3) {
      setValidationErrors((prev) => ({ ...prev, width: 'Width must be at least 3 ft' }));
      return;
    }
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.width;
      return next;
    });
    onUpdateRoom({
      ...selectedRoom,
      width: num,
      area: Math.round(num * selectedRoom.length),
    });
  };

  const handleLengthChange = (valStr) => {
    setInputL(valStr);
    const num = Number(valStr);
    if (isNaN(num) || num < 3) {
      setValidationErrors((prev) => ({ ...prev, length: 'Length must be at least 3 ft' }));
      return;
    }
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.length;
      return next;
    });
    onUpdateRoom({
      ...selectedRoom,
      length: num,
      area: Math.round(selectedRoom.width * num),
    });
  };

  const handleNameChange = (valStr) => {
    setInputName(valStr);
    onUpdateRoom({
      ...selectedRoom,
      name: valStr,
    });
  };

  const handleZoneChange = (zoneVal) => {
    onUpdateRoom({
      ...selectedRoom,
      zone: zoneVal,
    });
  };

  const handleRotationChange = (val) => {
    setInputRot(String(val));
    const deg = ((Math.round(Number(val) || 0) % 360) + 360) % 360;
    onUpdateRoom({
      ...selectedRoom,
      rotation: deg,
    });
  };

  const handleRotateStep = (step) => {
    const cur = selectedRoom.rotation || 0;
    const nextDeg = (((cur + step) % 360) + 360) % 360;
    setInputRot(String(nextDeg));
    onUpdateRoom({
      ...selectedRoom,
      rotation: nextDeg,
    });
  };

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '3px',
              backgroundColor: selectedRoom.color || '#38bdf8'
            }}
          ></span>
          <h3 className="panel-title" style={{ fontSize: '1rem' }}>
            {selectedRoom.name}
          </h3>
        </div>
        <button
          type="button"
          className="btn-deselect"
          onClick={onDeselectRoom}
          title="Deselect Room"
        >
          Deselect
        </button>
      </div>

      {/* Validation alert banner for selected room */}
      {(overlaps.length > 0 || !isInside) && (
        <div className="panel-alert alert-error">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Geometry Warning:</strong>
            {!isInside && (
              <div>
                • Exceeds plot boundary ({plotWidth} × {plotLength} ft)
                <div style={{ fontSize: '0.72rem', color: '#fda4af' }}>
                  Current bounds: X {bbox.minX.toFixed(1)}–{bbox.maxX.toFixed(1)} ft, Y {bbox.minY.toFixed(1)}–{bbox.maxY.toFixed(1)} ft
                </div>
              </div>
            )}
            {overlaps.map((o) => (
              <div key={o.id}>• Overlaps with {o.name} on Floor {o.level}</div>
            ))}
          </div>
        </div>
      )}

      {/* Room properties form */}
      <div className="panel-section">
        <div className="form-group">
          <label className="input-label">Room Label</label>
          <input
            type="text"
            className="form-input"
            value={inputName}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginTop: '0.6rem' }}>
          <label className="input-label">Functional Zone</label>
          <select
            className="form-input"
            value={selectedRoom.zone || 'public'}
            onChange={(e) => handleZoneChange(e.target.value)}
          >
            <option value="private">Private (Bedrooms, Pooja)</option>
            <option value="public">Public (Living, Dining)</option>
            <option value="service">Service (Kitchen, Bath, Utility, Parking)</option>
            <option value="circulation">Circulation (Stairs, Foyer, Landing)</option>
            <option value="outdoor">Outdoor (Balcony, Terrace)</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
          <div>
            <label className="input-label">Width (W ft)</label>
            <input
              type="number"
              step="0.5"
              min="3"
              className={`form-input ${validationErrors.width ? 'input-error' : ''}`}
              value={inputW}
              onChange={(e) => handleWidthChange(e.target.value)}
            />
            {validationErrors.width && (
              <div style={{ color: '#f43f5e', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                {validationErrors.width}
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Length (L ft)</label>
            <input
              type="number"
              step="0.5"
              min="3"
              className={`form-input ${validationErrors.length ? 'input-error' : ''}`}
              value={inputL}
              onChange={(e) => handleLengthChange(e.target.value)}
            />
            {validationErrors.length && (
              <div style={{ color: '#f43f5e', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                {validationErrors.length}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
          <div>
            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Position X (ft)</span>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {minValidX.toFixed(1)}–{maxValidX.toFixed(1)} ft
              </span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              className={`form-input ${validationErrors.x ? 'input-error' : (selectedRoom.x < minValidX || selectedRoom.x > maxValidX ? 'input-warning' : '')}`}
              value={inputX}
              onChange={(e) => handleXChange(e.target.value)}
              placeholder="e.g. 5"
            />
            {validationErrors.x && (
              <div style={{ color: '#f43f5e', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                {validationErrors.x}
              </div>
            )}
            {!validationErrors.x && (selectedRoom.x < minValidX || selectedRoom.x > maxValidX) && (
              <div style={{ color: '#f59e0b', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                ⚠️ Outside plot ({minValidX.toFixed(1)}–{maxValidX.toFixed(1)} ft)
              </div>
            )}
          </div>
          <div>
            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Position Y (ft)</span>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {minValidY.toFixed(1)}–{maxValidY.toFixed(1)} ft
              </span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              className={`form-input ${validationErrors.y ? 'input-error' : (selectedRoom.y < minValidY || selectedRoom.y > maxValidY ? 'input-warning' : '')}`}
              value={inputY}
              onChange={(e) => handleYChange(e.target.value)}
              placeholder="e.g. 10"
            />
            {validationErrors.y && (
              <div style={{ color: '#f43f5e', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                {validationErrors.y}
              </div>
            )}
            {!validationErrors.y && (selectedRoom.y < minValidY || selectedRoom.y > maxValidY) && (
              <div style={{ color: '#f59e0b', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                ⚠️ Outside plot ({minValidY.toFixed(1)}–{maxValidY.toFixed(1)} ft)
              </div>
            )}
          </div>
        </div>

        {/* Orientation & Rotation Controls */}
        <div style={{ marginTop: '0.75rem' }}>
          <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Orientation / Rotation</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedRoom.rotation || 0}°</span>
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.25rem' }}>
            <input
              type="number"
              step="15"
              min="0"
              max="359"
              className="form-input"
              style={{ width: '75px', textAlign: 'center' }}
              value={inputRot}
              onChange={(e) => handleRotationChange(e.target.value)}
            />
            <button
              type="button"
              className="toolbar-btn"
              style={{ flex: 1, padding: '0.35rem 0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
              onClick={() => handleRotateStep(90)}
              title="Rotate room 90 degrees clockwise"
            >
              ⟳ +90°
            </button>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className="toolbar-btn"
                  style={{
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.72rem',
                    background: (selectedRoom.rotation || 0) === deg ? '#0284c7' : 'transparent',
                    color: (selectedRoom.rotation || 0) === deg ? '#ffffff' : '#94a3b8'
                  }}
                  onClick={() => handleRotationChange(deg)}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Computed stats */}
      <div className="panel-section">
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.5rem' }}>
          Room Metrics
        </h4>
        <div className="stats-mini-grid">
          <div className="stat-card">
            <span className="stat-label">Calculated Area</span>
            <span className="stat-value">{roomArea} sq ft</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Aspect Ratio</span>
            <span className="stat-value">{aspectRatio} : 1</span>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          <div><strong>Door Openings:</strong> {selectedRoom.doors?.length || 0} (schematic)</div>
          <div><strong>Windows:</strong> {selectedRoom.windows?.length || 0} (schematic)</div>
        </div>
      </div>

      {/* Actions */}
      <div className="panel-section" style={{ borderBottom: 'none' }}>
        <button
          type="button"
          className="btn btn-danger"
          style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => onDeleteRoomClick(selectedRoom)}
        >
          <Trash2 size={15} /> Delete Room
        </button>
      </div>
    </div>
  );
}
