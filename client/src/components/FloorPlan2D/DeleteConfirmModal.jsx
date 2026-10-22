import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  room,
  onConfirm,
  onCancel
}) {
  if (!isOpen || !room) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f43f5e' }}>
            <AlertTriangle size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Delete Room</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div style={{ margin: '1rem 0' }}>
          <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
            Are you sure you want to remove <strong>{room.name}</strong> from Level {room.level}?
          </p>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginTop: '0.75rem',
            fontSize: '0.8125rem',
            color: '#94a3b8'
          }}>
            <div>Dimensions: {room.width} × {room.length} ft ({Math.round(room.width * room.length)} sq ft)</div>
            <div>Zone: {room.zone}</div>
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#e11d48' }}
          >
            <Trash2 size={15} /> Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}
