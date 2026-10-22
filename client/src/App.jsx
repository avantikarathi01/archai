import React, { useState, useEffect } from 'react';
import {
  Compass,
  Activity,
  Layers,
  Sparkles,
  Box,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Code2,
  FileCheck,
  Send,
  ShieldCheck,
  Info,
  Home,
  Maximize2,
  Columns,
  GitFork,
  Tag
} from 'lucide-react';
import {
  fetchHealthStatus,
  parseRequirements,
  generateDesign
} from './services/api';
import FloorPlan2D from './components/FloorPlan2D/FloorPlan2D';
import Viewer3D from './components/Viewer3D/Viewer3D';
import VoiceInput from './components/VoiceInput/VoiceInput';
import ArchLangPanel from './components/ArchLang/ArchLangPanel';

const SAMPLE_PRESETS = [
  {
    label: '⭐ Hinglish G+1 with Parking (1200 sq ft)',
    text: 'Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK purab mukhi'
  },
  {
    label: '1 BHK Closed Kitchen (20x30 ft)',
    text: '1 BHK house on a 20x30 ft plot with one bathroom and closed kitchen.'
  },
  {
    label: '3 BHK with Parking (40x60 ft)',
    text: '3 BHK house on a 40x60 ft plot with two bathrooms and parking.'
  },
  {
    label: 'Two-Storey with Balcony (30x40 ft)',
    text: 'A two-storey house with a balcony on a 30x40 plot.'
  },
  {
    label: '2 BHK Compact No Parking (24x40 ft)',
    text: '24x40 ft compact house with two bedrooms, closed kitchen, living room and no parking'
  },
  {
    label: 'Impossible Layout (Error Test)',
    text: '5 BHK luxury villa on 10x15 plot with 3 car parking'
  }
];

// Architectural Modifiers inspired by Tell2Floorplan dataset & HouseTune
const ARCHITECTURAL_TAGS = [
  '+ North-Facing Vastu Entry',
  '+ Open Kitchen with Island',
  '+ Master Suite with Attached Bath',
  '+ G+1 Duplex with Front Balcony',
  '+ Ground Floor Car Porch',
  '+ Dining opens to Garden Patio'
];

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Prompt & Generator State
  const [promptText, setPromptText] = useState(SAMPLE_PRESETS[0].text);
  const [actionLoading, setActionLoading] = useState(false);
  const [designResult, setDesignResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'canvas' | '3d' | 'archlang' | 'rooms' | 'validation' | 'json'

  // Confirmed Dimension Input State
  const [confirmWidth, setConfirmWidth] = useState(30);
  const [confirmLength, setConfirmLength] = useState(40);

  const checkHealth = async () => {
    setHealthLoading(true);
    const result = await fetchHealthStatus();
    setHealthData(result);
    setHealthLoading(false);
  };

  useEffect(() => {
    checkHealth();
    handleGenerateDesign(SAMPLE_PRESETS[0].text);
  }, []);

  const handleVoiceTranscript = (transcriptText) => {
    setPromptText((prev) => {
      const clean = prev ? prev.trim() : '';
      return clean ? `${clean} ${transcriptText}` : transcriptText;
    });
    if (errorMessage) setErrorMessage(null);
  };

  const handleAppendTag = (tag) => {
    const cleanTag = tag.replace(/^\+\s*/, '');
    setPromptText((prev) => {
      const clean = prev ? prev.trim() : '';
      return clean ? `${clean}, ${cleanTag}` : cleanTag;
    });
    if (errorMessage) setErrorMessage(null);
  };

  const handleParseOnly = async () => {
    const textToParse = promptText.trim();
    if (!textToParse) return;
    setActionLoading(true);
    setErrorMessage(null);

    const res = await parseRequirements(textToParse);
    if (res.ok) {
      setDesignResult({
        requirements: res.data.requirements,
        clarifications: res.data.clarifications || res.data.requirements?.clarifications || [],
        warnings: res.data.warnings || res.data.requirements?.warnings || [],
        rawPrompt: res.data.rawPrompt,
        layout: null,
        isParsedOnly: true,
      });
    } else {
      setErrorMessage(res.error || 'Failed to parse requirements.');
      setDesignResult(null);
    }
    setActionLoading(false);
  };

  const handleGenerateDesign = async (customPrompt, explicitDimensions = null) => {
    const textToRun = (typeof customPrompt === 'string' ? customPrompt : promptText).trim();
    if (!textToRun) return;

    setActionLoading(true);
    setErrorMessage(null);

    const payload = { prompt: textToRun };
    if (explicitDimensions && explicitDimensions.width && explicitDimensions.length) {
      payload.plotDimensions = {
        width: Number(explicitDimensions.width),
        length: Number(explicitDimensions.length)
      };
    }

    const res = await generateDesign(payload);
    if (res.ok && res.data?.layout) {
      setDesignResult(res.data);
      setErrorMessage(null);
    } else {
      setErrorMessage(res.error || 'Failed to generate architectural layout. Please review plot dimensions and requirements.');
      setDesignResult(null);
    }
    setActionLoading(false);
  };

  const handleConfirmDimensions = () => {
    if (!confirmWidth || !confirmLength) return;
    handleGenerateDesign(promptText, { width: confirmWidth, length: confirmLength });
  };

  const isServerOnline = healthData && healthData.ok;
  const layout = designResult?.layout;
  const reqs = designResult?.requirements;
  const isProvisional = layout?.isProvisional || (reqs?.plot && !reqs.plot.isDimensionsExplicit);
  const clarifications = designResult?.clarifications || designResult?.requirements?.clarifications || layout?.clarifications || [];
  const warnings = designResult?.warnings || designResult?.requirements?.warnings || layout?.warnings || [];
  const practicalityAlerts = layout?.validation?.practicalityAlerts || [];

  return (
    <div className="app-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Polished CAD Studio Header */}
      <header className="header" style={{ paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
        <div className="brand-wrapper">
          <div className="brand-logo" style={{ width: '42px', height: '42px' }}>
            <Compass size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 className="brand-title" style={{ fontSize: '1.5rem', margin: 0 }}>ArchAI</h1>
              <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                CAD Studio
              </span>
            </div>
            <p className="brand-subtitle" style={{ fontSize: '0.8rem', marginTop: '0.1rem' }}>
              AI Architectural Design & Real-Time 3D Visualization Studio (Home_View & ArchLang Architecture)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={`badge ${isServerOnline ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.75rem' }}>
            <span className={`status-dot ${isServerOnline ? 'online' : 'offline'}`}></span>
            {isServerOnline ? 'Spatial CAD Engine Online' : 'Server Offline'}
          </span>
          {healthData?.latencyMs !== undefined && (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {healthData.latencyMs}ms
            </span>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>

        {/* Natural Language Prompt Composer */}
        <div className="card full-width" style={{ padding: '1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="#38bdf8" />
              <h2 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                Natural Language Design Brief (Tell2Floorplan & HouseTune Engine)
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {isProvisional ? (
                <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                  <AlertTriangle size={13} /> Provisional Preview
                </span>
              ) : layout ? (
                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                  <CheckCircle2 size={13} /> Confirmed Validated
                </span>
              ) : null}
            </div>
          </div>

          <p className="card-description" style={{ fontSize: '0.825rem', marginBottom: '0.85rem' }}>
            Describe your plot dimensions, floors, bedrooms, kitchen style, and parking in English or Hinglish. ArchAI synthesizes the architectural graph, generates CAD double-line blueprints, and synchronizes 3D models live.
          </p>

          {/* Prompt Composer & Textarea */}
          <div className="prompt-composer-wrapper">
            <textarea
              className="prompt-textarea"
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. Mujhe 1200 sq ft me 2 floor ka makan chahiye ground floor pe gaadi parking aur 1st floor pe 2 BHK purab mukhi"
              rows={3}
              spellCheck={false}
              style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
            />

            {/* Quick Example Templates */}
            <div className="presets-container" style={{ margin: '0.2rem 0 0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center', marginRight: '0.25rem' }}>
                Quick examples:
              </span>
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-preset"
                  onClick={() => {
                    setPromptText(preset.text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  title="Populate input with this example template"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Architectural Modifiers (Tell2Floorplan style) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
                <Tag size={12} color="#38bdf8" /> Architectural tags:
              </span>
              {ARCHITECTURAL_TAGS.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-preset"
                  style={{ background: 'rgba(56, 189, 248, 0.06)', borderColor: 'rgba(56, 189, 248, 0.25)', color: '#7dd3fc', fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => handleAppendTag(tag)}
                  title="Append this architectural requirement to your brief"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Actions Bar: Voice Input + Generate Button + Parse Only */}
            <div className="prompt-actions-bar">
              {/* Voice Input Integration */}
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                disabled={actionLoading}
              />

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleParseOnly}
                  disabled={actionLoading || !promptText.trim()}
                  style={{ padding: '0.55rem 0.95rem', fontSize: '0.8125rem' }}
                >
                  <FileCheck size={15} />
                  Parse Requirements Only
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => handleGenerateDesign()}
                  disabled={actionLoading || !promptText.trim()}
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  <Send size={15} />
                  {actionLoading ? 'Generating Architecture...' : 'Generate 2D/3D Floor Plan'}
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="alert-box alert-error" style={{ marginTop: '1rem' }}>
              <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Generation Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Parse Only Success Banner */}
          {designResult?.isParsedOnly && (
            <div className="alert-box alert-success" style={{ marginTop: '1rem' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Requirements Parsed Successfully:</strong> Review extracted constraints and floor-by-floor breakdown below. Click <strong>Generate 2D/3D Floor Plan</strong> to produce the layout.
              </div>
            </div>
          )}

          {/* Provisional Preview & Confirmation Form Banner */}
          {isProvisional && (
            <div className="alert-box alert-warning" style={{ marginTop: '1rem', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <AlertTriangle size={18} />
                <strong>Provisional Preview (Estimated Plot Dimensions):</strong>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#fbbf24', margin: 0 }}>
                Plot area was estimated ({reqs?.plot?.totalAreaSqFt || 1200} sq ft) without explicit width and length. Enter your confirmed plot dimensions to finalize:
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.8125rem', color: '#f8fafc' }}>
                  Width (ft):
                  <input
                    type="number"
                    value={confirmWidth}
                    onChange={(e) => setConfirmWidth(e.target.value)}
                    style={{
                      width: '70px',
                      marginLeft: '0.4rem',
                      padding: '0.3rem 0.5rem',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      color: '#ffffff',
                    }}
                  />
                </label>
                <label style={{ fontSize: '0.8125rem', color: '#f8fafc' }}>
                  Length (ft):
                  <input
                    type="number"
                    value={confirmLength}
                    onChange={(e) => setConfirmLength(e.target.value)}
                    style={{
                      width: '70px',
                      marginLeft: '0.4rem',
                      padding: '0.3rem 0.5rem',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      color: '#ffffff',
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
                  onClick={handleConfirmDimensions}
                  disabled={actionLoading}
                >
                  <ShieldCheck size={14} />
                  Confirm Dimensions & Re-validate
                </button>
              </div>
            </div>
          )}

          {/* Practicality Alerts Banner */}
          {practicalityAlerts.length > 0 && (
            <div className="alert-box alert-warning" style={{ marginTop: '0.75rem' }}>
              <Info size={18} />
              <div>
                <strong>Design Advice:</strong>
                <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem', fontSize: '0.8rem' }}>
                  {practicalityAlerts.map((alert, i) => (
                    <li key={i}>{alert}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Compact Interpreted Requirements Summary Bar */}
          {reqs && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Interpreted Constraints & Preferences
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Derived from natural language prompt
                </span>
              </div>
              <div className="req-grid" style={{ margin: '0.5rem 0' }}>
                <div className="req-pill">
                  <span className="req-label">Plot Footprint</span>
                  <span className="req-val">
                    {reqs.plot?.isDimensionsExplicit
                      ? `${reqs.plot.width} × ${reqs.plot.length} ft`
                      : (reqs.plot?.width ? `${reqs.plot.width} × ${reqs.plot.length} ft` : 'Unspecified')}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Total Plot Area</span>
                  <span className="req-val">
                    {reqs.plot?.totalAreaSqFt ? `${reqs.plot.totalAreaSqFt} sq ft` : 'Unspecified'}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Floors (Levels)</span>
                  <span className="req-val">
                    {reqs.floors === 1 ? '1 Floor (Ground)' : `${reqs.floors} Floors (G+${reqs.floors - 1})`}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Bedrooms</span>
                  <span className="req-val">{reqs.bedrooms} BHK</span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Orientation</span>
                  <span className="req-val" style={{ textTransform: 'capitalize' }}>
                    {reqs.facingSpecified ? reqs.facing : 'East (Standard)'}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Kitchen</span>
                  <span className="req-val" style={{ textTransform: 'capitalize' }}>
                    {reqs.kitchen?.specified ? `${reqs.kitchen.type} Kitchen` : 'Standard Kitchen'}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Parking</span>
                  <span className="req-val">
                    {reqs.parking?.required ? `${reqs.parking.capacity || 1} Car Space` : 'No Parking'}
                  </span>
                </div>
                <div className="req-pill">
                  <span className="req-label">Balcony</span>
                  <span className="req-val">
                    {reqs.balcony?.required ? 'Requested' : 'Standard'}
                  </span>
                </div>
              </div>

              {/* Floor Program Breakdown */}
              {reqs.floorRequirements && Object.keys(reqs.floorRequirements).length > 0 && (
                <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
                  {Object.values(reqs.floorRequirements).map(fr => (
                    <div key={fr.level} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '0.825rem' }}>{fr.name}</strong>
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                          Level {fr.level}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.45' }}>
                        <div>• <strong>Bedrooms:</strong> {fr.bedrooms > 0 ? `${fr.bedrooms} BHK` : 'None requested'}</div>
                        <div>• <strong>Parking:</strong> {fr.parking ? 'Yes (Car parking on this floor)' : 'None'}</div>
                        <div>• <strong>Spaces:</strong> {[fr.livingRoom && 'Living Room', fr.kitchen && 'Kitchen', fr.bathrooms > 0 && `${fr.bathrooms} Bath`, fr.balcony && 'Balcony', fr.poojaRoom && 'Pooja'].filter(Boolean).join(', ') || 'Circulation & Staircase'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Assumptions & Clarifications */}
              {clarifications.length > 0 && (
                <div className="alert-box alert-warning" style={{ marginTop: '0.75rem', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <HelpCircle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <strong style={{ color: '#fbbf24', fontSize: '0.8125rem' }}>Assumptions & Defaults Applied:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.78rem', color: '#fde68a' }}>
                    {clarifications.map((c, i) => (
                      <li key={i}>
                        <strong>{c.field}:</strong> {c.question} {c.defaultAssumed ? <em>(Assumed: {c.defaultAssumed})</em> : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parser Warnings */}
              {warnings.length > 0 && (
                <div className="alert-box alert-error" style={{ marginTop: '0.5rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '0.8125rem' }}>Parser Warnings:</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.78rem' }}>
                      {warnings.map((w, i) => (
                        <li key={i}>{typeof w === 'string' ? w : w.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coordinated Architectural Workspace (Home_View & openPlan3D Dual View) */}
        {layout && (
          <div className="card full-width" style={{ padding: '1.25rem' }}>
            {/* Workspace Header & Tab Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Home size={18} color="#38bdf8" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    {layout.metadata?.title}
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                  Room Area: <strong>{layout.summary?.roomAreaSumSqFt} sq ft</strong> | Built-up: <strong>{layout.summary?.totalBuiltUpAreaSqFt} sq ft</strong> | Carpet: ~{layout.summary?.totalCarpetAreaSqFt} sq ft | Ground Coverage:{' '}
                  {layout.summary?.groundCoveragePercent !== null
                    ? `${layout.summary?.groundCoveragePercent}%`
                    : `~${layout.summary?.groundCoverageEstimatedPercent}%`}
                </p>
              </div>

              {/* View switcher tabs */}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  className={`btn ${activeTab === 'split' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: activeTab === 'split' ? 700 : 500 }}
                  onClick={() => setActiveTab('split')}
                  title="Dual Synchronized View: 2D Blueprint + 3D View side-by-side (inspired by lohith9/Home_View)"
                >
                  <Columns size={14} /> Dual Studio (2D + 3D)
                </button>
                <button
                  className={`btn ${activeTab === 'canvas' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => setActiveTab('canvas')}
                  title="Dedicated Full-Width 2D Architectural Blueprint Editor"
                >
                  <Layers size={14} /> 2D Blueprint CAD
                </button>
                <button
                  className={`btn ${activeTab === '3d' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => setActiveTab('3d')}
                  title="Dedicated Full-Width 3D Architectural Viewer & Walkthrough"
                >
                  <Box size={14} /> 3D House Viewer
                </button>
                <button
                  className={`btn ${activeTab === 'archlang' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => setActiveTab('archlang')}
                  title="AI Spatial Adjacency Graph, Circulation Network & ArchLang DSL Compiler"
                >
                  <GitFork size={14} color="#38bdf8" /> AI Spatial Graph & ArchLang
                </button>
                <button
                  className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                  onClick={() => setActiveTab('rooms')}
                >
                  Room Schedule ({layout.rooms?.length})
                </button>
                <button
                  className={`btn ${activeTab === 'validation' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                  onClick={() => setActiveTab('validation')}
                >
                  Geometry & Norms
                </button>
                <button
                  className={`btn ${activeTab === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                  onClick={() => setActiveTab('json')}
                >
                  <Code2 size={14} /> Schema JSON
                </button>
              </div>
            </div>

            {/* Tab 0: Dual Studio Split-Screen Mode (Home_View & openPlan3D) */}
            {activeTab === 'split' && (
              <div className="dual-studio-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(560px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.85rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', padding: '0 0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Layers size={14} /> 2D Architectural CAD Blueprint
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Drag, rotate, and resize rooms</span>
                  </div>
                  <FloorPlan2D
                    layout={layout}
                    requirements={reqs}
                    onLayoutUpdated={(updatedLayout) => {
                      setDesignResult((prev) => ({
                        ...prev,
                        layout: updatedLayout,
                      }));
                    }}
                  />
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.85rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', padding: '0 0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Box size={14} /> 3D Real-Time Synchronized Scene
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span className="status-dot online" style={{ width: '6px', height: '6px' }}></span> Live Synchronized
                    </span>
                  </div>
                  <Viewer3D
                    layout={layout}
                    requirements={reqs}
                  />
                </div>
              </div>
            )}

            {/* Tab 1: Full-Width 2D Floor Plan Canvas */}
            {activeTab === 'canvas' && (
              <FloorPlan2D
                layout={layout}
                requirements={reqs}
                onLayoutUpdated={(updatedLayout) => {
                  setDesignResult((prev) => ({
                    ...prev,
                    layout: updatedLayout,
                  }));
                }}
              />
            )}

            {/* Tab 2: Full-Width Three.js 3D House Viewer */}
            {activeTab === '3d' && (
              <Viewer3D
                layout={layout}
                requirements={reqs}
              />
            )}

            {/* Tab 3: AI Spatial Reasoning & ArchLang DSL Compiler */}
            {activeTab === 'archlang' && (
              <ArchLangPanel
                layout={layout}
                requirements={reqs}
              />
            )}

            {/* Tab 4: Room Schedule Table */}
            {activeTab === 'rooms' && (
              <div className="rooms-table-wrapper" style={{ marginTop: '1rem' }}>
                <table className="rooms-table">
                  <thead>
                    <tr>
                      <th>Room Name</th>
                      <th>Level</th>
                      <th>Position (X, Y)</th>
                      <th>Dimensions (W × L)</th>
                      <th>Area</th>
                      <th>Zone</th>
                      <th>Openings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layout.rooms?.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="room-color-tag" style={{ backgroundColor: r.color }}></span>
                          <strong>{r.name}</strong>
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                            {r.level === 0 ? 'Ground Floor' : `Floor ${r.level}`}
                          </span>
                        </td>
                        <td>({r.x.toFixed(1)}, {r.y.toFixed(1)}) ft</td>
                        <td>{r.width.toFixed(1)} × {r.length.toFixed(1)} ft</td>
                        <td><strong>{r.area} sq ft</strong></td>
                        <td>
                          <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: '#94a3b8' }}>
                            {r.zone}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {r.doors?.length || 0} doors, {r.windows?.length || 0} windows
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 5: Geometry Verification & Norms */}
            {activeTab === 'validation' && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className={`alert-box ${layout.validation?.status === 'confirmed_valid' ? 'alert-info' : 'alert-warning'}`}>
                  {layout.validation?.status === 'confirmed_valid' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <div>
                    <strong>Validation Status: {layout.validation?.status?.toUpperCase()}</strong>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem' }}>
                      {layout.validation?.status === 'confirmed_valid'
                        ? 'Zero room overlaps detected. All rooms remain strictly within confirmed plot boundaries with verified staircase continuity.'
                        : 'Layout is provisional because plot dimensions were estimated from total area. Confirm exact width and length for confirmed status.'}
                    </p>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={15} /> Automated Geometry Verification (Engine Verified):
                  </h4>
                  <ul style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.4rem', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                    <li>Per-floor boundary containment (every room is strictly inside plot footprint)</li>
                    <li>Zero room overlaps (AABB 2D collision detection verified for each floor)</li>
                    <li>Positive coordinate geometry & unique room identifiers</li>
                    <li>Vertical staircase alignment (Level 0 and Level 1 access check)</li>
                    <li>Room aspect ratio and practicality verification (no narrow hallway rooms)</li>
                  </ul>
                </div>

                <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '10px', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={15} /> Statutory & Engineering Disclaimers:
                  </h4>
                  <ul style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.4rem', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                    <li>Structural load-bearing calculations & column grid placement require licensed civil engineer review</li>
                    <li>Municipal statutory building bye-laws approval & setback permissions must be verified locally</li>
                    <li>Soil bearing capacity, seismic engineering & plumbing wet-wall stack certification</li>
                  </ul>
                </div>

                {/* Architectural Insights */}
                {layout.recommendations?.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Architectural & Vastu Insights:
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                      {layout.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                              {rec.category}
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                              Insight
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0.2rem 0' }}>
                            {rec.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                            {rec.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 6: JSON Schema Inspector */}
            {activeTab === 'json' && (
              <pre className="code-block" style={{ maxHeight: '350px' }}>
                {JSON.stringify(layout, null, 2)}
              </pre>
            )}

            {/* Disclaimer Bar */}
            <div className="alert-disclaimer" style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
              {layout.disclaimer || designResult?.disclaimer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
