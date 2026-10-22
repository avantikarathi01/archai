import React from 'react';

/**
 * Architectural CAD Blueprint Symbols for ArchAI 2D Floor Plan Canvas
 * Inspired by professional architectural CAD standards (Home_View, openPlan3D, house-planner)
 */

export function renderRoomBlueprintSymbols(room, rx, ry, rw, rl, isSelected) {
  const type = (room.type || '').toLowerCase();
  const name = (room.name || '').toLowerCase();
  const isSmall = rw < 70 || rl < 70;

  // 1. MASTER BEDROOM / BEDROOM
  if (type.includes('bedroom') || name.includes('bed')) {
    const isMaster = type.includes('master') || name.includes('master');
    const bedW = Math.min(rw * 0.58, isMaster ? 110 : 90);
    const bedL = Math.min(rl * 0.65, isMaster ? 120 : 100);
    const bedX = rx + (rw - bedW) / 2;
    const bedY = ry + 12;

    const pillowW = bedW * 0.38;
    const pillowL = bedL * 0.22;
    const pillowY = bedY + 8;

    return (
      <g className="cad-symbol bedroom-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Bed Base / Frame */}
        <rect
          x={bedX}
          y={bedY}
          width={bedW}
          height={bedL}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1.2"
          rx="4"
        />

        {/* Headboard */}
        <rect
          x={bedX - 2}
          y={bedY - 4}
          width={bedW + 4}
          height={7}
          fill="#334155"
          stroke="#64748b"
          strokeWidth="1"
          rx="2"
        />

        {/* Pillows */}
        <rect
          x={bedX + bedW * 0.08}
          y={pillowY}
          width={pillowW}
          height={pillowL}
          fill="#f1f5f9"
          stroke="#94a3b8"
          strokeWidth="0.8"
          rx="3"
        />
        <rect
          x={bedX + bedW - bedW * 0.08 - pillowW}
          y={pillowY}
          width={pillowW}
          height={pillowL}
          fill="#f1f5f9"
          stroke="#94a3b8"
          strokeWidth="0.8"
          rx="3"
        />

        {/* Duvet / Quilt fold line */}
        <path
          d={`M ${bedX + 2} ${bedY + bedL * 0.42} Q ${bedX + bedW / 2} ${bedY + bedL * 0.48} ${bedX + bedW - 2} ${bedY + bedL * 0.42}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />

        {/* Bedside Nightstands */}
        {rw >= 120 && (
          <>
            <rect
              x={bedX - 22}
              y={bedY + 2}
              width={18}
              height={18}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1"
              rx="2"
            />
            <circle cx={bedX - 13} cy={bedY + 11} r={4} fill="#fef08a" opacity="0.8" />

            <rect
              x={bedX + bedW + 4}
              y={bedY + 2}
              width={18}
              height={18}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1"
              rx="2"
            />
            <circle cx={bedX + bedW + 13} cy={bedY + 11} r={4} fill="#fef08a" opacity="0.8" />
          </>
        )}

        {/* Wardrobe closet along side wall if room is wide enough */}
        {rw >= 140 && rl >= 120 && (
          <g>
            <rect
              x={rx + rw - 24}
              y={ry + 20}
              width={20}
              height={Math.min(rl - 40, 90)}
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="1"
            />
            <line
              x1={rx + rw - 14}
              y1={ry + 20}
              x2={rx + rw - 14}
              y2={ry + 20 + Math.min(rl - 40, 90)}
              stroke="#334155"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
          </g>
        )}
      </g>
    );
  }

  // 2. LIVING ROOM / DRAWING HALL
  if (type.includes('living') || name.includes('living') || name.includes('hall') || name.includes('lounge')) {
    const sofaW = Math.min(rw * 0.62, 140);
    const sofaD = 36;
    const sofaX = rx + (rw - sofaW) / 2;
    const sofaY = ry + rl - sofaD - 14;

    const rugW = sofaW * 0.9;
    const rugL = 48;
    const rugX = rx + (rw - rugW) / 2;
    const rugY = sofaY - rugL - 8;

    const tableW = rugW * 0.55;
    const tableL = 22;
    const tableX = rx + (rw - tableW) / 2;
    const tableY = rugY + (rugL - tableL) / 2;

    const tvW = Math.min(rw * 0.5, 90);
    const tvX = rx + (rw - tvW) / 2;

    return (
      <g className="cad-symbol living-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Decorative Area Rug */}
        <rect
          x={rugX}
          y={rugY}
          width={rugW}
          height={rugL}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="4 3"
          rx="3"
        />

        {/* Coffee Table */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={tableL}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1"
          rx="3"
        />

        {/* 3-Seater / Sectional Sofa */}
        <rect
          x={sofaX}
          y={sofaY}
          width={sofaW}
          height={sofaD}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1.2"
          rx="4"
        />
        {/* Backrest */}
        <rect
          x={sofaX}
          y={sofaY + sofaD - 10}
          width={sofaW}
          height={10}
          fill="#334155"
          stroke="#475569"
          strokeWidth="1"
          rx="2"
        />
        {/* Left & Right Armrests */}
        <rect
          x={sofaX}
          y={sofaY}
          width={10}
          height={sofaD}
          fill="#334155"
          stroke="#475569"
          strokeWidth="0.8"
          rx="2"
        />
        <rect
          x={sofaX + sofaW - 10}
          y={sofaY}
          width={10}
          height={sofaD}
          fill="#334155"
          stroke="#475569"
          strokeWidth="0.8"
          rx="2"
        />
        {/* Seat Cushion Divider Lines */}
        <line
          x1={sofaX + sofaW * 0.36}
          y1={sofaY}
          x2={sofaX + sofaW * 0.36}
          y2={sofaY + sofaD - 10}
          stroke="#475569"
          strokeWidth="0.8"
        />
        <line
          x1={sofaX + sofaW * 0.64}
          y1={sofaY}
          x2={sofaX + sofaW * 0.64}
          y2={sofaY + sofaD - 10}
          stroke="#475569"
          strokeWidth="0.8"
        />

        {/* Media / TV Console on opposite wall */}
        {rl >= 100 && (
          <g>
            <rect
              x={tvX}
              y={ry + 8}
              width={tvW}
              height={14}
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="1"
              rx="2"
            />
            {/* TV Screen Stand */}
            <line
              x1={tvX + 12}
              y1={ry + 15}
              x2={tvX + tvW - 12}
              y2={ry + 15}
              stroke="#38bdf8"
              strokeWidth="2"
            />
          </g>
        )}
      </g>
    );
  }

  // 3. KITCHEN (Open / Closed)
  if (type.includes('kitchen') || name.includes('kitchen')) {
    const counterD = 24; // standard 2ft counter = 24px at 12px/ft or 40px at 20px/ft
    const counterW = Math.min(rw - 16, 120);

    return (
      <g className="cad-symbol kitchen-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Main Countertop Run */}
        <rect
          x={rx + 8}
          y={ry + 8}
          width={counterW}
          height={counterD}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1.2"
          rx="2"
        />

        {/* Double-Basin Stainless Steel Sink */}
        <g transform={`translate(${rx + 16}, ${ry + 11})`}>
          <rect x={0} y={0} width={32} height={18} fill="#0f172a" stroke="#64748b" strokeWidth="1" rx="2" />
          <rect x={2} y={2} width={13} height={14} fill="#1e293b" stroke="#94a3b8" strokeWidth="0.8" rx="1" />
          <rect x={17} y={2} width={13} height={14} fill="#1e293b" stroke="#94a3b8" strokeWidth="0.8" rx="1" />
          <circle cx={16} cy={2} r={1.8} fill="#38bdf8" />
        </g>

        {/* 4-Burner Stovetop Unit */}
        {counterW >= 80 && (
          <g transform={`translate(${rx + counterW - 44}, ${ry + 11})`}>
            <rect x={0} y={0} width={34} height={18} fill="#0f172a" stroke="#64748b" strokeWidth="1" rx="2" />
            <circle cx={8} cy={5} r={3.2} fill="none" stroke="#f43f5e" strokeWidth="0.9" />
            <circle cx={26} cy={5} r={3.2} fill="none" stroke="#f43f5e" strokeWidth="0.9" />
            <circle cx={8} cy={13} r={3.2} fill="none" stroke="#f43f5e" strokeWidth="0.9" />
            <circle cx={26} cy={13} r={3.2} fill="none" stroke="#f43f5e" strokeWidth="0.9" />
          </g>
        )}

        {/* Refrigerator Unit */}
        {rl >= 80 && (
          <g transform={`translate(${rx + 8}, ${ry + 36})`}>
            <rect x={0} y={0} width={24} height={24} fill="#0f172a" stroke="#64748b" strokeWidth="1.2" rx="2" />
            <text x={12} y={15} textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold">REF</text>
          </g>
        )}
      </g>
    );
  }

  // 4. DINING
  if (type.includes('dining') || name.includes('dining')) {
    const tableW = Math.min(rw * 0.55, 75);
    const tableL = Math.min(rl * 0.52, 50);
    const tableX = rx + (rw - tableW) / 2;
    const tableY = ry + (rl - tableL) / 2;

    return (
      <g className="cad-symbol dining-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Dining Table */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={tableL}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1.2"
          rx="6"
        />

        {/* Chairs (North and South) */}
        {[-1, 1].forEach((dir, i) => {
          const cy = dir === -1 ? tableY - 9 : tableY + tableL + 1;
          const chairW = tableW * 0.32;
          return (
            <React.Fragment key={i}>
              <rect x={tableX + tableW * 0.12} y={cy} width={chairW} height={8} fill="#334155" stroke="#64748b" strokeWidth="0.8" rx="2" />
              <rect x={tableX + tableW * 0.56} y={cy} width={chairW} height={8} fill="#334155" stroke="#64748b" strokeWidth="0.8" rx="2" />
            </React.Fragment>
          );
        })}
      </g>
    );
  }

  // 5. BATHROOM / WASHROOM / TOILET
  if (type.includes('bath') || type.includes('toilet') || name.includes('bath') || name.includes('washroom') || name.includes('wc')) {
    return (
      <g className="cad-symbol bathroom-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Toilet WC (Cistern Tank + Oval Bowl) */}
        <g transform={`translate(${rx + 10}, ${ry + 8})`}>
          {/* Water Cistern */}
          <rect x={0} y={0} width={22} height={9} fill="#334155" stroke="#64748b" strokeWidth="1" rx="2" />
          {/* Oval Bowl */}
          <ellipse cx={11} cy={17} rx={7.5} ry={10} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
          <ellipse cx={11} cy={18} rx={4.5} ry={6} fill="#0f172a" stroke="#64748b" strokeWidth="0.6" />
        </g>

        {/* Vanity Wash Basin */}
        {rw >= 60 && (
          <g transform={`translate(${rx + rw - 30}, ${ry + 8})`}>
            <rect x={0} y={0} width={22} height={16} fill="#1e293b" stroke="#475569" strokeWidth="1" rx="2" />
            <ellipse cx={11} cy={8} rx={7.5} ry={5} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" />
            <circle cx={11} cy={4} r={1.5} fill="#38bdf8" />
          </g>
        )}

        {/* Shower Tray Area */}
        {rl >= 80 && (
          <g transform={`translate(${rx + 8}, ${ry + rl - 36})`}>
            <rect x={0} y={0} width={rw - 16} height={28} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx={(rw - 16) / 2} cy={14} r={3} fill="#0f172a" stroke="#64748b" strokeWidth="0.8" />
          </g>
        )}
      </g>
    );
  }

  // 6. CAR PARKING / PORCH
  if (type.includes('parking') || name.includes('parking') || name.includes('porch') || name.includes('garage')) {
    const carW = Math.min(rw * 0.72, 85);
    const carL = Math.min(rl * 0.78, 140);
    const carX = rx + (rw - carW) / 2;
    const carY = ry + (rl - carL) / 2;

    return (
      <g className="cad-symbol parking-symbol" pointerEvents="none" opacity={isSelected ? 0.95 : 0.85}>
        {/* Parking Bay Striping */}
        <line x1={rx + 6} y1={ry + 8} x2={rx + 6} y2={ry + rl - 8} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />
        <line x1={rx + rw - 6} y1={ry + 8} x2={rx + rw - 6} y2={ry + rl - 8} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />

        {/* Automobile CAD Silhouette */}
        <g transform={`translate(${carX}, ${carY})`}>
          {/* Car Body Outer Shell */}
          <path
            d={`M 10 0 
                L ${carW - 10} 0 
                Q ${carW} 0 ${carW} 12 
                L ${carW} ${carL - 14} 
                Q ${carW} ${carL} ${carW - 12} ${carL} 
                L 12 ${carL} 
                Q 0 ${carL} 0 ${carL - 14} 
                L 0 12 
                Q 0 0 10 0 Z`}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1.2"
          />

          {/* Front Windshield */}
          <path
            d={`M 8 28 L ${carW - 8} 28 L ${carW - 12} 42 L 12 42 Z`}
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth="0.9"
          />

          {/* Roof Panel */}
          <rect
            x={11}
            y={44}
            width={carW - 22}
            height={carL * 0.42}
            fill="#334155"
            stroke="#475569"
            strokeWidth="0.8"
            rx="3"
          />

          {/* Rear Windshield */}
          <path
            d={`M 12 ${carL - 32} L ${carW - 12} ${carL - 32} L ${carW - 8} ${carL - 20} L 8 ${carL - 20} Z`}
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth="0.9"
          />

          {/* Headlights */}
          <ellipse cx={8} cy={4} rx={4} ry={2} fill="#fef08a" />
          <ellipse cx={carW - 8} cy={4} rx={4} ry={2} fill="#fef08a" />

          {/* Taillights */}
          <ellipse cx={8} cy={carL - 3} rx={4} ry={1.8} fill="#f43f5e" />
          <ellipse cx={carW - 8} cy={carL - 3} rx={4} ry={1.8} fill="#f43f5e" />
        </g>
      </g>
    );
  }

  // 7. BALCONY / TERRACE / VERANDAH
  if (type.includes('balcony') || name.includes('balcony') || name.includes('terrace') || name.includes('deck')) {
    return (
      <g className="cad-symbol balcony-symbol" pointerEvents="none" opacity={0.7}>
        {/* Floor Decking Slat Lines */}
        {Array.from({ length: Math.min(8, Math.floor(rl / 14)) }).map((_, idx) => (
          <line
            key={idx}
            x1={rx + 6}
            y1={ry + (idx + 1) * 14}
            x2={rx + rw - 6}
            y2={ry + (idx + 1) * 14}
            stroke="#475569"
            strokeWidth="0.8"
            strokeDasharray="4 2"
          />
        ))}
        {/* Perimeter Safety Railing Post Marks */}
        <circle cx={rx + 6} cy={ry + 6} r={2.5} fill="#64748b" />
        <circle cx={rx + rw - 6} cy={ry + 6} r={2.5} fill="#64748b" />
        <circle cx={rx + 6} cy={ry + rl - 6} r={2.5} fill="#64748b" />
        <circle cx={rx + rw - 6} cy={ry + rl - 6} r={2.5} fill="#64748b" />
      </g>
    );
  }

  return null;
}
