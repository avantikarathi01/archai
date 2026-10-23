import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  TrendingDown,
  Layers,
  Compass,
  Droplets,
  Sun,
  Wind,
  Check,
  Sparkles,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Sliders,
  DollarSign,
  Maximize2,
  Building,
  ArrowRight
} from 'lucide-react';
import {
  optimizeDesignCost,
  fetchCategorizedBOQ,
  fetchClimateInsights
} from '../../services/api';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AED', symbol: 'AED', label: 'AED (د.إ)' },
];

const QUALITY_TIERS = [
  { id: 'economy', label: 'Economy', mult: '0.78x', desc: 'Fly-ash masonry, basic vitrified, flush doors, OBD paint' },
  { id: 'standard', label: 'Standard', mult: '1.0x', desc: 'RCC frame, double-charged tiles, branded CP, UPVC windows' },
  { id: 'premium', label: 'Premium', mult: '1.38x', desc: 'Large format tiles, Italian marble, designer concealed CP, teak doors' },
];

export function formatCurrency(val, code = 'INR') {
  const num = Math.round(Number(val) || 0);
  if (code === 'INR') return `₹${num.toLocaleString('en-IN')}`;
  if (code === 'USD') return `$${num.toLocaleString('en-US')}`;
  if (code === 'EUR') return `€${num.toLocaleString('de-DE')}`;
  if (code === 'GBP') return `£${num.toLocaleString('en-GB')}`;
  if (code === 'AED') return `AED ${num.toLocaleString('en-AE')}`;
  return `${code} ${num.toLocaleString()}`;
}

export default function CostOptimizer({ layout, rawPrompt, requirements, onSelectAlternative }) {
  const [currency, setCurrency] = useState('INR');
  const [tier, setTier] = useState('standard');
  const [userBudget, setUserBudget] = useState(currency === 'INR' ? 5000000 : 75000);
  const [loading, setLoading] = useState(false);
  const [optimizationData, setOptimizationData] = useState(null);
  const [activeAlternativeId, setActiveAlternativeId] = useState('option_balanced');
  const [expandedCategories, setExpandedCategories] = useState({
    substructure: true,
    superstructure: true,
    flooring: true,
    openings: false,
    plumbing: false,
    electrical: false,
    painting: false,
    plunge_pool: true,
    stair_balcony: false,
  });
  const [customUnitRates, setCustomUnitRates] = useState({});
  const [subTab, setSubTab] = useState('comparison'); // 'comparison' | 'boq' | 'buildability'

  // Update budget placeholder default when currency changes
  const handleCurrencyChange = (newCurr) => {
    setCurrency(newCurr);
    if (newCurr === 'INR' && userBudget < 500000) {
      setUserBudget(5000000);
    } else if (newCurr !== 'INR' && userBudget > 500000) {
      setUserBudget(75000);
    }
  };

  // Run multi-option cost optimization on mount or when prompt/requirements change
  const runOptimization = async () => {
    if (!layout && !requirements && !rawPrompt) return;
    setLoading(true);

    const res = await optimizeDesignCost({
      prompt: rawPrompt,
      requirements: requirements || layout?.requirements,
      plotDimensions: layout?.plot,
      userBudget: Number(userBudget),
      currency,
      tier,
      unitRates: customUnitRates,
    });

    if (res.ok && res.data) {
      setOptimizationData(res.data);
      // Auto-select the balanced option by default or keep current if valid
      const existingMatch = res.data.options?.find(o => o.id === activeAlternativeId);
      if (!existingMatch && res.data.options?.[0]) {
        setActiveAlternativeId(res.data.options[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    runOptimization();
  }, [currency, tier]);

  // Find currently active alternative
  const activeAlternative = useMemo(() => {
    if (!optimizationData?.options) return null;
    return optimizationData.options.find(o => o.id === activeAlternativeId) || optimizationData.options[0];
  }, [optimizationData, activeAlternativeId]);

  // Current active BOQ and Buildability
  const activeBOQ = activeAlternative?.boq;
  const activeBuildability = activeAlternative?.buildability;

  // Toggle category accordion
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Handle in-place unit rate editing
  const handleRateChange = (itemId, newRate) => {
    const val = Number(newRate);
    if (isNaN(val) || val < 0) return;
    setCustomUnitRates(prev => ({
      ...prev,
      [itemId]: val,
    }));
  };

  // Reset custom rates
  const handleResetRates = () => {
    setCustomUnitRates({});
    runOptimization();
  };

  // Apply selected alternative layout to the rest of the application
  const handleApplyAlternative = (alt) => {
    setActiveAlternativeId(alt.id);
    if (onSelectAlternative) {
      onSelectAlternative(alt);
    }
  };

  // Export BOQ to CSV
  const exportCSV = () => {
    if (!activeBOQ) return;
    let csv = `Category,Item ID,Description,Quantity,Unit,Unit Rate (${currency}),Subtotal (${currency}),Rate Source\n`;

    activeBOQ.categories.forEach(cat => {
      cat.items.forEach(it => {
        const cleanDesc = `"${it.description.replace(/"/g, '""')}"`;
        csv += `"${cat.name}","${it.id}",${cleanDesc},${it.quantity},"${it.unit}",${it.unitRate},${it.subtotal},"${it.source}"\n`;
      });
    });

    // Indirect works
    csv += `\nDirect Works Subtotal,,,,,,${activeBOQ.indirectWorks.directWorksCost}\n`;
    csv += `Contractor Overheads (10%),,,,,,${activeBOQ.indirectWorks.contractorOverhead}\n`;
    csv += `Unforeseen Contingency (3%),,,,,,${activeBOQ.indirectWorks.contingency}\n`;
    csv += `Statutory Tax / GST (18%),,,,,,${activeBOQ.indirectWorks.taxAmount}\n`;
    csv += `GRAND TOTAL ESTIMATED COST,,,,,,${activeBOQ.indirectWorks.grandTotalCost}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ArchAI_BOQ_${activeAlternative.id}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export detailed JSON
  const exportJSON = () => {
    if (!optimizationData) return;
    const jsonStr = JSON.stringify(optimizationData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ArchAI_Cost_Optimization_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '1.25rem', color: '#f8fafc', maxWidth: '1440px', margin: '0 auto' }}>

      {/* Top Header & Interactive Parameter Controls */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Intelligence Hub
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Cost Intelligence & Design Optimizer
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Real measurable quantity takeoff (masonry, RCC slabs, plunge pools, finishes) & 3-option comparative solver.
            </p>
          </div>

          {/* Quick Action Export Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={exportCSV}
              disabled={!activeBOQ}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Download priced bill of quantities in spreadsheet format"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={exportJSON}
              disabled={!optimizationData}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Export complete 3-option optimization data schema"
            >
              <Download size={13} /> Export JSON
            </button>
            <button
              onClick={runOptimization}
              disabled={loading}
              className="btn btn-primary"
              style={{
                fontSize: '0.78rem',
                padding: '0.45rem 0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #0284c7, #4f46e5)'
              }}
            >
              <RotateCcw size={13} className={loading ? 'spin' : ''} />
              {loading ? 'Solving...' : 'Recalculate'}
            </button>
          </div>
        </div>

        {/* Parameter Sliders & Selectors */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}>

          {/* 1. Target Budget & Currency */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
              Target Budget & Currency
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  borderRadius: '8px',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="number"
                value={userBudget}
                onChange={(e) => setUserBudget(e.target.value)}
                step={currency === 'INR' ? 100000 : 5000}
                placeholder="Enter allocated budget"
                style={{
                  flex: 1,
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* 2. Construction Quality Tier */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
              Specification Tier
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {QUALITY_TIERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTier(t.id)}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: tier === t.id ? 700 : 500,
                    borderRadius: '8px',
                    border: 'none',
                    background: tier === t.id ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'transparent',
                    color: tier === t.id ? '#0f172a' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={t.desc}
                >
                  {t.label} <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>({t.mult})</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Sub-View Navigation Tabs */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
              Analysis View
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setSubTab('comparison')}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: subTab === 'comparison' ? 700 : 500,
                  borderRadius: '8px',
                  border: 'none',
                  background: subTab === 'comparison' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                  color: subTab === 'comparison' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                <Sliders size={13} /> 3 Alternatives
              </button>
              <button
                onClick={() => setSubTab('boq')}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: subTab === 'boq' ? 700 : 500,
                  borderRadius: '8px',
                  border: 'none',
                  background: subTab === 'boq' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                  color: subTab === 'boq' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                <Calculator size={13} /> Detailed BOQ
              </button>
              <button
                onClick={() => setSubTab('buildability')}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: subTab === 'buildability' ? 700 : 500,
                  borderRadius: '8px',
                  border: 'none',
                  background: subTab === 'buildability' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                  color: subTab === 'buildability' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                <Sun size={13} /> Climate & Spans
              </button>
            </div>
          </div>
        </div>

        {/* Real-Time Budget HUD Variance Banner */}
        {activeBOQ?.summary?.budgetComparison && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: activeBOQ.summary.budgetComparison.isUnderBudget
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: activeBOQ.summary.budgetComparison.isUnderBudget
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {activeBOQ.summary.budgetComparison.isUnderBudget ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <AlertCircle size={18} color="#ef4444" />
              )}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: activeBOQ.summary.budgetComparison.isUnderBudget ? '#34d399' : '#f87171' }}>
                  {activeBOQ.summary.budgetComparison.isUnderBudget ? 'WITHIN ALLOCATED BUDGET' : 'BUDGET SHORTFALL ALERT'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', marginLeft: '0.6rem' }}>
                  {activeBOQ.summary.budgetComparison.shortfallMessage}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Target: </span>
                <strong style={{ color: '#f8fafc' }}>{formatCurrency(userBudget, currency)}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Estimate: </span>
                <strong style={{ color: activeBOQ.summary.budgetComparison.isUnderBudget ? '#34d399' : '#f87171' }}>
                  {activeBOQ.summary.formattedGrandTotal}
                </strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Unit Rate: </span>
                <strong style={{ color: '#38bdf8' }}>{activeBOQ.summary.formattedRatePerSqFt}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SUB-TAB 1: 3-OPTION DESIGN ALTERNATIVES COMPARISON
          ===================================================================== */}
      {subTab === 'comparison' && optimizationData?.options && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Budget-Aware Multi-Option Layout Alternatives
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                All 3 alternatives strictly preserve 100% of requested rooms (parking, staircase, storage, plunge pools). Click to switch active layout in 2D & 3D viewers.
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
              Active Design: <strong>{activeAlternative?.name}</strong>
            </span>
          </div>

          {/* 3 Comparison Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem'
          }}>
            {optimizationData.options.map(opt => {
              const isActive = opt.id === activeAlternativeId;

              return (
                <div
                  key={opt.id}
                  style={{
                    background: isActive ? 'rgba(30, 58, 138, 0.25)' : 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(12px)',
                    border: isActive ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isActive ? '0 12px 36px rgba(56, 189, 248, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Card Top Pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span style={{
                      background: opt.deltas.isLowestCost
                        ? 'rgba(16, 185, 129, 0.2)'
                        : (opt.isRecommended ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)'),
                      color: opt.deltas.isLowestCost
                        ? '#34d399'
                        : (opt.isRecommended ? '#38bdf8' : '#c084fc'),
                      border: `1px solid ${opt.deltas.isLowestCost ? 'rgba(16, 185, 129, 0.4)' : (opt.isRecommended ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.4)')}`,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {opt.badge}
                    </span>

                    {isActive && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.15)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px'
                      }}>
                        <Check size={12} /> Active In Viewers
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#f8fafc' }}>
                      {opt.name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem', minHeight: '36px' }}>
                      {opt.tagline}
                    </p>

                    {/* Key Pricing & Space Highlight */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      borderRadius: '12px',
                      padding: '0.9rem',
                      marginBottom: '1rem',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Estimated Cost</span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: opt.deltas.isLowestCost ? '#34d399' : '#f59e0b',
                        }}>
                          {opt.deltas.formattedCostDelta}
                        </span>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                        {opt.metrics.formattedGrandTotal}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                        {opt.metrics.formattedRatePerSqFt}
                      </div>
                    </div>

                    {/* Architectural Performance Metrics Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      fontSize: '0.78rem'
                    }}>
                      <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.5rem', borderRadius: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Carpet Area</div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{opt.metrics.totalCarpetAreaSqFt} sq ft</strong>
                        <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{opt.metrics.carpetEfficiencyPercent}% efficiency</div>
                      </div>

                      <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.5rem', borderRadius: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Daylight Index</div>
                        <strong style={{ color: '#38bdf8', fontSize: '0.9rem' }}>{opt.metrics.daylightScore}/100</strong>
                        <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Morning sun access</div>
                      </div>

                      <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.5rem', borderRadius: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Plumbing Stack</div>
                        <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>{opt.metrics.plumbingStackScore}/100</strong>
                        <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Vertical wet core align</div>
                      </div>

                      <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.5rem', borderRadius: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Max Clear Span</div>
                        <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{opt.metrics.maxClearSpanFeet} ft</strong>
                        <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Standard slab fit</div>
                      </div>
                    </div>

                    {/* Advantages List */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>
                        Value & Architectural Merits
                      </span>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                        {opt.advantages.slice(0, 2).map((adv, idx) => (
                          <li key={idx} style={{ marginBottom: '0.2rem' }}>{adv}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Switch to this layout button */}
                  <button
                    onClick={() => handleApplyAlternative(opt)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: isActive
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #0284c7, #4f46e5)',
                      color: '#f8fafc',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isActive ? (
                      <>
                        <Check size={14} /> Currently Active in Viewers
                      </>
                    ) : (
                      <>
                        Switch Active Design to This Option <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Side-by-Side Comparison Matrix Table */}
          {optimizationData.comparisonMatrix && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              marginBottom: '2rem'
            }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Side-by-Side Architectural & Civil Engineering Metric Matrix
                </h4>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '0.75rem 1.25rem', color: '#94a3b8' }}>Evaluation Criterion</th>
                      {optimizationData.options.map(opt => (
                        <th key={opt.id} style={{ padding: '0.75rem 1rem', color: opt.id === activeAlternativeId ? '#38bdf8' : '#f8fafc', fontWeight: 700 }}>
                          {opt.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationData.comparisonMatrix.map(row => (
                      <tr key={row.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '0.7rem 1.25rem', color: '#cbd5e1', fontWeight: 600 }}>
                          {row.label}
                        </td>
                        {optimizationData.options.map(opt => {
                          const val = row.values[opt.id];
                          return (
                            <td key={opt.id} style={{ padding: '0.7rem 1rem', color: opt.id === activeAlternativeId ? '#38bdf8' : '#f8fafc' }}>
                              {val?.formatted || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: DETAILED ITEMIZE BILL OF QUANTITIES (BOQ) TABLE
          ===================================================================== */}
      {subTab === 'boq' && activeBOQ && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Categorized Bill of Quantities ({activeAlternative?.name})
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Quantities derived directly from architectural CAD geometry. Edit unit rates inline to simulate cost variants.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleResetRates}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Restore CPWD / Standard market reference rates"
              >
                <RotateCcw size={12} /> Reset Standard Rates
              </button>
            </div>
          </div>

          {/* Categorized Line Items Accordion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {activeBOQ.categories.map((cat, catIdx) => {
              const isExpanded = expandedCategories[cat.id] ?? false;

              return (
                <div
                  key={cat.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      padding: '0.85rem 1.25rem',
                      background: 'rgba(30, 41, 59, 0.5)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {isExpanded ? <ChevronDown size={16} color="#38bdf8" /> : <ChevronRight size={16} color="#94a3b8" />}
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>0{catIdx + 1}.</span>
                      <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>{cat.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({cat.items.length} items)</span>
                    </div>

                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8' }}>
                      {cat.currencySymbol}{cat.subtotal.toLocaleString()}
                    </div>
                  </div>

                  {/* Items Table */}
                  {isExpanded && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <th style={{ padding: '0.6rem 1.25rem', color: '#94a3b8', width: '38%' }}>Work Specification</th>
                            <th style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', textAlign: 'right', width: '12%' }}>Quantity</th>
                            <th style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', width: '8%' }}>Unit</th>
                            <th style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', textAlign: 'right', width: '16%' }}>Unit Rate ({currency})</th>
                            <th style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', textAlign: 'right', width: '14%' }}>Subtotal</th>
                            <th style={{ padding: '0.6rem 1rem', color: '#94a3b8', width: '12%' }}>Basis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.items.map(it => (
                            <tr key={it.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '0.65rem 1.25rem' }}>
                                <div style={{ color: '#f8fafc', fontWeight: 600 }}>{it.description}</div>
                                {it.notes && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{it.notes}</div>}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#f8fafc', fontWeight: 600 }}>
                                {Number(it.quantity).toLocaleString()}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>
                                {it.unit}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  value={it.unitRate}
                                  onChange={(e) => handleRateChange(it.id, e.target.value)}
                                  style={{
                                    width: '85px',
                                    background: 'rgba(30, 41, 59, 0.7)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '6px',
                                    color: '#38bdf8',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.4rem',
                                    textAlign: 'right',
                                    outline: 'none'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#f8fafc', fontWeight: 700 }}>
                                {cat.currencySymbol}{Number(it.subtotal).toLocaleString()}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  color: '#94a3b8',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  padding: '0.2rem 0.4rem',
                                  borderRadius: '4px'
                                }}>
                                  {it.source}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Indirect Works, Overheads, Taxes & Final Summary Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            borderRadius: '16px',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#f8fafc' }}>
              Project Cost Consolidation & Statutory Allowances
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              {/* Left Column: Breakdown items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.85rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Direct Works Subtotal:</span>
                  <strong style={{ color: '#f8fafc' }}>{formatCurrency(activeBOQ.indirectWorks.directWorksCost, currency)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.85rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Contractor Overheads & Scaffolding (10%):</span>
                  <strong style={{ color: '#f8fafc' }}>{formatCurrency(activeBOQ.indirectWorks.contractorOverhead, currency)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.85rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Civil & Soil Contingency (3%):</span>
                  <strong style={{ color: '#f8fafc' }}>{formatCurrency(activeBOQ.indirectWorks.contingency, currency)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.85rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Statutory Works Contract Tax / GST (18%):</span>
                  <strong style={{ color: '#f8fafc' }}>{formatCurrency(activeBOQ.indirectWorks.taxAmount, currency)}</strong>
                </div>
              </div>

              {/* Right Column: Grand Total Display */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Grand Total Construction Estimate
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em', margin: '0.3rem 0' }}>
                  {activeBOQ.summary.formattedGrandTotal}
                </div>
                <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                  Effective Rate: <strong style={{ color: '#f8fafc' }}>{activeBOQ.summary.formattedRatePerSqFt}</strong> ({activeBOQ.quantities.totalBuiltUpArea} sq ft built-up area)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: CLIMATE INTELLIGENCE & BUILDABILITY STUDIO
          ===================================================================== */}
      {subTab === 'buildability' && activeBuildability && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Climate Intelligence, Sun Path & Structural Buildability
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Orientation analysis, cross-ventilation rating, vertical plumbing stack grouping, and elevated plunge pool structural load checks.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

            {/* 1. Orientation & Sun Path */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sun size={18} color="#f59e0b" />
                  <strong style={{ fontSize: '0.95rem' }}>Orientation & Sun Angles</strong>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                  {activeBuildability.daylight.overallDaylightScore}/100 Score
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.75rem' }}>
                {activeBuildability.daylight.summary}
              </p>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                <div style={{ marginBottom: '0.3rem' }}>
                  <strong style={{ color: '#38bdf8' }}>Morning Sun (East):</strong> {activeBuildability.daylight.morningSunRooms.join(', ') || 'None'}
                </div>
                <div>
                  <strong style={{ color: '#f97316' }}>Afternoon Thermal Gain (West):</strong> {activeBuildability.daylight.afternoonHeatRooms.join(', ') || 'None (Buffer Zone)'}
                </div>
              </div>
            </div>

            {/* 2. Cross-Ventilation */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wind size={18} color="#38bdf8" />
                  <strong style={{ fontSize: '0.95rem' }}>Cross-Ventilation Potential</strong>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                  {activeBuildability.ventilation.overallVentilationScore}/100 Score
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.75rem' }}>
                {activeBuildability.ventilation.summary}
              </p>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Dual-aspect corner windows in private bedroom suites promote natural displacement ventilation, reducing transitional season HVAC runtimes.
              </div>
            </div>

            {/* 3. Vertical Plumbing Stack Alignment */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Droplets size={18} color="#06b6d4" />
                  <strong style={{ fontSize: '0.95rem' }}>Vertical Plumbing Stack</strong>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                  {activeBuildability.plumbing.plumbingStackScore}/100 Stack Score
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.75rem' }}>
                {activeBuildability.plumbing.summary}
              </p>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {activeBuildability.plumbing.recommendation}
              </div>
            </div>

            {/* 4. Structural Spans */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building size={18} color="#a855f7" />
                  <strong style={{ fontSize: '0.95rem' }}>Clear Spans & Slab Rigidity</strong>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', background: 'rgba(168, 85, 247, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                  {activeBuildability.structural.slabStandard}
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.75rem' }}>
                {activeBuildability.structural.summary}
              </p>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Maximum column-free span of {activeBuildability.structural.maxClearSpanFeet} ft allows uniform slab casting without heavy secondary transfer girders.
              </div>
            </div>
          </div>

          {/* Elevated Plunge Pool Structural Advisory Banner */}
          {activeBuildability.elevatedPool?.hasElevatedPool && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <ShieldAlert size={20} color="#f87171" />
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
                  First-Floor Plunge Pool Structural Load Advisory (~{activeBuildability.elevatedPool.totalImposedLoadMetricTons} Metric Tons)
                </h4>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#fecaca', margin: '0 0 0.75rem' }}>
                {activeBuildability.elevatedPool.summary}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {activeBuildability.elevatedPool.pools[0]?.mandatoryEngineeringDirectives.map((dir, idx) => (
                  <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                    • {dir}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practical Engineering Recommendations List */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#f8fafc' }}>
              Actionable Civil & MEP Engineering Recommendations
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
              {activeBuildability.recommendations?.map((rec, idx) => (
                <div key={idx} style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  borderLeft: rec.priority === 'critical'
                    ? '3px solid #ef4444'
                    : (rec.priority === 'high' ? '3px solid #f59e0b' : '3px solid #38bdf8')
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {rec.category}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: rec.priority === 'critical' ? '#f87171' : (rec.priority === 'high' ? '#fcd34d' : '#38bdf8')
                    }}>
                      {rec.priority}
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.84rem', color: '#f8fafc', display: 'block', marginBottom: '0.25rem' }}>
                    {rec.title}
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: '1.45' }}>
                    {rec.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Regulatory / Engineering Disclaimer Banner */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '0.85rem 1.25rem',
        fontSize: '0.72rem',
        color: '#64748b',
        lineHeight: '1.5',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem'
      }}>
        <AlertCircle size={15} color="#64748b" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          {optimizationData?.disclaimer || activeBOQ?.disclaimer}
        </div>
      </div>

    </div>
  );
}
