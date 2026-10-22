import React, { useState } from 'react';
import { Plus, X, Box } from 'lucide-react';
import { ROOM_TYPE_DEFAULTS, generateUniqueRoomId } from '../../utils/canvasMath';

export default function AddRoomModal({
  isOpen,
  floors = [0],
  activeFloor = 0,
  plotWidth = 30,
  plotLength = 40,
  existingRooms = [],
  onAddRoom,
  onClose
}) {
  if (!isOpen) return null;

  const [type, setType] = useState('bedroom');
  const [name, setName] = useState('Bedroom');
  const [level, setLevel] = useState(activeFloor);
  const [width, setWidth] = useState(12);
  const [length, setLength] = useState(10);

  const handleTypeChange = (e) => {
    const selectedType = e.target.value;
    setType(selectedType);
    const preset = ROOM_TYPE_DEFAULTS[selectedType] || { name: 'Room' };
    setName(preset.name);
    // Sensible standard defaults for room dimensions
    if (selectedType === 'bathroom') {
      setWidth(7);
      setLength(5);
    } else if (selectedType === 'kitchen') {
      setWidth(10);
      setLength(8);
    } else if (selectedType === 'living') {
      setWidth(16);
      setLength(12);
    } else if (selectedType === 'balcony') {
      setWidth(10);
      setLength(4);
    } else if (selectedType === 'pooja') {
      setWidth(6);
      setLength(5);
    } else {
      setWidth(12);
      setLength(10);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const w = Math.max(3, Number(width) || 10);
    const l = Math.max(3, Number(length) || 10);
    const roomTypeInfo = ROOM_TYPE_DEFAULTS[type] || {
      name: name || 'Custom Room',
      zone: 'public',
      color: '#38bdf8'
    };

    // Find a non-overlapping or open (x, y) on this floor
    const floorRooms = existingRooms.filter(r => r.level === Number(level));
    let placeX = 0;
    let placeY = 0;
    let found = false;

    // Scan in 2ft steps
    for (let y = 0; y <= plotLength - l; y += 2) {
      for (let x = 0; x <= plotWidth - w; x += 2) {
        const testRoom = { x, y, width: w, length: l, level: Number(level), id: 'test' };
        const hasCollision = floorRooms.some(r => {
          return !(
            testRoom.x + testRoom.width <= r.x ||
            r.x + r.width <= testRoom.x ||
            testRoom.y + testRoom.length <= r.y ||
            r.y + r.length <= testRoom.y
          );
        });

        if (!hasCollision) {
          placeX = x;
          placeY = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    const newRoom = {
      id: generateUniqueRoomId(type, existingRooms),
      name: name.trim() || roomTypeInfo.name,
      type,
      level: Number(level),
      x: placeX,
      y: placeY,
      width: w,
      length: l,
      area: Math.round(w * l),
      zone: roomTypeInfo.zone,
      color: roomTypeInfo.color,
      doors: [{ id: `d_${Date.now()}`, wall: 'south', width: 3, type: 'standard' }],
      windows: [{ id: `w_${Date.now()}`, wall: 'north', width: 4, type: 'standard' }]
    };

    onAddRoom(newRoom);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Box size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New Room</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Room Type</label>
            <select className="form-input" value={type} onChange={handleTypeChange}>
              <option value="bedroom">Bedroom</option>
              <option value="master_bedroom">Master Bedroom</option>
              <option value="living">Living Hall</option>
              <option value="kitchen">Kitchen</option>
              <option value="bathroom">Bathroom</option>
              <option value="dining">Dining Area</option>
              <option value="balcony">Balcony</option>
              <option value="parking">Car Parking</option>
              <option value="pooja">Pooja Room</option>
              <option value="staircase">Staircase / Foyer</option>
              <option value="utility">Utility / Wash</option>
            </select>
          </div>

          <div>
            <label className="input-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Guest Bedroom"
              required
            />
          </div>

          <div>
            <label className="input-label">Target Floor Level</label>
            <select
              className="form-input"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {floors.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl === 0 ? 'Ground Floor (Level 0)' : `Floor ${lvl} (Level ${lvl})`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label">Width (ft)</label>
              <input
                type="number"
                step="0.5"
                min="3"
                max={plotWidth}
                className="form-input"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="input-label">Length (ft)</label>
              <input
                type="number"
                step="0.5"
                min="3"
                max={plotLength}
                className="form-input"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
            Total Room Area: <strong style={{ color: '#38bdf8' }}>{Math.round(width * length)} sq ft</strong>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Place Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
