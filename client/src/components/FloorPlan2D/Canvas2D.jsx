import React, { useRef, useState, useEffect } from 'react';
import {
  DEFAULT_PIXELS_PER_FOOT,
  feetToPixels,
  pixelsToFeet,
  snapToGrid,
  clamp,
  doRoomsOverlap,
  isRoomWithinBounds,
  getRoomBoundingBox
} from '../../utils/canvasMath';
import { renderRoomBlueprintSymbols } from '../../utils/blueprintSymbols';
import { AlertCircle, Compass } from 'lucide-react';

export default function Canvas2D({
  rooms = [],
  plotWidth = 30,
  plotLength = 40,
  activeFloor = 0,
  selectedRoomId = null,
  onSelectRoom,
  onUpdateRoomPosition,
  onUpdateRoomDimensions,
  onUpdateRoomRotation,
  onCommitEdit,
  zoom = 1,
  panOffset = { x: 0, y: 0 },
  onPanChange,
  gridSnap = 1.0,
  facing = 'East',
  isProvisional = false,
  svgRef = null,
  containerRef: externalContainerRef = null,
  isFullscreen = false
}) {
  const localContainerRef = useRef(null);
  const containerRef = externalContainerRef || localContainerRef;

  // Dragging state
  const [dragState, setDragState] = useState(null);
  // Resizing state
  const [resizeState, setResizeState] = useState(null);
  // Rotating state
  const [rotateState, setRotateState] = useState(null);
  // Canvas panning state
  const [panState, setPanState] = useState(null);

  const baseScale = DEFAULT_PIXELS_PER_FOOT; // 20 px / ft
  const plotPxWidth = plotWidth * baseScale;
  const plotPxLength = plotLength * baseScale;
  const margin = 80; // Margin around plot for dimension lines and padding

  // Find all overlapping room IDs on the active floor
  const floorRooms = rooms.filter(r => r.level === activeFloor);
  const overlappingIds = new Set();
  for (let i = 0; i < floorRooms.length; i++) {
    for (let j = i + 1; j < floorRooms.length; j++) {
      if (doRoomsOverlap(floorRooms[i], floorRooms[j])) {
        overlappingIds.add(floorRooms[i].id);
        overlappingIds.add(floorRooms[j].id);
      }
    }
  }

  // --- Mouse / Pointer Handlers ---

  const handleCanvasMouseDown = (e) => {
    // Background click deselects active room
    if (e.target.dataset.role === 'canvas-bg' || e.target.dataset.role === 'grid-bg') {
      if (onSelectRoom) {
        onSelectRoom(null);
      }
      setPanState({
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: panOffset.x,
        initialPanY: panOffset.y,
      });
    }
  };

  const handleRoomMouseDown = (e, room) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectRoom(room);

    setDragState({
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: room.x,
      initialY: room.y,
      width: room.width,
      length: room.length,
      rotation: room.rotation || 0,
      lastSentX: room.x,
      lastSentY: room.y,
      hasMoved: false,
      initialRooms: JSON.parse(JSON.stringify(rooms)),
    });
  };

  const handleHandleMouseDown = (e, room, handle) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeState({
      roomId: room.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialX: room.x,
      initialY: room.y,
      initialW: room.width,
      initialL: room.length,
      rotation: room.rotation || 0,
      hasResized: false,
      initialRooms: JSON.parse(JSON.stringify(rooms)),
    });
  };

  const handleRotateMouseDown = (e, room) => {
    e.stopPropagation();
    e.preventDefault();
    const rx = room.x * baseScale;
    const ry = room.y * baseScale;
    const rw = room.width * baseScale;
    const rl = room.length * baseScale;
    const cx = rx + rw / 2;
    const cy = ry + rl / 2;

    setRotateState({
      roomId: room.id,
      cx,
      cy,
      initialRot: room.rotation || 0,
      hasRotated: false,
      initialRooms: JSON.parse(JSON.stringify(rooms)),
    });
  };

  // Global mouse move & mouse up listeners to support dragging even if cursor leaves room boundary
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      // 1. Panning canvas
      if (panState) {
        const dx = e.clientX - panState.startX;
        const dy = e.clientY - panState.startY;
        onPanChange({
          x: panState.initialPanX + dx,
          y: panState.initialPanY + dy,
        });
        return;
      }

      // 2. Dragging room
      if (dragState) {
        const dxPx = (e.clientX - dragState.startX) / zoom;
        const dyPx = (e.clientY - dragState.startY) / zoom;

        const dFeetX = dxPx / baseScale;
        const dFeetY = dyPx / baseScale;

        let newX = dragState.initialX + dFeetX;
        let newY = dragState.initialY + dFeetY;

        if (gridSnap > 0) {
          newX = snapToGrid(newX, gridSnap);
          newY = snapToGrid(newY, gridSnap);
        }

        // Calculate rotated room bounds offsets using getRoomBoundingBox
        const sampleBbox = getRoomBoundingBox({
          x: 0,
          y: 0,
          width: dragState.width,
          length: dragState.length,
          rotation: dragState.rotation
        });

        const minBoundX = -sampleBbox.minX;
        const maxBoundX = plotWidth - sampleBbox.maxX;
        const minBoundY = -sampleBbox.minY;
        const maxBoundY = plotLength - sampleBbox.maxY;

        // Clamp inside plot boundaries accurately according to rotation
        if (maxBoundX >= minBoundX) {
          newX = clamp(newX, minBoundX, maxBoundX);
        } else {
          newX = Math.max(0, newX);
        }

        if (maxBoundY >= minBoundY) {
          newY = clamp(newY, minBoundY, maxBoundY);
        } else {
          newY = Math.max(0, newY);
        }

        newX = Number(newX.toFixed(2));
        newY = Number(newY.toFixed(2));

        if (newX !== dragState.lastSentX || newY !== dragState.lastSentY) {
          dragState.hasMoved = true;
          dragState.lastSentX = newX;
          dragState.lastSentY = newY;
          onUpdateRoomPosition(dragState.roomId, newX, newY);
        }
        return;
      }

      // 3. Resizing room
      if (resizeState) {
        const dxPx = (e.clientX - resizeState.startX) / zoom;
        const dyPx = (e.clientY - resizeState.startY) / zoom;
        const dFeetX = dxPx / baseScale;
        const dFeetY = dyPx / baseScale;

        // Transform screen delta into local room space accounting for rotation
        const rot = resizeState.rotation || 0;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const localDx = dFeetX * cos + dFeetY * sin;
        const localDy = -dFeetX * sin + dFeetY * cos;

        let newW = resizeState.initialW;
        let newL = resizeState.initialL;
        let newX = resizeState.initialX;
        let newY = resizeState.initialY;

        const handle = resizeState.handle;

        // East / Right handle
        if (handle.includes('e')) {
          newW = Math.max(3, resizeState.initialW + localDx);
          if (gridSnap > 0) newW = snapToGrid(newW, gridSnap);
          newW = Math.min(newW, plotWidth - newX);
        }
        // South / Bottom handle
        if (handle.includes('s')) {
          newL = Math.max(3, resizeState.initialL + localDy);
          if (gridSnap > 0) newL = snapToGrid(newL, gridSnap);
          newL = Math.min(newL, plotLength - newY);
        }
        // West / Left handle
        if (handle.includes('w')) {
          const maxLeftShift = resizeState.initialX;
          const shift = Math.min(maxLeftShift, Math.max(-resizeState.initialW + 3, -localDx));
          newX = resizeState.initialX - shift;
          newW = resizeState.initialW + shift;
          if (gridSnap > 0) {
            newX = snapToGrid(newX, gridSnap);
            newW = snapToGrid(newW, gridSnap);
          }
        }
        // North / Top handle
        if (handle.includes('n')) {
          const maxTopShift = resizeState.initialY;
          const shift = Math.min(maxTopShift, Math.max(-resizeState.initialL + 3, -localDy));
          newY = resizeState.initialY - shift;
          newL = resizeState.initialL + shift;
          if (gridSnap > 0) {
            newY = snapToGrid(newY, gridSnap);
            newL = snapToGrid(newL, gridSnap);
          }
        }

        resizeState.hasResized = true;
        onUpdateRoomDimensions(
          resizeState.roomId,
          Number(newX.toFixed(2)),
          Number(newY.toFixed(2)),
          Number(newW.toFixed(2)),
          Number(newL.toFixed(2))
        );
        return;
      }

      // 4. Rotating room
      if (rotateState && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseSvgX = (e.clientX - rect.left - (panOffset.x + margin)) / zoom;
        const mouseSvgY = (e.clientY - rect.top - (panOffset.y + margin)) / zoom;

        const dx = mouseSvgX - rotateState.cx;
        const dy = mouseSvgY - rotateState.cy;
        const angleRad = Math.atan2(dy, dx);
        let deg = (angleRad * 180 / Math.PI) + 90;
        deg = (deg % 360 + 360) % 360;

        // 15° step snap
        deg = Math.round(deg / 15) * 15;
        // Magnetic snap to cardinal 0, 90, 180, 270
        for (const snap of [0, 90, 180, 270, 360]) {
          if (Math.abs(deg - snap) <= 4) {
            deg = snap % 360;
            break;
          }
        }
        deg = deg % 360;

        rotateState.hasRotated = true;
        if (onUpdateRoomRotation) {
          onUpdateRoomRotation(rotateState.roomId, deg);
        }
        return;
      }
    };

    const handleGlobalMouseUp = () => {
      if (panState) {
        setPanState(null);
      }
      if (dragState) {
        if (dragState.hasMoved && onCommitEdit) {
          onCommitEdit(dragState.initialRooms);
        }
        setDragState(null);
      }
      if (resizeState) {
        if (resizeState.hasResized && onCommitEdit) {
          onCommitEdit(resizeState.initialRooms);
        }
        setResizeState(null);
      }
      if (rotateState) {
        if (rotateState.hasRotated && onCommitEdit) {
          onCommitEdit(rotateState.initialRooms);
        }
        setRotateState(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('pointermove', handleGlobalMouseMove);
    window.addEventListener('pointerup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('pointermove', handleGlobalMouseMove);
      window.removeEventListener('pointerup', handleGlobalMouseUp);
    };
  }, [panState, dragState, resizeState, rotateState, zoom, panOffset, gridSnap, plotWidth, plotLength, onUpdateRoomRotation, onCommitEdit]);

  // Generate grid lines
  const gridLines = [];
  // Vertical lines every 5 ft
  for (let x = 0; x <= plotWidth; x += 5) {
    gridLines.push(
      <line
        key={`v-${x}`}
        x1={x * baseScale}
        y1={0}
        x2={x * baseScale}
        y2={plotPxLength}
        stroke="#1e293b"
        strokeWidth={x % 10 === 0 ? '1.2' : '0.6'}
        strokeDasharray={x % 10 === 0 ? 'none' : '2 2'}
      />
    );
  }
  // Horizontal lines every 5 ft
  for (let y = 0; y <= plotLength; y += 5) {
    gridLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y * baseScale}
        x2={plotPxWidth}
        y2={y * baseScale}
        stroke="#1e293b"
        strokeWidth={y % 10 === 0 ? '1.2' : '0.6'}
        strokeDasharray={y % 10 === 0 ? 'none' : '2 2'}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`canvas-container canvas-2d-viewport ${isFullscreen ? 'is-fullscreen' : ''}`}
      onMouseDown={handleCanvasMouseDown}
      style={{
        cursor: panState ? 'grabbing' : dragState ? 'move' : 'default',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100%' : '620px',
        backgroundColor: '#070b13',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        userSelect: 'none',
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        data-role="canvas-bg"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          {/* Subtle grid pattern for backdrop */}
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#121a29" strokeWidth="0.5" />
          </pattern>

          {/* Marker for dimension lines */}
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>

          {/* Parquet Hardwood Pattern for Bedrooms and Living */}
          <pattern id="cad-wood-pattern" width="30" height="15" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 30 0 M 0 15 L 30 15 M 15 0 L 15 15" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.8" />
          </pattern>

          {/* Ceramic Tile Pattern for Kitchen and Bathrooms */}
          <pattern id="cad-tile-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
          </pattern>

          {/* Stone Paver Pattern for Parking and Balcony */}
          <pattern id="cad-paver-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Outer Background Grid */}
        <rect width="100%" height="100%" fill="url(#grid-pattern)" data-role="grid-bg" />

        {/* Viewport Transform Group for Zoom & Pan */}
        <g
          transform={`translate(${panOffset.x + margin}, ${panOffset.y + margin}) scale(${zoom})`}
        >
          {/* Plot Footprint Background */}
          <rect
            x={0}
            y={0}
            width={plotPxWidth}
            height={plotPxLength}
            fill="#0d1424"
            stroke="#334155"
            strokeWidth="3"
            rx="2"
          />

          {/* Internal Grid Lines */}
          {gridLines}

          {/* Setback dashed box indicator (conceptual 3ft front, 2ft sides) */}
          <rect
            x={2 * baseScale}
            y={2 * baseScale}
            width={Math.max(0, (plotWidth - 4) * baseScale)}
            height={Math.max(0, (plotLength - 5) * baseScale)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Dimension Lines */}
          {/* Top Width Dimension */}
          <g>
            <line
              x1={0}
              y1={-25}
              x2={plotPxWidth}
              y2={-25}
              stroke="#64748b"
              strokeWidth="1.2"
              markerStart="url(#arrow)"
              markerEnd="url(#arrow)"
            />
            <line x1={0} y1={-32} x2={0} y2={-5} stroke="#475569" strokeWidth="1" />
            <line x1={plotPxWidth} y1={-32} x2={plotPxWidth} y2={-5} stroke="#475569" strokeWidth="1" />
            <text
              x={plotPxWidth / 2}
              y={-30}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              Width: {plotWidth} ft {isProvisional ? '(Assumed)' : ''}
            </text>
          </g>

          {/* Left Length Dimension */}
          <g>
            <line
              x1={-25}
              y1={0}
              x2={-25}
              y2={plotPxLength}
              stroke="#64748b"
              strokeWidth="1.2"
              markerStart="url(#arrow)"
              markerEnd="url(#arrow)"
            />
            <line x1={-32} y1={0} x2={-5} y2={0} stroke="#475569" strokeWidth="1" />
            <line x1={-32} y1={plotPxLength} x2={-5} y2={plotPxLength} stroke="#475569" strokeWidth="1" />
            <text
              x={-32}
              y={plotPxLength / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
              fontWeight="600"
              fontFamily="sans-serif"
              transform={`rotate(-90, -32, ${plotPxLength / 2})`}
            >
              Length: {plotLength} ft
            </text>
          </g>

          {/* Orientation Compass Marker */}
          <g transform={`translate(${plotPxWidth + 25}, 20)`}>
            <circle cx="0" cy="0" r="16" fill="#121826" stroke="#334155" strokeWidth="1.5" />
            <path d="M 0 -12 L 4 -2 L -4 -2 Z" fill="#38bdf8" />
            <path d="M 0 12 L 4 2 L -4 2 Z" fill="#64748b" />
            <text x="0" y="-14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#38bdf8">N</text>
            <text x="0" y="27" textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">
              {facing} Facing
            </text>
          </g>

          {/* ROOMS on this floor */}
          {floorRooms.map((room) => {
            const rx = room.x * baseScale;
            const ry = room.y * baseScale;
            const rw = room.width * baseScale;
            const rl = room.length * baseScale;

            const isSelected = selectedRoomId === room.id;
            const hasOverlap = overlappingIds.has(room.id);
            const isOutOfBounds = !isRoomWithinBounds(room, plotWidth, plotLength);
            const isInvalid = hasOverlap || isOutOfBounds;

            const isStairs = room.type === 'staircase' || room.type === 'foyer' || room.name.toLowerCase().includes('stairs');
            const roomCx = rx + rw / 2;
            const roomCy = ry + rl / 2;
            const roomRot = room.rotation || 0;

            return (
              <g
                key={room.id}
                className="room-group"
                style={{ cursor: dragState?.roomId === room.id ? 'grabbing' : 'grab' }}
                onMouseDown={(e) => handleRoomMouseDown(e, room)}
              >
                <g transform={`rotate(${roomRot}, ${roomCx}, ${roomCy})`}>
                  {/* Architectural Double-Line Wall & Floor Area */}
                  {/* Outer Wall Boundary */}
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rl}
                    fill={
                      room.type?.includes('kitchen') || room.name?.toLowerCase().includes('bath')
                        ? 'url(#cad-tile-pattern)'
                        : room.type?.includes('parking') || room.name?.toLowerCase().includes('balcony')
                        ? 'url(#cad-paver-pattern)'
                        : 'url(#cad-wood-pattern)'
                    }
                    stroke={
                      isInvalid
                        ? '#f43f5e'
                        : isSelected
                        ? '#38bdf8'
                        : '#475569'
                    }
                    strokeWidth={isSelected ? '3' : isInvalid ? '2.5' : '2'}
                    strokeDasharray={isInvalid ? '6 3' : 'none'}
                    rx="2"
                    filter={isSelected ? 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.4))' : 'none'}
                  />

                  {/* Inner Floor Tint */}
                  <rect
                    x={rx + 2}
                    y={ry + 2}
                    width={Math.max(0, rw - 4)}
                    height={Math.max(0, rl - 4)}
                    fill={room.color || '#38bdf8'}
                    fillOpacity={isSelected ? 0.35 : 0.16}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="0.8"
                    rx="1"
                  />

                  {/* Architectural CAD Furniture Symbols (Bed, Sofa, Kitchen Counter, WC, Car, Dining) */}
                  {renderRoomBlueprintSymbols(room, rx, ry, rw, rl, isSelected)}

                  {/* Staircase treads visualization */}
                  {isStairs && (
                    <g pointerEvents="none">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <line
                          key={idx}
                          x1={rx + 4}
                          y1={ry + (rl / 10) * (idx + 1)}
                          x2={rx + rw - 4}
                          y2={ry + (rl / 10) * (idx + 1)}
                          stroke="#f43f5e"
                          strokeWidth="1.2"
                          strokeOpacity="0.7"
                        />
                      ))}
                      {/* Arrow showing vertical circulation direction */}
                      <path
                        d={`M ${rx + rw / 2} ${ry + rl - 10} L ${rx + rw / 2} ${ry + 10}`}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={rx + rw / 2}
                        y={ry + rl - 15}
                        textAnchor="middle"
                        fill="#f43f5e"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        {activeFloor === 0 ? 'UP ➔' : 'DN ➔'}
                      </text>
                    </g>
                  )}

                  {/* Architectural Doors with Swing Arc & Jambs */}
                  {room.doors?.map((door, dIdx) => {
                    const dw = Math.min(rw * 0.4, 24);
                    const dx = rx + 12;
                    const dy = door.wall === 'north' ? ry : ry + rl;
                    const isNorth = door.wall === 'north';

                    return (
                      <g key={dIdx} pointerEvents="none">
                        {/* Wall Cutout Break */}
                        <line
                          x1={dx}
                          y1={dy}
                          x2={dx + dw}
                          y2={dy}
                          stroke="#070b13"
                          strokeWidth="6"
                        />
                        {/* Door Jambs */}
                        <rect x={dx - 2} y={dy - 2} width="4" height="4" fill="#94a3b8" />
                        <rect x={dx + dw - 2} y={dy - 2} width="4" height="4" fill="#94a3b8" />
                        {/* Door Leaf (perpendicular inward) */}
                        <line
                          x1={dx}
                          y1={dy}
                          x2={dx}
                          y2={isNorth ? dy + dw : dy - dw}
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />
                        {/* Swing Arc */}
                        <path
                          d={isNorth
                            ? `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy}`
                            : `M ${dx} ${dy - dw} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="2 2"
                          strokeOpacity="0.85"
                        />
                      </g>
                    );
                  })}

                  {/* Architectural Windows with Glazing & Sill */}
                  {room.windows?.map((win, wIdx) => {
                    const isNorth = win.wall === 'north';
                    const isSouth = win.wall === 'south';
                    const isEast = win.wall === 'east';
                    const isWest = win.wall === 'west';

                    const ww = Math.min(rw * 0.5, 44);
                    const wx = rx + (rw - ww) / 2;
                    const wy = isSouth ? ry + rl : ry;

                    if (isEast || isWest) {
                      const wh = Math.min(rl * 0.45, 40);
                      const wxx = isEast ? rx + rw : rx;
                      const wyy = ry + (rl - wh) / 2;
                      return (
                        <g key={wIdx} pointerEvents="none">
                          <line x1={wxx} y1={wyy} x2={wxx} y2={wyy + wh} stroke="#070b13" strokeWidth="6" />
                          <line x1={isEast ? wxx + 2 : wxx - 2} y1={wyy - 2} x2={isEast ? wxx + 2 : wxx - 2} y2={wyy + wh + 2} stroke="#64748b" strokeWidth="1.4" />
                          <line x1={wxx - 1} y1={wyy} x2={wxx - 1} y2={wyy + wh} stroke="#38bdf8" strokeWidth="1.5" />
                          <line x1={wxx + 1} y1={wyy} x2={wxx + 1} y2={wyy + wh} stroke="#38bdf8" strokeWidth="1.5" />
                        </g>
                      );
                    }

                    return (
                      <g key={wIdx} pointerEvents="none">
                        <line x1={wx} y1={wy} x2={wx + ww} y2={wy} stroke="#070b13" strokeWidth="6" />
                        <line x1={wx - 2} y1={isSouth ? wy + 2 : wy - 2} x2={wx + ww + 2} y2={isSouth ? wy + 2 : wy - 2} stroke="#64748b" strokeWidth="1.4" />
                        <line x1={wx} y1={wy - 1} x2={wx + ww} y2={wy - 1} stroke="#38bdf8" strokeWidth="1.5" />
                        <line x1={wx} y1={wy + 1} x2={wx + ww} y2={wy + 1} stroke="#38bdf8" strokeWidth="1.5" />
                      </g>
                    );
                  })}

                  {/* Selected Room Dimension Ticks */}
                  {isSelected && (
                    <g pointerEvents="none">
                      {/* Top Width Dimension Line */}
                      <line x1={rx} y1={ry - 8} x2={rx + rw} y2={ry - 8} stroke="#38bdf8" strokeWidth="1" />
                      <line x1={rx - 3} y1={ry - 5} x2={rx + 3} y2={ry - 11} stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1={rx + rw - 3} y1={ry - 5} x2={rx + rw + 3} y2={ry - 11} stroke="#38bdf8" strokeWidth="1.5" />
                      <text x={rx + rw / 2} y={ry - 11} textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">
                        {room.width.toFixed(1)}'
                      </text>

                      {/* Left Length Dimension Line */}
                      <line x1={rx - 8} y1={ry} x2={rx - 8} y2={ry + rl} stroke="#38bdf8" strokeWidth="1" />
                      <line x1={rx - 5} y1={ry - 3} x2={rx - 11} y2={ry + 3} stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1={rx - 5} y1={ry + rl - 3} x2={rx - 11} y2={ry + rl + 3} stroke="#38bdf8" strokeWidth="1.5" />
                      <text x={rx - 11} y={ry + rl / 2} textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold" transform={`rotate(-90, ${rx - 11}, ${ry + rl / 2})`}>
                        {room.length.toFixed(1)}'
                      </text>
                    </g>
                  )}

                  {/* Room Tag Label */}
                  <g pointerEvents="none">
                    <rect
                      x={rx + rw / 2 - Math.min(rw * 0.42, 65)}
                      y={ry + rl / 2 - 18}
                      width={Math.min(rw * 0.84, 130)}
                      height={36}
                      fill="rgba(8, 14, 26, 0.78)"
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth="0.8"
                      rx="6"
                    />
                    <text
                      x={rx + rw / 2}
                      y={ry + rl / 2 - 5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={rw < 90 || rl < 60 ? '10' : '11'}
                      fontWeight="700"
                      fontFamily="sans-serif"
                    >
                      {room.name}
                    </text>
                    <text
                      x={rx + rw / 2}
                      y={ry + rl / 2 + 10}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize={rw < 90 || rl < 60 ? '8.5' : '9.5'}
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {room.width.toFixed(1)}' × {room.length.toFixed(1)}' • {Math.round(room.width * room.length)} sqft
                    </text>
                  </g>

                  {/* Warning icon if room overlaps or is out of bounds */}
                  {isInvalid && (
                    <g transform={`translate(${rx + rw - 22}, ${ry + 6})`} pointerEvents="none">
                      <circle cx="8" cy="8" r="8" fill="#e11d48" />
                      <text x="8" y="12" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">!</text>
                    </g>
                  )}

                  {/* Resize Handles (rendered for selected room) */}
                  {isSelected && (
                    <g className="resize-handles">
                      {/* Corner SE Handle */}
                      <rect
                        x={rx + rw - 6}
                        y={ry + rl - 6}
                        width={12}
                        height={12}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        rx="2"
                        style={{ cursor: 'nwse-resize' }}
                        onMouseDown={(e) => handleHandleMouseDown(e, room, 'se')}
                      />
                      {/* Middle East Handle */}
                      <rect
                        x={rx + rw - 5}
                        y={ry + rl / 2 - 5}
                        width={10}
                        height={10}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        rx="2"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => handleHandleMouseDown(e, room, 'e')}
                      />
                      {/* Middle South Handle */}
                      <rect
                        x={rx + rw / 2 - 5}
                        y={ry + rl - 5}
                        width={10}
                        height={10}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        rx="2"
                        style={{ cursor: 'ns-resize' }}
                        onMouseDown={(e) => handleHandleMouseDown(e, room, 's')}
                      />
                    </g>
                  )}

                  {/* Room Rotation Stalk and Handle Knob */}
                  {isSelected && (
                    <g className="rotation-controls">
                      <line
                        x1={roomCx}
                        y1={ry}
                        x2={roomCx}
                        y2={ry - 24}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                      <circle
                        cx={roomCx}
                        cy={ry - 24}
                        r="7.5"
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth="2"
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => handleRotateMouseDown(e, room)}
                      />
                      <text
                        x={roomCx}
                        y={ry - 34}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="sans-serif"
                        pointerEvents="none"
                      >
                        {roomRot}°
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
