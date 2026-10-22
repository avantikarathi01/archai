import React, { useState, useEffect, useRef } from 'react';
import Toolbar2D from './Toolbar2D';
import Canvas2D from './Canvas2D';
import PropertiesPanel from './PropertiesPanel';
import AddRoomModal from './AddRoomModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import PrintPreviewModal from './PrintPreviewModal';
import {
  recalculateLayoutMetrics,
  downloadSvgAsPng,
  downloadSvgFile,
  doRoomsOverlap,
  isRoomWithinBounds
} from '../../utils/canvasMath';
import { validateDesign } from '../../services/api';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'archai_floorplan_v1';

export default function FloorPlan2D({
  layout = null,
  requirements = null,
  onLayoutUpdated
}) {
  if (!layout) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <p>No floor plan generated yet. Generate a design from the prompt interface above to begin 2D editing.</p>
      </div>
    );
  }

  const plot = layout.plot || {
    width: 30,
    length: 40,
    totalAreaSqFt: 1200,
    isDimensionsExplicit: false,
  };

  const isProvisional = layout.isProvisional || !plot.isDimensionsExplicit;
  const facing = layout.facing || requirements?.facing || 'East';

  // Available floors in layout
  const availableFloors = Array.from(
    new Set((layout.rooms || []).map((r) => r.level || 0))
  ).sort((a, b) => a - b);
  if (availableFloors.length === 0) availableFloors.push(0);

  // --- State ---
  const [rooms, setRooms] = useState(layout.rooms || []);
  const [activeFloor, setActiveFloor] = useState(availableFloors[0] || 0);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // Viewport
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [gridSnap, setGridSnap] = useState(1.0);

  // Undo / Redo History
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Live Metrics & Server Validation state
  const [metrics, setMetrics] = useState(() =>
    recalculateLayoutMetrics(layout.rooms || [], plot.totalAreaSqFt, plot.isDimensionsExplicit)
  );
  const [serverValidation, setServerValidation] = useState(layout.validation || null);

  const svgRef = useRef(null);
  const floorplanContainerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasUserEditedRef = useRef(false);
  const lastLayoutIdRef = useRef(layout?.id || null);

  // Sync state if a completely new layout was generated from parent
  useEffect(() => {
    if (!layout?.rooms) return;

    const currentLayoutId = layout.id || layout.metadata?.createdAt;

    // If it is an in-place update of the existing layout (e.g. from local editing / validation debounce),
    // update serverValidation but do NOT wipe history, future, rooms, or deselect the active room!
    if (lastLayoutIdRef.current && currentLayoutId && lastLayoutIdRef.current === currentLayoutId) {
      if (layout.validation) {
        setServerValidation(layout.validation);
      }
      return;
    }

    // A brand new layout has been loaded or generated
    lastLayoutIdRef.current = currentLayoutId;
    hasUserEditedRef.current = false;
    setRooms(layout.rooms);
    setHistory([]);
    setFuture([]);
    setSelectedRoomId(null);
    const newFloors = Array.from(new Set(layout.rooms.map((r) => r.level || 0))).sort((a, b) => a - b);
    if (!newFloors.includes(activeFloor)) {
      setActiveFloor(newFloors[0] || 0);
    }
    setMetrics(
      recalculateLayoutMetrics(layout.rooms, plot.totalAreaSqFt, plot.isDimensionsExplicit)
    );
    setServerValidation(layout.validation);
  }, [layout]);

  // Recalculate metrics whenever rooms change
  useEffect(() => {
    const updatedMetrics = recalculateLayoutMetrics(
      rooms,
      plot.totalAreaSqFt,
      plot.isDimensionsExplicit
    );
    setMetrics(updatedMetrics);

    // Only run debounced server validation and notify parent if the user actually edited rooms
    if (!hasUserEditedRef.current) return;

    const timer = setTimeout(async () => {
      const payload = {
        ...layout,
        rooms,
        summary: {
          ...layout.summary,
          ...updatedMetrics,
        },
      };
      const res = await validateDesign(payload);
      if (res.ok && res.data?.validation) {
        setServerValidation(res.data.validation);
        if (onLayoutUpdated) {
          onLayoutUpdated(payload);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [rooms, plot]);

  // Record history snapshot before an edit commits
  const pushHistorySnapshot = (prevRooms) => {
    setHistory((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(prevRooms))]);
    setFuture([]);
  };

  // --- Handlers ---

  const handleSelectRoom = (room) => {
    setSelectedRoomId(room?.id || null);
  };

  const handleDeselectRoom = () => {
    setSelectedRoomId(null);
  };

  const handleUpdateRoomPosition = (id, newX, newY) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, x: newX, y: newY } : r))
    );
  };

  const handleUpdateRoomDimensions = (id, newX, newY, newW, newL) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              x: newX,
              y: newY,
              width: newW,
              length: newL,
              area: Math.round(newW * newL),
            }
          : r
      )
    );
  };

  const handleUpdateRoomRotation = (id, newRotation) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, rotation: newRotation } : r))
    );
  };

  const handleCommitEdit = (snapshotBeforeEdit) => {
    hasUserEditedRef.current = true;
    pushHistorySnapshot(snapshotBeforeEdit || rooms);
  };

  const handlePropertyUpdate = (updatedRoom) => {
    hasUserEditedRef.current = true;
    pushHistorySnapshot(rooms);
    setRooms((prev) =>
      prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r))
    );
  };

  const handleAddRoom = (newRoom) => {
    hasUserEditedRef.current = true;
    pushHistorySnapshot(rooms);
    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  const handleDeleteRoomClick = (room) => {
    setRoomToDelete(room);
  };

  const handleConfirmDelete = () => {
    if (!roomToDelete) return;
    hasUserEditedRef.current = true;
    pushHistorySnapshot(rooms);
    setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
    if (selectedRoomId === roomToDelete.id) {
      setSelectedRoomId(null);
    }
    setRoomToDelete(null);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    hasUserEditedRef.current = true;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [JSON.parse(JSON.stringify(rooms)), ...prev]);
    setRooms(previous);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    hasUserEditedRef.current = true;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(rooms))]);
    setRooms(next);
  };

  const handleResetLayout = () => {
    if (layout?.rooms) {
      hasUserEditedRef.current = true;
      pushHistorySnapshot(rooms);
      setRooms(JSON.parse(JSON.stringify(layout.rooms)));
      setSelectedRoomId(null);
    }
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do not intercept keystrokes if the user is typing in an input, textarea, or contentEditable!
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, future, rooms]);

  // Zoom & Viewport controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
  const handleZoomReset = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFitEntireFloorPlan = () => {
    const el = canvasContainerRef.current;
    const cWidth = el?.clientWidth || 800;
    const cHeight = el?.clientHeight || 620;

    const baseScale = 20; // DEFAULT_PIXELS_PER_FOOT
    const margin = 80;
    const contentWidth = plot.width * baseScale;
    const contentHeight = plot.length * baseScale;

    const paddingX = 140;
    const paddingY = 140;

    const targetZoomX = (cWidth - paddingX) / contentWidth;
    const targetZoomY = (cHeight - paddingY) / contentHeight;
    const newZoom = Number(Math.max(0.4, Math.min(2.0, Math.min(targetZoomX, targetZoomY))).toFixed(2));

    const newPanX = Math.round((cWidth - newZoom * contentWidth) / 2 - margin);
    const newPanY = Math.round((cHeight - newZoom * contentHeight) / 2 - margin);

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  // Fullscreen API toggle
  const toggleFullscreen = async () => {
    if (!floorplanContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await floorplanContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  // Listen for fullscreen change events to update state and auto-refit canvas
  useEffect(() => {
    const handleFsChange = () => {
      const isNowFs = !!document.fullscreenElement && document.fullscreenElement === floorplanContainerRef.current;
      setIsFullscreen(isNowFs);
      setTimeout(() => {
        handleFitEntireFloorPlan();
      }, 150);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [plot.width, plot.length]);

  // Auto-fit floor plan on initial layout generation or plot dimension change
  useEffect(() => {
    const t = setTimeout(() => {
      handleFitEntireFloorPlan();
    }, 120);
    return () => clearTimeout(t);
  }, [layout?.id, plot.width, plot.length]);

  // Exports
  const handleExportPng = async () => {
    if (svgRef.current) {
      await downloadSvgAsPng(svgRef.current, `archai-floorplan-L${activeFloor}.png`);
    }
  };

  const handleExportSvg = () => {
    if (svgRef.current) {
      downloadSvgFile(svgRef.current, `archai-floorplan-L${activeFloor}.svg`);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;

  // Calculate local geometry validity synchronously across all rooms on current floor and whole house
  const localIssues = [];
  for (let i = 0; i < rooms.length; i++) {
    const r1 = rooms[i];
    if (!isRoomWithinBounds(r1, plot.width, plot.length)) {
      localIssues.push(`Room "${r1.name}" exceeds plot boundaries`);
    }
    for (let j = i + 1; j < rooms.length; j++) {
      const r2 = rooms[j];
      if (r1.level === r2.level && doRoomsOverlap(r1, r2)) {
        localIssues.push(`Rooms "${r1.name}" and "${r2.name}" overlap on Floor ${r1.level}`);
      }
    }
  }

  const isLayoutLocallyValid = localIssues.length === 0;
  const isGeometryValid = isLayoutLocallyValid && (serverValidation ? serverValidation.isValid : true);
  const totalIssueCount = localIssues.length > 0 ? localIssues.length : (serverValidation?.issues?.length || 1);

  return (
    <div
      ref={floorplanContainerRef}
      className={`floorplan-2d-container ${isFullscreen ? 'is-fullscreen' : ''}`}
    >
      {/* 2D Canvas Toolbar */}
      <Toolbar2D
        floors={availableFloors}
        activeFloor={activeFloor}
        onSelectFloor={(lvl) => {
          setActiveFloor(lvl);
          setSelectedRoomId(null);
        }}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onFitEntirePlan={handleFitEntireFloorPlan}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        gridSnap={gridSnap}
        onChangeGridSnap={setGridSnap}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetLayout={handleResetLayout}
        onOpenAddRoom={() => setIsAddRoomOpen(true)}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onOpenPrintPreview={() => setIsPrintModalOpen(true)}
        isProvisional={isProvisional}
      />

      {/* Main interactive split area: Canvas on Left/Center, Properties on Right */}
      <div className="canvas-workspace">
        <div className="canvas-wrapper">
          <Canvas2D
            containerRef={canvasContainerRef}
            svgRef={svgRef}
            rooms={rooms}
            plotWidth={plot.width}
            plotLength={plot.length}
            activeFloor={activeFloor}
            selectedRoomId={selectedRoomId}
            onSelectRoom={handleSelectRoom}
            onUpdateRoomPosition={handleUpdateRoomPosition}
            onUpdateRoomDimensions={handleUpdateRoomDimensions}
            onUpdateRoomRotation={handleUpdateRoomRotation}
            onCommitEdit={handleCommitEdit}
            zoom={zoom}
            panOffset={panOffset}
            onPanChange={setPanOffset}
            gridSnap={gridSnap}
            facing={facing}
            isProvisional={isProvisional}
            isFullscreen={isFullscreen}
          />

          {/* Quick status bar below canvas */}
          <div className="canvas-status-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isGeometryValid ? (
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                  <CheckCircle2 size={13} /> Layout Valid
                </span>
              ) : (
                <span className="badge badge-error" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                  <AlertCircle size={13} /> {totalIssueCount} Geometry Warning{totalIssueCount > 1 ? 's' : ''}
                </span>
              )}
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Room Area: {metrics.roomAreaSumSqFt} sq ft | Built-up: {metrics.totalBuiltUpAreaSqFt} sq ft | Carpet: ~{metrics.totalCarpetAreaSqFt} sq ft
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing {rooms.filter(r => r.level === activeFloor).length} rooms on Level {activeFloor}
            </div>
          </div>
        </div>

        {/* Properties / Inspector Panel */}
        <PropertiesPanel
          selectedRoom={selectedRoom}
          allRooms={rooms}
          plotWidth={plot.width}
          plotLength={plot.length}
          plotArea={plot.totalAreaSqFt}
          isDimensionsExplicit={plot.isDimensionsExplicit}
          activeFloor={activeFloor}
          onUpdateRoom={handlePropertyUpdate}
          onDeleteRoomClick={handleDeleteRoomClick}
          onDeselectRoom={handleDeselectRoom}
          onOpenAddRoom={() => setIsAddRoomOpen(true)}
          metrics={metrics}
        />
      </div>

      {/* Add Room Modal */}
      <AddRoomModal
        isOpen={isAddRoomOpen}
        floors={availableFloors}
        activeFloor={activeFloor}
        plotWidth={plot.width}
        plotLength={plot.length}
        existingRooms={rooms}
        onAddRoom={handleAddRoom}
        onClose={() => setIsAddRoomOpen(false)}
      />

      {/* Delete Room Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!roomToDelete}
        room={roomToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setRoomToDelete(null)}
      />

      {/* Print Preview & Schedule Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        rooms={rooms}
        plot={plot}
        facing={facing}
        activeFloor={activeFloor}
        metrics={metrics}
        isProvisional={isProvisional}
      />
    </div>
  );
}
