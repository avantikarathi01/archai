import React, { useState } from 'react';
import {
  Code2,
  GitFork,
  Compass,
  Copy,
  Check,
  Download,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import {
  compileToArchLang,
  buildSpatialAdjacencyGraph,
  evaluateVastuOrientation
} from '../../utils/archLangCompiler';

export default function ArchLangPanel({
  layout,
  requirements
}) {
  const [activeSubTab, setActiveSubTab] = useState('dsl'); // 'dsl' | 'graph' | 'vastu'
  const [copied, setCopied] = useState(false);

  if (!layout) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <p>No floor plan available to compile. Generate a layout from the prompt above to inspect ArchLang specifications.</p>
      </div>
    );
  }

  const dslCode = compileToArchLang(layout, requirements);
  const { nodes, edges } = buildSpatialAdjacencyGraph(layout.rooms || []);
  const vastuEvals = evaluateVastuOrientation(
    layout.rooms || [],
    layout.plot?.width || 30,
    layout.plot?.length || 40,
    layout.facing || requirements?.facing || 'East'
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(dslCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Failed to copy ArchLang code:', err);
    }
  };

  const handleDownloadArchFile = () => {
    const blob = new Blob([dslCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${layout.metadata?.title?.toLowerCase().replace(/\s+/g, '_') || 'design'}.arch`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="archlang-panel" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Overview Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} color="#38bdf8" />
          <div>
            <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
              AI Spatial Reasoning & ArchLang Compiler
            </strong>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              Two-stage architecture synthesis (HouseTune & ArchLang standard DSL compilation)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className={`btn ${activeSubTab === 'dsl' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActiveSubTab('dsl')}
          >
            <Code2 size={13} /> ArchLang DSL
          </button>
          <button
            type="button"
            className={`btn ${activeSubTab === 'graph' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActiveSubTab('graph')}
          >
            <GitFork size={13} /> Adjacency Graph ({edges.length} Links)
          </button>
          <button
            type="button"
            className={`btn ${activeSubTab === 'vastu' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActiveSubTab('vastu')}
          >
            <Compass size={13} /> Vastu & Sun Azimuth
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: ArchLang DSL Code Viewer */}
      {activeSubTab === 'dsl' && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Specification Format: ArchLang v1.4 (Declarative Floor Plan Schema)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={handleCopyCode}
                title="Copy ArchLang DSL code to clipboard"
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={handleDownloadArchFile}
                title="Download .arch specification file"
              >
                <Download size={13} />
                Download .arch
              </button>
            </div>
          </div>

          <pre
            className="code-block"
            style={{
              maxHeight: '440px',
              margin: 0,
              fontSize: '0.825rem',
              lineHeight: '1.6',
              padding: '1.25rem',
              borderRadius: '10px'
            }}
          >
            <code>{dslCode}</code>
          </pre>
        </div>
      )}

      {/* Sub-Tab 2: Spatial Adjacency Graph */}
      {activeSubTab === 'graph' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Spatial Adjacency & Circulation Network
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Verified topological connections, shared wall boundaries, and cross-floor vertical circulation.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }}></span> Social / Living
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span> Semi-Private / Dining
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span> Private Suite
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e' }}></span> Staircase Access
              </span>
            </div>
          </div>

          {/* Interactive SVG Network Graph */}
          <div style={{ width: '100%', height: '320px', background: '#070b13', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 700 320">
              <defs>
                <marker id="arrow-graph" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Render edges */}
              {edges.map((e, idx) => {
                const sIdx = nodes.findIndex(n => n.id === e.source);
                const tIdx = nodes.findIndex(n => n.id === e.target);
                if (sIdx === -1 || tIdx === -1) return null;

                const colWidth = 600 / Math.max(1, nodes.length);
                const x1 = 50 + sIdx * colWidth;
                const y1 = nodes[sIdx].level === 0 ? 110 : 230;
                const x2 = 50 + tIdx * colWidth;
                const y2 = nodes[tIdx].level === 0 ? 110 : 230;

                const isVertical = e.type === 'vertical';

                return (
                  <g key={idx}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isVertical ? '#f43f5e' : '#334155'}
                      strokeWidth={isVertical ? '2' : '1.2'}
                      strokeDasharray={isVertical ? '4 3' : 'none'}
                    />
                  </g>
                );
              })}

              {/* Render Nodes */}
              {nodes.map((n, idx) => {
                const colWidth = 600 / Math.max(1, nodes.length);
                const cx = 50 + idx * colWidth;
                const cy = n.level === 0 ? 110 : 230;
                const isStairs = n.type === 'staircase' || n.name.toLowerCase().includes('stairs');

                return (
                  <g key={n.id} transform={`translate(${cx}, ${cy})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r="20"
                      fill="#121826"
                      stroke={isStairs ? '#f43f5e' : n.color || '#38bdf8'}
                      strokeWidth="2.5"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      L{n.level}
                    </text>
                    <text
                      x="0"
                      y="34"
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {n.name.length > 15 ? n.name.slice(0, 13) + '..' : n.name}
                    </text>
                    <text
                      x="0"
                      y="46"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="8"
                    >
                      {n.area} sqft
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Vastu & Solar Alignment Analysis */}
      {activeSubTab === 'vastu' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.4rem', color: '#f8fafc' }}>
            Vastu Shastra & Solar Orientation Heuristics
          </h4>
          <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#94a3b8' }}>
            Evaluates room placement against traditional daylighting, prevailing breeze directions, and Indian architectural tenets.
          </p>

          <table className="rooms-table" style={{ fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th>Room Space</th>
                <th>Assigned Quadrant</th>
                <th>Compliance Status</th>
                <th>Architectural & Environmental Rationale</th>
              </tr>
            </thead>
            <tbody>
              {vastuEvals.map((v, idx) => (
                <tr key={idx}>
                  <td><strong>{v.roomName}</strong></td>
                  <td>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{v.quadrant}</span>
                  </td>
                  <td>
                    <span className={`badge ${v.status === 'optimal' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                      <CheckCircle2 size={12} /> {v.status === 'optimal' ? 'Optimal Alignment' : 'Compliant'}
                    </span>
                  </td>
                  <td style={{ color: '#cbd5e1' }}>{v.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
