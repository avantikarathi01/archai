import React, { useState, useEffect, useRef } from 'react';
import Toolbar3D from './Toolbar3D';
import Canvas3D from './Canvas3D';
import {
  Box,
  Layers,
  Compass,
  AlertTriangle,
  Sliders,
  Info,
  Armchair,
  Footprints,
  Sun,
  Palette,
  Sparkles,
  Gamepad2,
  Building,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  generateWalkthroughWaypoints,
  LIGHTING_PRESETS,
  MATERIAL_STYLES,
  QUALITY_PRESETS,
  getFloorElevation
} from '../../utils/threeMath';
import { getDesignConcept } from '../../utils/designConcepts';

export default function Viewer3D({
  layout = null,
  requirements = null
}) {
  if (!layout || !layout.rooms || layout.rooms.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
        <Box size={32} color="#38bdf8" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
          No 3D Model Available
        </h3>
        <p style={{ fontSize: '0.875rem' }}>
          Generate a design using the prompt interface above to inspect the architectural model in 3D.
        </p>
      </div>
    );
  }

  const plot = layout.plot || {
    width: 30,
    length: 40,
    totalAreaSqFt: 1200,
    isDimensionsExplicit: false
  };

  const isProvisional = layout.isProvisional || !plot.isDimensionsExplicit;
  const facing = layout.facing || requirements?.facing || 'East';
  const rooms = layout.rooms || [];
  const floors = Array.from(new Set(rooms.map(r => r.level || 0))).sort((a, b) => a - b);

  // --- Viewer Controls State ---
  const [floorMode, setFloorMode] = useState('all'); // 'all' | 'ground' | 'first' | 'cutaway' | 'exploded' | 'topdown' | 'exterior'
  const [explodedGap, setExplodedGap] = useState(8);
  const [cameraPreset, setCameraPreset] = useState('iso'); // 'iso' | 'top' | 'front' | 'frame' | 'exterior'
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState(0);
  const [wallHeightMode, setWallHeightMode] = useState('cutaway'); // 'cutaway' | 'full'
  const [showFurniture, setShowFurniture] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // Atmosphere Presets & Quality
  const [lightingPreset, setLightingPreset] = useState('warm_daylight');
  const [materialStyle, setMaterialStyle] = useState('modern_scandi');
  const [qualityPreset, setQualityPreset] = useState('balanced');

  // --- Phase 6 Simulator & Architectural Concept State ---
  const [designConcept, setDesignConcept] = useState('contemporary_minimalist');
  const [isSimulator, setIsSimulator] = useState(false);
  const [simulatorFloor, setSimulatorFloor] = useState(0);
  const [teleportTargetRoom, setTeleportTargetRoom] = useState(null);
  const [activeInteraction, setActiveInteraction] = useState(null);
  const [inspectedFurniture, setInspectedFurniture] = useState(null);
  const [lightsOn, setLightsOn] = useState(true);
  const [virtualMovement, setVirtualMovement] = useState({});

  // Interactive selection & hover state
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);

  // --- Animated House Reveal Sequence State ---
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);
  const [revealPaused, setRevealPaused] = useState(false);
  const revealAnimRef = useRef(null);
  const revealStartRef = useRef(null);
  const revealDuration = 8500; // 8.5 seconds total cinematic reveal

  // --- Walkthrough Tour State ---
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const waypoints = generateWalkthroughWaypoints(rooms, plot.width, plot.length);

  // Clean animation frame on unmount
  useEffect(() => {
    return () => {
      if (revealAnimRef.current) cancelAnimationFrame(revealAnimRef.current);
    };
  }, []);

  // Fullscreen 3D State & API
  const viewerContainerRef = useRef(null);
  const [isFullscreen3D, setIsFullscreen3D] = useState(false);

  const toggleFullscreen3D = async () => {
    if (!viewerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await viewerContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('3D Fullscreen toggle failed:', err);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isNowFs = !!document.fullscreenElement && document.fullscreenElement === viewerContainerRef.current;
      setIsFullscreen3D(isNowFs);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Floor Mode Change Handler
  const handleFloorModeChange = (mode) => {
    setFloorMode(mode);
    setSelectedRoomId(null);
    if (mode === 'cutaway') {
      setWallHeightMode('cutaway');
    } else if (mode === 'exterior') {
      setWallHeightMode('full');
      setCameraPreset('exterior');
    } else if (mode === 'topdown') {
      setCameraPreset('top');
    }
  };

  // Reveal Animation Driver (delta-time based)
  const startRevealAnimation = () => {
    if (revealAnimRef.current) cancelAnimationFrame(revealAnimRef.current);
    setIsRevealing(true);
    setRevealPaused(false);
    setRevealProgress(0);
    revealStartRef.current = performance.now();

    const loop = (now) => {
      const elapsed = now - revealStartRef.current;
      const progress = Math.min(1.0, elapsed / revealDuration);
      setRevealProgress(progress);

      if (progress < 1.0) {
        revealAnimRef.current = requestAnimationFrame(loop);
      } else {
        setIsRevealing(false);
        setRevealProgress(1.0);
      }
    };

    revealAnimRef.current = requestAnimationFrame(loop);
  };

  const handlePauseReveal = () => {
    if (revealAnimRef.current) cancelAnimationFrame(revealAnimRef.current);
    setRevealPaused(true);
  };

  const handleResumeReveal = () => {
    setRevealPaused(false);
    const alreadyElapsed = revealProgress * revealDuration;
    revealStartRef.current = performance.now() - alreadyElapsed;

    const loop = (now) => {
      const elapsed = now - revealStartRef.current;
      const progress = Math.min(1.0, elapsed / revealDuration);
      setRevealProgress(progress);

      if (progress < 1.0) {
        revealAnimRef.current = requestAnimationFrame(loop);
      } else {
        setIsRevealing(false);
        setRevealProgress(1.0);
      }
    };

    revealAnimRef.current = requestAnimationFrame(loop);
  };

  const handleSkipReveal = () => {
    if (revealAnimRef.current) cancelAnimationFrame(revealAnimRef.current);
    setIsRevealing(false);
    setRevealProgress(1.0);
    setRevealPaused(false);
  };

  // Walkthrough Handlers
  const handleStartWalkthrough = () => {
    if (waypoints.length === 0) return;
    setIsSimulator(false);
    setIsWalkthrough(true);
    setWalkthroughIndex(0);
    setSelectedRoomId(waypoints[0].id);
  };

  const handleNextWalkthrough = () => {
    if (walkthroughIndex < waypoints.length - 1) {
      const nextIdx = walkthroughIndex + 1;
      setWalkthroughIndex(nextIdx);
      setSelectedRoomId(waypoints[nextIdx].id);
    }
  };

  const handlePrevWalkthrough = () => {
    if (walkthroughIndex > 0) {
      const prevIdx = walkthroughIndex - 1;
      setWalkthroughIndex(prevIdx);
      setSelectedRoomId(waypoints[prevIdx].id);
    }
  };

  const handleExitWalkthrough = () => {
    setIsWalkthrough(false);
    setSelectedRoomId(null);
  };

  // Simulator Toggle
  const handleToggleSimulator = () => {
    setIsWalkthrough(false);
    setIsSimulator(prev => !prev);
  };

  const handleSelectCameraPreset = (preset) => {
    if (isSimulator) setIsSimulator(false);
    setIsWalkthrough(false);
    setCameraPreset(preset);
    setCameraPresetTrigger(Date.now());
  };

  const handleTouchKey = (key, isActive) => {
    setVirtualMovement(prev => ({
      ...prev,
      [key]: isActive
    }));
  };

  const currentWalkthroughRoom = isWalkthrough && waypoints[walkthroughIndex] ? waypoints[walkthroughIndex] : null;

  // Filtered rooms for stats
  const visibleRooms = rooms.filter(r => {
    if (floorMode === 'ground') return (r.level || 0) === 0;
    if (floorMode === 'first') return (r.level || 0) === 1;
    return true;
  });

  const activeInspectedRoom = hoveredRoom || rooms.find(r => r.id === selectedRoomId) || null;
  const validationIssues = layout.validation?.issues || [];
  const currentConcept = getDesignConcept(designConcept);

  return (
    <div
      ref={viewerContainerRef}
      className={`viewer-3d-container ${isFullscreen3D ? 'is-fullscreen' : ''}`}
    >
      {/* 3D Viewer Toolbar */}
      <Toolbar3D
        floorMode={floorMode}
        onChangeFloorMode={handleFloorModeChange}
        explodedGap={explodedGap}
        onChangeExplodedGap={setExplodedGap}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        onResetCamera={() => handleSelectCameraPreset('iso')}
        wallHeightMode={wallHeightMode}
        onToggleWallHeight={() => setWallHeightMode(prev => prev === 'cutaway' ? 'full' : 'cutaway')}
        showFurniture={showFurniture}
        onToggleFurniture={() => setShowFurniture(prev => !prev)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels(prev => !prev)}
        lightingPreset={lightingPreset}
        onChangeLightingPreset={setLightingPreset}
        materialStyle={materialStyle}
        onChangeMaterialStyle={setMaterialStyle}
        qualityPreset={qualityPreset}
        onChangeQualityPreset={setQualityPreset}
        // Fullscreen
        isFullscreen={isFullscreen3D}
        onToggleFullscreen={toggleFullscreen3D}
        // Phase 6 Simulator & Concept
        isSimulator={isSimulator}
        onToggleSimulator={handleToggleSimulator}
        designConcept={designConcept}
        onChangeDesignConcept={setDesignConcept}
        // Reveal Presentation
        isRevealing={isRevealing}
        revealProgress={revealProgress}
        revealPaused={revealPaused}
        onPlayReveal={handleResumeReveal}
        onPauseReveal={handlePauseReveal}
        onReplayReveal={startRevealAnimation}
        onSkipReveal={handleSkipReveal}
        // Walkthrough Tour
        isWalkthrough={isWalkthrough}
        walkthroughIndex={walkthroughIndex}
        walkthroughTotal={waypoints.length}
        currentWalkthroughRoom={currentWalkthroughRoom}
        onStartWalkthrough={handleStartWalkthrough}
        onPrevWalkthroughRoom={handlePrevWalkthrough}
        onNextWalkthroughRoom={handleNextWalkthrough}
        onExitWalkthrough={handleExitWalkthrough}
        isProvisional={isProvisional}
        floors={floors}
      />

      {/* Main 3D Viewport & Sidebar Split */}
      <div className="canvas-workspace viewer-3d-workspace">
        <div className="canvas-wrapper" style={{ position: 'relative' }}>
          <Canvas3D
            rooms={rooms}
            plot={plot}
            facing={facing}
            floorMode={floorMode}
            explodedGap={explodedGap}
            cameraPreset={cameraPreset}
            cameraPresetTrigger={cameraPresetTrigger}
            wallHeightMode={wallHeightMode}
            showFurniture={showFurniture}
            showLabels={showLabels}
            lightingPreset={lightingPreset}
            materialStyle={materialStyle}
            qualityPreset={qualityPreset}
            isRevealing={isRevealing}
            revealProgress={revealProgress}
            isWalkthrough={isWalkthrough}
            walkthroughWaypoint={currentWalkthroughRoom}
            selectedRoomId={selectedRoomId}
            onSelectRoom={(r) => setSelectedRoomId(prev => prev === r?.id ? null : r?.id || null)}
            onHoverRoom={setHoveredRoom}
            onExitWalkthrough={handleExitWalkthrough}
            // Phase 6 Simulator Props
            isSimulator={isSimulator}
            teleportTargetRoom={teleportTargetRoom}
            designConcept={designConcept}
            lightsOn={lightsOn}
            onInteractionChange={setActiveInteraction}
            onFurnitureInspect={setInspectedFurniture}
            onFloorChange={setSimulatorFloor}
            onExitSimulator={() => setIsSimulator(false)}
            onToggleLights={() => setLightsOn(prev => !prev)}
            virtualMovement={virtualMovement}
          />

          {/* Phase 6: First-Person Simulator Immersive HUD Overlay */}
          {isSimulator && (
            <div className="simulator-overlay">
              {/* Center Aim Crosshair */}
              <div className="simulator-crosshair" />

              {/* Top Status Bar */}
              <div className="simulator-top-bar">
                <div className="simulator-badge">
                  <Gamepad2 size={16} color="#38bdf8" />
                  <span>First-Person Exploration | {simulatorFloor === 0 ? 'Ground Floor (L0)' : 'First Floor (L1)'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Teleport to Room Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Jump:</span>
                    <select
                      className="form-input"
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        height: '30px',
                        background: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc',
                        borderRadius: '6px'
                      }}
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        if (e.target.value === 'spawn') {
                          setTeleportTargetRoom({ isSpawn: true, timestamp: Date.now() });
                        } else {
                          const r = rooms.find(rm => rm.id === e.target.value);
                          if (r) setTeleportTargetRoom({ ...r, timestamp: Date.now() });
                        }
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>Teleport to Room...</option>
                      <option value="spawn">Front Gate & Approach</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Floor {r.level || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setLightsOn(prev => !prev)}
                    style={{ background: lightsOn ? '#0284c7' : '#1e293b', color: '#ffffff' }}
                    title="Toggle Room & Exterior Lights (or press F)"
                  >
                    <Sun size={14} /> [F] Lights: {lightsOn ? 'ON' : 'OFF'}
                  </button>

                  <button
                    type="button"
                    className="simulator-exit-btn"
                    onClick={() => setIsSimulator(false)}
                    title="Exit Simulator and return to Studio (Esc)"
                  >
                    <X size={15} /> Exit Simulator
                  </button>
                </div>
              </div>

              {/* Dynamic Interaction Prompt (Center-Bottom) */}
              {activeInteraction && (
                <div className="simulator-interaction-prompt" onClick={activeInteraction.onToggle}>
                  <Sparkles size={16} color="#38bdf8" />
                  <span>[E] Press E or Click to {activeInteraction.isOpen ? 'Close' : 'Open'} {activeInteraction.name}</span>
                </div>
              )}

              {/* Floating Furniture Inspection HUD Card (Top-Right) */}
              {inspectedFurniture && (
                <div className="simulator-furniture-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <Armchair size={15} color="#38bdf8" />
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{inspectedFurniture.name}</h4>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                    <div><strong>Dimensions:</strong> {inspectedFurniture.dimensions}</div>
                    <div><strong>Finish:</strong> {inspectedFurniture.material}</div>
                    <div><strong>Space:</strong> {inspectedFurniture.room}</div>
                    <div style={{ marginTop: '0.35rem', color: '#38bdf8', fontSize: '0.72rem' }}>
                      {inspectedFurniture.clearance}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Bar: Controls Guide & Virtual Touch Controls */}
              <div className="simulator-bottom-bar">
                <div className="simulator-controls-guide">
                  <div><strong>[W][A][S][D] / Arrows:</strong> Walk | <strong>[Shift]:</strong> Sprint</div>
                  <div><strong>[Space]:</strong> Jump / Step-Up | <strong>[E]:</strong> Open Door / Gate</div>
                  <div><strong>[F]:</strong> Toggle Lights | <strong>[Esc]:</strong> Exit Simulator</div>
                  <div style={{ color: '#38bdf8', fontSize: '0.7rem', marginTop: '0.2rem' }}>Click viewport to lock mouse look</div>
                </div>

                {/* On-screen touch D-pad & action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div className="simulator-touch-dpad">
                    <div />
                    <button
                      type="button"
                      className="touch-btn"
                      onPointerDown={() => handleTouchKey('forward', true)}
                      onPointerUp={() => handleTouchKey('forward', false)}
                      title="Move Forward"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <div />
                    <button
                      type="button"
                      className="touch-btn"
                      onPointerDown={() => handleTouchKey('left', true)}
                      onPointerUp={() => handleTouchKey('left', false)}
                      title="Strafe Left"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="touch-btn"
                      onPointerDown={() => handleTouchKey('backward', true)}
                      onPointerUp={() => handleTouchKey('backward', false)}
                      title="Move Backward"
                    >
                      <ChevronDown size={18} />
                    </button>
                    <button
                      type="button"
                      className="touch-btn"
                      onPointerDown={() => handleTouchKey('right', true)}
                      onPointerUp={() => handleTouchKey('right', false)}
                      title="Strafe Right"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      type="button"
                      className="touch-btn"
                      style={{ width: '42px', height: '42px', fontSize: '0.72rem', background: '#0284c7', color: '#fff' }}
                      onClick={() => activeInteraction && activeInteraction.onToggle && activeInteraction.onToggle()}
                      title="Interact [E]"
                    >
                      [E]
                    </button>
                    <button
                      type="button"
                      className="touch-btn"
                      style={{ width: '42px', height: '42px', fontSize: '0.68rem' }}
                      onPointerDown={() => handleTouchKey('sprint', true)}
                      onPointerUp={() => handleTouchKey('sprint', false)}
                      title="Sprint"
                    >
                      Run
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick status bar below 3D viewport */}
          <div className="canvas-status-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                <Box size={13} /> {isSimulator ? 'Simulator Active' : 'Studio WebGL'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Concept: {currentConcept.name} | Light: {LIGHTING_PRESETS[lightingPreset]?.name} | Quality: {QUALITY_PRESETS[qualityPreset]?.name}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {isSimulator
                ? `Exploring Estate in First-Person Mode (Eye-Level 5.5 ft)`
                : isWalkthrough
                ? `Touring Room ${walkthroughIndex + 1} of ${waypoints.length} (${currentWalkthroughRoom?.name || ''})`
                : `Rendering complete property & ${visibleRooms.length} rooms (${floorMode.toUpperCase()} Mode)`}
            </div>
          </div>
        </div>

        {/* 3D Properties & Spatial Inspection Card */}
        <div className="properties-panel">
          <div className="panel-header">
            <h3 className="panel-title">
              <Box size={18} color="#38bdf8" /> 3D Studio Inspector
            </h3>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
              {isProvisional ? 'Provisional' : 'Confirmed'}
            </span>
          </div>

          {/* Geometry Warnings (if any) */}
          {validationIssues.length > 0 && (
            <div className="panel-alert alert-warning">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Geometry Warnings:</strong>
                {validationIssues.slice(0, 2).map((issue, idx) => (
                  <div key={idx}>• {issue.message}</div>
                ))}
              </div>
            </div>
          )}

          {/* Active room inspection card */}
          {activeInspectedRoom ? (
            <div className="panel-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: activeInspectedRoom.color || '#38bdf8'
                    }}
                  />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                    {activeInspectedRoom.name}
                  </h4>
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                  Level {activeInspectedRoom.level}
                </span>
              </div>

              <div className="stats-mini-grid" style={{ marginTop: '0.75rem' }}>
                <div className="stat-card">
                  <span className="stat-label">Dimensions</span>
                  <span className="stat-value">{activeInspectedRoom.width} × {activeInspectedRoom.length} ft</span>
                  <span className="stat-sub">Width × Length</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Floor Area</span>
                  <span className="stat-value">{Math.round(activeInspectedRoom.width * activeInspectedRoom.length)} sq ft</span>
                  <span className="stat-sub">{activeInspectedRoom.zone} zone</span>
                </div>
              </div>

              <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.5' }}>
                <div>• <strong>Openings:</strong> {activeInspectedRoom.doors?.length || 0} doors, {activeInspectedRoom.windows?.length || 0} windows</div>
                <div>• <strong>Elevation:</strong> Y = {getFloorElevation(activeInspectedRoom.level, floorMode === 'exploded' ? explodedGap : 0).toFixed(1)} ft</div>
                <div>• <strong>Coordinates (2D):</strong> X: {activeInspectedRoom.x} ft, Y: {activeInspectedRoom.y} ft</div>
              </div>
            </div>
          ) : (
            <div className="panel-section">
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.6rem' }}>
                Building Specifications
              </h4>
              <div className="stats-mini-grid">
                <div className="stat-card">
                  <span className="stat-label">Plot Footprint</span>
                  <span className="stat-value">{plot.width} × {plot.length} ft</span>
                  <span className="stat-sub">{plot.totalAreaSqFt} sq ft</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Levels Rendered</span>
                  <span className="stat-value">{floors.length} Levels</span>
                  <span className="stat-sub">{floorMode.toUpperCase()} Mode</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Floor Height</span>
                  <span className="stat-value">10.0 ft</span>
                  <span className="stat-sub">Floor-to-Floor</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Orientation</span>
                  <span className="stat-value" style={{ textTransform: 'capitalize' }}>{facing}</span>
                  <span className="stat-sub">Plot Entrance</span>
                </div>
              </div>
            </div>
          )}

          {/* Architectural Design Concept Details Card */}
          <div className="panel-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Building size={14} color="#38bdf8" /> {currentConcept.name}
              </h4>
              <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                Design Concept
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '0.5rem' }}>
              {currentConcept.description}
            </p>

            <div className="design-concept-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>Est. Cost Factor: <strong>{currentConcept.tradeoffs.estimatedCostMultiplier}x</strong></span>
                <span style={{ color: '#94a3b8' }}>Maintenance: <strong>{currentConcept.tradeoffs.maintenanceLevel}</strong></span>
              </div>

              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.4rem' }}>
                Architectural Advantages:
              </div>
              <ul className="concept-tradeoff-list" style={{ color: '#86efac' }}>
                {currentConcept.tradeoffs.pros.slice(0, 3).map((pro, i) => (
                  <li key={i}>{pro}</li>
                ))}
              </ul>

              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b', marginTop: '0.4rem' }}>
                Design Considerations:
              </div>
              <ul className="concept-tradeoff-list" style={{ color: '#fcd34d' }}>
                {currentConcept.tradeoffs.cons.slice(0, 2).map((con, i) => (
                  <li key={i}>{con}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Studio Controls Overview */}
          <div className="panel-section">
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={14} color="#38bdf8" /> Simulator & Studio Controls:
            </h4>
            <ul style={{ fontSize: '0.76rem', color: '#94a3b8', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
              <li><strong>Explore Simulator:</strong> Enter first-person game-like exploration with WASD and mouse look</li>
              <li><strong>Door & Gate Interaction:</strong> Press [E] within 5 ft to open or close doors/gates</li>
              <li><strong>Light Toggle:</strong> Press [F] to switch room & exterior illumination</li>
              <li><strong>Stair Climbing:</strong> Walk onto the staircase to ascend to Floor 1</li>
              <li><strong>Concept Switcher:</strong> Switch between Minimalist, Japandi, Mediterranean, and Loft styles</li>
            </ul>
          </div>

          <div className="panel-section" style={{ borderBottom: 'none' }}>
            <div className="canvas-hint-box">
              <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Live 2D-to-3D Sync:</strong> Any edit made in the 2D Canvas reflects in this 3D Simulator estate in real time.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statutory 3D Disclaimer */}
      <div className="alert-disclaimer" style={{ marginTop: '0.75rem' }}>
        <strong>Statutory Architectural Notice:</strong> Conceptual 3D architectural visualization only — not a construction-ready, structural engineering, or statutory building-code verified blueprint. Structural column grids, load calculations, MEP runs, and municipal setback sanctions must be verified by a licensed architect or civil engineer.
      </div>
    </div>
  );
}
