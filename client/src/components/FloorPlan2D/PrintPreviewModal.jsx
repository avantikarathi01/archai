import React from 'react';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

export default function PrintPreviewModal({
  isOpen,
  onClose,
  rooms = [],
  plot = { width: 30, length: 40, totalAreaSqFt: 1200 },
  facing = 'East',
  activeFloor = 0,
  metrics = {},
  isProvisional = false
}) {
  if (!isOpen) return null;

  const floorRooms = rooms.filter(r => r.level === activeFloor);

  const handlePrint = () => {
    window.print();
  };

  const scale = 14; // pixels per foot for print sheet
  const svgW = plot.width * scale;
  const svgH = plot.length * scale;

  return (
    <div className="modal-backdrop print-modal-backdrop">
      <div className="modal-content print-modal-content">
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Printable Architectural Schedule</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
            >
              <Printer size={16} /> Print / Save PDF
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="printable-sheet" id="printable-plan">
          <div className="print-header">
            <div>
              <h1 className="print-brand-title">ArchAI Design Platform</h1>
              <div className="print-brand-subtitle">Architectural Floor Plan & Room Schedule</div>
            </div>
            <div className="print-meta-box">
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Level:</strong> {activeFloor === 0 ? 'Ground Floor (Level 0)' : `Floor ${activeFloor} (Level ${activeFloor})`}</div>
              <div><strong>Orientation:</strong> {facing} Facing</div>
              <div><strong>Status:</strong> {isProvisional ? 'Provisional Layout (Estimated Plot)' : 'Confirmed Plot Dimensions'}</div>
            </div>
          </div>

          {/* Mini 2D SVG vector diagram for print */}
          <div className="print-canvas-wrapper" style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
            <svg
              width={svgW + 40}
              height={svgH + 40}
              viewBox={`-20 -20 ${svgW + 40} ${svgH + 40}`}
              className="print-svg"
            >
              {/* Outer plot boundary */}
              <rect
                x="0"
                y="0"
                width={svgW}
                height={svgH}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="2.5"
              />

              {/* Dimension markers */}
              <text x={svgW / 2} y="-6" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">
                Plot Width: {plot.width} ft
              </text>
              <text
                x="-8"
                y={svgH / 2}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#000000"
                transform={`rotate(-90 -8 ${svgH / 2})`}
              >
                Plot Length: {plot.length} ft
              </text>

              {/* Rooms */}
              {floorRooms.map((r) => {
                const rx = r.x * scale;
                const ry = r.y * scale;
                const rw = r.width * scale;
                const rl = r.length * scale;
                const isStairs = r.type === 'staircase' || r.type === 'foyer' || r.name.toLowerCase().includes('stairs');

                return (
                  <g key={r.id}>
                    <rect
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rl}
                      fill="#f8fafc"
                      stroke="#000000"
                      strokeWidth="1.8"
                    />
                    {/* If staircase, draw simple treads */}
                    {isStairs && (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <line
                          key={idx}
                          x1={rx}
                          y1={ry + (rl / 7) * (idx + 1)}
                          x2={rx + rw}
                          y2={ry + (rl / 7) * (idx + 1)}
                          stroke="#64748b"
                          strokeWidth="0.8"
                        />
                      ))
                    )}
                    <text
                      x={rx + rw / 2}
                      y={ry + rl / 2 - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#000000"
                    >
                      {r.name}
                    </text>
                    <text
                      x={rx + rw / 2}
                      y={ry + rl / 2 + 10}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#475569"
                    >
                      {r.width} × {r.length} ft ({Math.round(r.width * r.length)} sq ft)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Room Schedule Table */}
          <div className="print-schedule-section">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
              Room Schedule — Level {activeFloor}
            </h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Room Designation</th>
                  <th>Functional Zone</th>
                  <th>Width (ft)</th>
                  <th>Length (ft)</th>
                  <th>Carpet Area (sq ft)</th>
                  <th>Openings</th>
                </tr>
              </thead>
              <tbody>
                {floorRooms.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td><strong>{r.name}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{r.zone}</td>
                    <td>{r.width} ft</td>
                    <td>{r.length} ft</td>
                    <td><strong>{Math.round(r.width * r.length)} sq ft</strong></td>
                    <td>{r.doors?.length || 0} D, {r.windows?.length || 0} W</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Area Metric Summary */}
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div className="print-stat-box">
              <div className="stat-sub">Plot Size</div>
              <div className="stat-value">{plot.width} × {plot.length} ft</div>
              <div className="stat-sub">{plot.totalAreaSqFt || (plot.width * plot.length)} sq ft</div>
            </div>
            <div className="print-stat-box">
              <div className="stat-sub">Room Area Sum</div>
              <div className="stat-value">{metrics.roomAreaSumSqFt || 0} sq ft</div>
              <div className="stat-sub">All Levels</div>
            </div>
            <div className="print-stat-box">
              <div className="stat-sub">Est. Built-up Area</div>
              <div className="stat-value">{metrics.totalBuiltUpAreaSqFt || 0} sq ft</div>
              <div className="stat-sub">+15% Wall allowance</div>
            </div>
            <div className="print-stat-box">
              <div className="stat-sub">Ground Coverage</div>
              <div className="stat-value">
                {metrics.groundCoveragePercent !== null ? `${metrics.groundCoveragePercent}%` : `~${metrics.groundCoverageEstimatedPercent}%`}
              </div>
              <div className="stat-sub">{isProvisional ? 'Estimated' : 'Confirmed'}</div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="print-disclaimer">
            <strong>Statutory Architectural Notice:</strong> This preliminary layout is generated by ArchAI for conceptual design assistance. It does not replace professional structural drawings or municipal building sanction. All room sizes, setbacks, ventilation, and structural load distributions must be approved by a certified architect or civil engineer.
          </div>
        </div>
      </div>
    </div>
  );
}
