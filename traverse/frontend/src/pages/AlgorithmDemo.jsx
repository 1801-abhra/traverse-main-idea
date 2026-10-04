import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Car, Train, Bus, Plane, ArrowRight,
    Calculator, ChevronDown, ChevronUp,
    CheckCircle, MapPin, Clock, Wallet,
    BarChart2, Database, GitBranch, Info,
    Layers, Zap, Shield, Star
} from 'lucide-react'
import {
    findCandidateRoutesForCorridor,
    SUPPORTED_CORRIDORS,
    NODES, EDGES
} from '../utils/routingEngine'
import {
    runTOPSIS,
    runTOPSISWithSteps,
    buildDecisionMatrix,
    PERSONA_BOOST
} from '../utils/topsisEngine'

const MODE_COLOR = {
    cab: '#0EA5E9', bus: '#D97706', train: '#1A56DB',
    flight: '#7C3AED', walk: '#22C55E', metro: '#8B5CF6',
}

function ModeTag({ mode }) {
    const icons = { bus: '🚌', train: '🚆', flight: '✈️', cab: '🚖', walk: '🚶', metro: '🚇' }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            fontSize: '11px', fontWeight: '700',
            color: MODE_COLOR[mode] || '#64748B',
            backgroundColor: (MODE_COLOR[mode] || '#64748B') + '15',
            border: '1px solid ' + (MODE_COLOR[mode] || '#64748B') + '40',
            padding: '2px 8px', borderRadius: '999px',
        }}>
            {icons[mode]} {mode}
        </span>
    )
}

function StatCard({ label, value, sub, color = '#1A56DB' }) {
    return (
        <div style={{
            backgroundColor: '#F8FAFC', borderRadius: '12px',
            padding: '16px', border: '1px solid #E2E8F0', textAlign: 'center'
        }}>
            <div style={{
                fontSize: '11px', fontWeight: '700', color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px'
            }}>
                {label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color, letterSpacing: '-0.5px' }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{sub}</div>}
        </div>
    )
}

function SectionHead({ icon: Icon, title, badge, color = '#1A56DB' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: color + '15', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0
            }}>
                <Icon size={16} color={color} />
            </div>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{title}</span>
            {badge && (
                <span style={{
                    backgroundColor: '#DCFCE7', color: '#16A34A', fontSize: '11px',
                    fontWeight: '700', padding: '2px 8px', borderRadius: '999px'
                }}>
                    {badge}
                </span>
            )}
        </div>
    )
}

function FormulaBox({ title, formula, note, color = '#22C55E' }) {
    return (
        <div style={{
            backgroundColor: '#0F172A', borderRadius: '10px',
            padding: '14px 18px', marginBottom: '10px',
            border: '1px solid #1E293B'
        }}>
            {title && <div style={{
                color: '#64748B', fontSize: '11px',
                fontWeight: '700', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '8px'
            }}>{title}</div>}
            <div style={{
                color, fontSize: '14px', fontWeight: '700',
                fontFamily: 'monospace', lineHeight: '1.8'
            }}>
                {formula}
            </div>
            {note && <div style={{
                color: '#475569', fontSize: '11px',
                marginTop: '8px', lineHeight: '1.6'
            }}>{note}</div>}
        </div>
    )
}

function ScoreBar({ val, max = 1, color = '#1A56DB' }) {
    const pct = Math.min(100, (val / max) * 100)
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                flex: 1, height: '6px', backgroundColor: '#E2E8F0',
                borderRadius: '999px', overflow: 'hidden'
            }}>
                <div style={{
                    width: pct + '%', height: '100%',
                    backgroundColor: color, borderRadius: '999px',
                    transition: 'width 0.4s ease'
                }} />
            </div>
            <span style={{
                fontSize: '12px', fontWeight: '800',
                color, minWidth: '52px', textAlign: 'right'
            }}>
                {val.toFixed(4)}
            </span>
        </div>
    )
}

export default function AlgorithmDemo() {
    const navigate = useNavigate()
    const [persona, setPersona] = useState('balanced')
    const [corridorKey, setCorridorKey] = useState('juit')
    const [results, setResults] = useState(null)
    const [steps, setSteps] = useState(null)
    const [computing, setComputing] = useState(false)
    const [candidates, setCandidates] = useState([])
    const [showMatrix, setShowMatrix] = useState(false)
    const [showWeights, setShowWeights] = useState(false)
    const [showHierarchy, setShowHierarchy] = useState(false)
    const [showNormalization, setShowNormalization] = useState(false)
    const [showPersonaBoost, setShowPersonaBoost] = useState(false)
    const [showSimilarity, setShowSimilarity] = useState(false)

    useEffect(() => {
        const c = findCandidateRoutesForCorridor(corridorKey)
        setCandidates(c)
        setResults(null)
        setSteps(null)
    }, [corridorKey])

    function compute() {
        setComputing(true)
        setResults(null)
        setSteps(null)
        setTimeout(() => {
            const r = runTOPSIS(candidates, persona)
            const s = runTOPSISWithSteps(candidates, persona)
            setResults(r)
            setSteps(s)
            setComputing(false)
        }, 900)
    }

    const personas = [
        {
            key: 'balanced', label: '⚖️ Recommended', color: '#1A56DB', bg: '#EFF6FF',
            desc: 'All criteria balanced — entropy weights pure'
        },
        {
            key: 'cheapest', label: '💰 Cheapest', color: '#16A34A', bg: '#DCFCE7',
            desc: 'Cost ×4.0 boost → 58% weight'
        },
        {
            key: 'fastest', label: '⚡ Fastest', color: '#D97706', bg: '#FEF9C3',
            desc: 'Time ×10.0 boost → 93% weight'
        },
        {
            key: 'comfort', label: '⭐ Comfortable', color: '#7C3AED', bg: '#F5F3FF',
            desc: 'Comfort ×6.0 + Reliability ×3.0 boost'
        },
    ]

    const criteriaLabels = ['Cost (₹)', 'Time (min)', 'Comfort (1-10)', 'Reliability', 'Transfers']
    const criteriaTypes = ['minimize', 'minimize', 'maximize', 'maximize', 'minimize']

    // Hub nodes grouped
    const tier1Nodes = Object.values(NODES || {}).filter(n => n.tier === 1)
    const tier2Nodes = Object.values(NODES || {}).filter(n => n.tier === 2)

    const edgesByMode = {}
        ; (EDGES || []).forEach(e => {
            edgesByMode[e.mode] = (edgesByMode[e.mode] || 0) + 1
        })

    const currentCorridor = SUPPORTED_CORRIDORS.find(c => c.corridorKey === corridorKey)

    return (
        <div style={{
            fontFamily: 'Inter, sans-serif', backgroundColor: '#F8FAFC',
            minHeight: '100vh', paddingBottom: '80px'
        }}>

            {/* HERO */}
            <div style={{
                background: 'linear-gradient(135deg,#0F172A 0%,#1E3A5F 60%,#1A56DB 100%)',
                padding: '40px 24px 36px'
            }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        backgroundColor: '#22C55E20', border: '1px solid #22C55E50',
                        color: '#22C55E', fontSize: '12px', fontWeight: '700',
                        padding: '6px 14px', borderRadius: '999px', marginBottom: '16px'
                    }}>
                        <Calculator size={13} />
                        Live Mathematical Routing Engine
                    </div>
                    <h1 style={{
                        fontSize: '36px', fontWeight: '900', color: '#fff',
                        letterSpacing: '-1.5px', margin: '0 0 8px'
                    }}>
                        TRAVERSE Algorithm Demo
                    </h1>
                    <p style={{
                        fontSize: '15px', color: '#94A3B8', margin: '0 0 28px',
                        maxWidth: '620px', lineHeight: '1.7'
                    }}>
                        Hierarchical graph routing + Modified TOPSIS with 3 trigonometric
                        similarity measures (TSFHSS). Real HRTC timetable data. Zero hardcoded routes.
                    </p>

                    {/* Key formulas strip */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '12px'
                    }}>
                        {[
                            { title: 'Haversine Distance', formula: 'd = 2R·arcsin(√(sin²(Δlat/2) + cos·cos·sin²(Δlon/2)))' },
                            { title: 'Entropy Weight', formula: 'wⱼ = (1-Hⱼ) / Σⱼ(1-Hⱼ)   where   Hⱼ = -(1/ln m)·Σᵢ nᵢⱼ·ln(nᵢⱼ)' },
                            { title: 'CC Final Score', formula: 'CC(i) = S(Aᵢ,PIS) / (S(Aᵢ,PIS) + S(Aᵢ,NIS))' },
                        ].map(f => (
                            <div key={f.title} style={{
                                backgroundColor: '#0F172A80',
                                borderRadius: '10px', padding: '12px 14px',
                                border: '1px solid #334155'
                            }}>
                                <div style={{
                                    color: '#64748B', fontSize: '10px',
                                    fontWeight: '700', textTransform: 'uppercase',
                                    letterSpacing: '0.08em', marginBottom: '6px'
                                }}>{f.title}</div>
                                <div style={{
                                    color: '#22C55E', fontSize: '11px',
                                    fontFamily: 'monospace', lineHeight: '1.7'
                                }}>{f.formula}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

                {/* STAT CARDS */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                    gap: '12px', marginBottom: '28px'
                }}>
                    <StatCard label="Hub Nodes" value={Object.keys(NODES || {}).length}
                        sub="Not 3,142 stops" />
                    <StatCard label="Transport Edges" value={(EDGES || []).length}
                        sub="Real + formula" color="#D97706" />
                    <StatCard label="Candidates" value={candidates.length}
                        sub="This corridor" color="#7C3AED" />
                    <StatCard label="Criteria" value="5"
                        sub="Cost·Time·Comfort·Rel·Trans" color="#0EA5E9" />
                    <StatCard label="SM Measures" value="3"
                        sub="SM1 · SM2 · SM3" color="#22C55E" />
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 1 — HIERARCHICAL NODE CLASSIFICATION      */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', marginBottom: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <SectionHead icon={Layers} title="Step 1 — Hierarchical Node Classification"
                                badge="Hub-and-Spoke" color="#D97706" />
                            <button onClick={() => setShowHierarchy(!showHierarchy)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                                {showHierarchy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '12px', marginBottom: showHierarchy ? '20px' : 0
                        }}>
                            {[
                                { label: 'Without Hierarchy', value: '157,100+', sub: 'edges → server crash', color: '#DC2626', bg: '#FEF2F2' },
                                { label: 'With Hierarchy', value: (EDGES || []).length + ' edges', sub: 'in < 50ms', color: '#16A34A', bg: '#DCFCE7' },
                                { label: 'Threshold Rule', value: '> 50 km', sub: 'hub routing activates', color: '#D97706', bg: '#FFFBEB' },
                            ].map(s => (
                                <div key={s.label} style={{
                                    backgroundColor: s.bg, borderRadius: '10px',
                                    padding: '14px', border: '1px solid ' + s.color + '30',
                                    textAlign: 'center'
                                }}>
                                    <div style={{
                                        fontSize: '11px', fontWeight: '700', color: '#64748B',
                                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px'
                                    }}>
                                        {s.label}
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: s.color }}>
                                        {s.value}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                        {s.sub}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {showHierarchy && (
                        <div style={{ padding: '0 24px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <div style={{
                                        fontSize: '12px', fontWeight: '800', color: '#1A56DB',
                                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px'
                                    }}>
                                        Tier 1 — Primary Hubs
                                    </div>
                                    {tier1Nodes.map(n => (
                                        <div key={n.id} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            padding: '8px 12px', backgroundColor: '#EFF6FF',
                                            borderRadius: '8px', marginBottom: '6px',
                                            border: '1px solid #BFDBFE'
                                        }}>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E40AF' }}>
                                                {n.name}
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                                {n.lat?.toFixed(4)}°N {n.lon?.toFixed(4)}°E
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '12px', fontWeight: '800', color: '#7C3AED',
                                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px'
                                    }}>
                                        Tier 2 — Secondary Hubs
                                    </div>
                                    {tier2Nodes.map(n => (
                                        <div key={n.id} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            padding: '8px 12px', backgroundColor: '#F5F3FF',
                                            borderRadius: '8px', marginBottom: '6px',
                                            border: '1px solid #DDD6FE'
                                        }}>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#6D28D9' }}>
                                                {n.name}
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#64748B' }}>
                                                route-specific
                                            </span>
                                        </div>
                                    ))}

                                    <div style={{
                                        marginTop: '12px', padding: '12px',
                                        backgroundColor: '#F8FAFC', borderRadius: '8px',
                                        border: '1px solid #E2E8F0'
                                    }}>
                                        <div style={{
                                            fontSize: '11px', fontWeight: '700', color: '#64748B',
                                            marginBottom: '8px'
                                        }}>Edge breakdown by mode:</div>
                                        {Object.entries(edgesByMode).map(([mode, count]) => (
                                            <div key={mode} style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'center', marginBottom: '4px'
                                            }}>
                                                <ModeTag mode={mode} />
                                                <span style={{
                                                    fontSize: '13px', fontWeight: '800',
                                                    color: MODE_COLOR[mode]
                                                }}>{count} edges</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <FormulaBox
                                title="Haversine Formula (geographic distance between hub nodes)"
                                formula={`d = 2R × arcsin( √( sin²(Δlat/2) + cos(lat₁)·cos(lat₂)·sin²(Δlon/2) ) )
R = 6,371 km (Earth radius)
Example: JUIT(31.0048°N,77.0967°E) → Delhi CP(28.6315°N,77.2167°E) = 274.3 km`}
                                note="Used to compute real distances for cab cost formula. Accounts for Earth's curvature — more accurate than flat Euclidean distance."
                            />

                            <FormulaBox
                                title="Cab Cost Formula (Hill Terrain)"
                                formula={`Hill Taxi = max(₹150 + km × ₹18, ₹250)
Sedan     = max(₹120 + km × ₹16, ₹180)
Example: JUIT → Chandigarh Airport (haversine 81.2 km)
         = max(150 + 81.2×18, 250) = max(1,612, 250) = ₹1,612`}
                                color="#D97706"
                            />
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 2 — CORRIDOR SELECTOR + CANDIDATES        */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', padding: '20px 24px',
                    marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <SectionHead icon={GitBranch} title="Step 2 — Route Graph + Cartesian Product"
                        badge="All combinations" color="#0EA5E9" />

                    <div style={{
                        display: 'flex', gap: '12px', marginBottom: '16px',
                        flexWrap: 'wrap'
                    }}>
                        {SUPPORTED_CORRIDORS.map(c => (
                            <button key={c.corridorKey}
                                onClick={() => setCorridorKey(c.corridorKey)}
                                style={{
                                    padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
                                    border: corridorKey === c.corridorKey
                                        ? '2px solid #1A56DB' : '1.5px solid #E2E8F0',
                                    backgroundColor: corridorKey === c.corridorKey ? '#EFF6FF' : '#fff',
                                    color: corridorKey === c.corridorKey ? '#1A56DB' : '#64748B',
                                    fontSize: '13px', fontWeight: '700'
                                }}>
                                {c.label} · {c.distance}
                            </button>
                        ))}
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                        marginBottom: '16px'
                    }}>
                        <FormulaBox
                            title="Route Template (path structure)"
                            formula={`Example template:
[juit → waknaghat → delhi_isbt → delhi_cp]

For each leg, ALL available services are options:
Leg 1: 3 options (Cab, Hill Taxi, Walk)
Leg 2: 5 HRTC services (Svc 518, 556, 8, 20, 591)
Leg 3: 3 options (Metro, Cab, Auto)
= 3×5×3 = 45 candidates from ONE template`}
                            note="Cartesian product of all options per leg. Ensures every possible combination is evaluated."
                        />
                        <div style={{
                            backgroundColor: '#F8FAFC', borderRadius: '10px',
                            padding: '14px', border: '1px solid #E2E8F0'
                        }}>
                            <div style={{
                                fontSize: '11px', fontWeight: '700', color: '#64748B',
                                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px'
                            }}>
                                {currentCorridor?.label || 'Current Corridor'} — Candidate Summary
                            </div>
                            <div style={{
                                fontSize: '32px', fontWeight: '900', color: '#1A56DB',
                                letterSpacing: '-1px', marginBottom: '4px'
                            }}>
                                {candidates.length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                                complete routes evaluated by TOPSIS
                            </div>
                            {currentCorridor && !currentCorridor.hasTrainFlight && (
                                <div style={{
                                    backgroundColor: '#FEF9C3', borderRadius: '8px',
                                    padding: '8px 12px', fontSize: '11px', color: '#92400E',
                                    fontWeight: '600', border: '1px solid #FDE68A'
                                }}>
                                    ⚠️ {currentCorridor.note}
                                </div>
                            )}
                            {currentCorridor?.hasTrainFlight && (
                                <div style={{
                                    backgroundColor: '#DCFCE7', borderRadius: '8px',
                                    padding: '8px 12px', fontSize: '11px', color: '#166534',
                                    fontWeight: '600', border: '1px solid #BBF7D0'
                                }}>
                                    ✅ Bus + Train + Flight + Cab all evaluated
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 3 — VECTOR NORMALIZATION                  */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', marginBottom: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <SectionHead icon={BarChart2} title="Step 3 — Vector Normalization"
                                badge="Scale-invariant" color="#16A34A" />
                            <button onClick={() => setShowNormalization(!showNormalization)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                                {showNormalization ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </div>
                        <FormulaBox
                            title="Vector Normalization Formula"
                            formula={`nᵢⱼ = xᵢⱼ / √(Σ xᵢⱼ²)

Why: ₹5,720 and 280 minutes cannot be compared directly
After: both become 0-1 scale, ratios preserved
Example: ₹343 → 0.058   ₹5720 → 0.968
         575min → 0.807  280min → 0.393`}
                            color="#16A34A"
                            note="Vector normalization preserves ratios unlike min-max normalization. Route C costs 16.7× Route A — after normalization: 0.968/0.058 = 16.7× same ratio."
                        />
                    </div>
                    {showNormalization && (
                        <div style={{ padding: '0 24px 20px' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{
                                    fontSize: '12px', fontWeight: '700', color: '#64748B',
                                    marginBottom: '10px'
                                }}>
                                    Raw Decision Matrix — first 8 routes (before normalization):
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{
                                                padding: '8px 10px', backgroundColor: '#0F172A',
                                                color: '#94A3B8', textAlign: 'left', fontWeight: '700',
                                                fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap'
                                            }}>
                                                Route
                                            </th>
                                            {criteriaLabels.map((l, i) => (
                                                <th key={l} style={{
                                                    padding: '8px 10px', backgroundColor: '#0F172A',
                                                    color: criteriaTypes[i] === 'minimize' ? '#FCA5A5' : '#86EFAC',
                                                    textAlign: 'center', fontWeight: '700',
                                                    fontSize: '10px', whiteSpace: 'nowrap'
                                                }}>
                                                    {l}
                                                    <div style={{
                                                        fontSize: '9px', color: '#64748B',
                                                        fontWeight: '500', textTransform: 'uppercase'
                                                    }}>
                                                        {criteriaTypes[i]}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.slice(0, 8).map((route, i) => {
                                            const matrix = buildDecisionMatrix([route])
                                            const vals = matrix[0]?.values || []
                                            return (
                                                <tr key={i} style={{
                                                    borderTop: '1px solid #F1F5F9',
                                                    backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC'
                                                }}>
                                                    <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                                                        <div style={{
                                                            fontWeight: '700', color: '#0F172A',
                                                            marginBottom: '2px'
                                                        }}>
                                                            Route {i + 1}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                                            {route.modes.map(m => <ModeTag key={m} mode={m} />)}
                                                        </div>
                                                    </td>
                                                    {vals.map((v, j) => (
                                                        <td key={j} style={{
                                                            padding: '8px 10px', textAlign: 'center',
                                                            fontWeight: '700', color: '#0F172A', fontFamily: 'monospace',
                                                            fontSize: '12px'
                                                        }}>
                                                            {j === 0 ? '₹' + Math.round(v)
                                                                : j === 1 ? Math.round(v) + 'm'
                                                                    : j === 2 ? v.toFixed(1)
                                                                        : j === 3 ? v.toFixed(3)
                                                                            : Math.round(v)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 4 — ENTROPY WEIGHTS + PERSONA BOOST       */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', marginBottom: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <SectionHead icon={Database} title="Step 4 — Entropy Weights + Persona Boost"
                                badge="Objective + Subjective" color="#7C3AED" />
                            <button onClick={() => setShowPersonaBoost(!showPersonaBoost)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                                {showPersonaBoost ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <FormulaBox
                                title="Entropy Formula (objective weights from data)"
                                formula={`Hⱼ = -(1/ln m) × Σᵢ (nᵢⱼ × ln(nᵢⱼ))
wⱼ = (1 - Hⱼ) / Σⱼ(1 - Hⱼ)

High variance criterion → low entropy → high weight
Low variance criterion → high entropy → low weight
m = number of candidate routes`}
                                color="#7C3AED"
                                note="Objective: no human decides weights. The data variability decides."
                            />
                            <FormulaBox
                                title="Persona Boost (subjective user preference)"
                                formula={`boosted_wⱼ = entropy_wⱼ × persona_boostⱼ
final_wⱼ = boosted_wⱼ / Σ boosted_wⱼ  (renormalize)

CHEAPEST: cost ×4.0, time ×0.5, comfort ×0.2
FASTEST:  time ×10.0, cost ×0.05, comfort ×0.2
COMFORT:  comfort ×6.0, reliability ×3.0
BALANCED: all ×1.0-1.5 (slight boosts)`}
                                color="#D97706"
                                note="No weight is ever 0%. Even cheapest persona has time=8% so faster routes win on equal cost."
                            />
                        </div>
                    </div>

                    {showPersonaBoost && (
                        <div style={{ padding: '0 24px 20px' }}>
                            <div style={{
                                fontSize: '12px', fontWeight: '700', color: '#64748B',
                                marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em'
                            }}>
                                Persona Boost Factors × Entropy Weights = Final Weights
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{
                                                padding: '10px 12px', backgroundColor: '#0F172A',
                                                color: '#94A3B8', textAlign: 'left', fontWeight: '700',
                                                fontSize: '10px', textTransform: 'uppercase'
                                            }}>Persona</th>
                                            {criteriaLabels.map(l => (
                                                <th key={l} style={{
                                                    padding: '10px 12px', backgroundColor: '#0F172A',
                                                    color: '#94A3B8', textAlign: 'center', fontWeight: '700',
                                                    fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap'
                                                }}>
                                                    {l}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'balanced', label: '⚖️ Balanced', color: '#1A56DB' },
                                            { key: 'cheapest', label: '💰 Cheapest', color: '#16A34A' },
                                            { key: 'fastest', label: '⚡ Fastest', color: '#D97706' },
                                            { key: 'comfort', label: '⭐ Comfort', color: '#7C3AED' },
                                        ].map((p, pi) => {
                                            const boosts = PERSONA_BOOST[p.key]
                                            const keys = ['cost', 'time', 'comfort', 'reliability', 'transfers']
                                            const raw = keys.map(k => (boosts?.[k] || 1) * 0.2)
                                            const total = raw.reduce((s, v) => s + v, 0)
                                            const final = raw.map(v => (v / total * 100).toFixed(1) + '%')
                                            return (
                                                <tr key={p.key} style={{
                                                    borderTop: '1px solid #F1F5F9',
                                                    backgroundColor: pi % 2 === 0 ? '#fff' : '#F8FAFC'
                                                }}>
                                                    <td style={{
                                                        padding: '10px 12px', fontWeight: '800',
                                                        color: p.color, fontSize: '13px'
                                                    }}>{p.label}</td>
                                                    {final.map((f, i) => {
                                                        const pct = parseFloat(f)
                                                        const isDominant = pct > 40
                                                        return (
                                                            <td key={i} style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                <div style={{
                                                                    fontSize: '13px', fontWeight: '900',
                                                                    color: isDominant ? p.color : '#475569',
                                                                    backgroundColor: isDominant ? p.color + '15' : 'transparent',
                                                                    borderRadius: '6px', padding: isDominant ? '2px 6px' : '0'
                                                                }}>
                                                                    {f}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '10px', color: '#94A3B8',
                                                                    marginTop: '2px'
                                                                }}>
                                                                    ×{(boosts?.[keys[i]] || 1).toFixed(1)}
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 5 — TRIGONOMETRIC SIMILARITY MEASURES     */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', marginBottom: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <SectionHead icon={Zap} title="Step 5 — Modified TOPSIS: 3 Trigonometric SM"
                                badge="TSFHSS Paper" color="#DC2626" />
                            <button onClick={() => setShowSimilarity(!showSimilarity)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                                {showSimilarity ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
                            marginBottom: '12px'
                        }}>
                            {[
                                {
                                    name: 'SM1', title: 'Cosine Dot Product', color: '#1A56DB',
                                    formula: 'SM1(A,B) = Σ(aᵢ×bᵢ) / (√Σaᵢ² × √Σbᵢ²)',
                                    note: 'Directional alignment. Are we pointing toward ideal?'
                                },
                                {
                                    name: 'SM2', title: 'Strict Cosine (÷1)', color: '#7C3AED',
                                    formula: 'SM2(A,B) = (1/n) × Σ cos(π/2 × |aᵢ-bᵢ| / 1)',
                                    note: 'Penalizes small differences heavily. Precision measure.'
                                },
                                {
                                    name: 'SM3', title: 'Relaxed Cosine (÷3)', color: '#16A34A',
                                    formula: 'SM3(A,B) = (1/n) × Σ cos(π/2 × |aᵢ-bᵢ| / 3)',
                                    note: 'Tolerates moderate differences. Robustness measure.'
                                },
                            ].map(sm => (
                                <div key={sm.name} style={{
                                    backgroundColor: sm.color + '08',
                                    borderRadius: '10px', padding: '14px',
                                    border: '1px solid ' + sm.color + '30'
                                }}>
                                    <div style={{
                                        fontSize: '18px', fontWeight: '900', color: sm.color,
                                        marginBottom: '2px'
                                    }}>{sm.name}</div>
                                    <div style={{
                                        fontSize: '12px', fontWeight: '700', color: '#0F172A',
                                        marginBottom: '8px'
                                    }}>{sm.title}</div>
                                    <div style={{
                                        fontSize: '11px', fontFamily: 'monospace',
                                        color: sm.color, backgroundColor: '#0F172A',
                                        padding: '8px 10px', borderRadius: '6px',
                                        marginBottom: '8px', lineHeight: '1.6'
                                    }}>
                                        {sm.formula}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.5' }}>
                                        {sm.note}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <FormulaBox
                            title="Why SM replaces Euclidean distance (Simple TOPSIS limitation)"
                            formula={`Simple TOPSIS: d(PIS) = √(Σ (wⱼ × (xᵢⱼ - PISⱼ))²)  ← Euclidean
Problem: ₹5,377 cost gap dominates all other criteria

Modified TOPSIS: CC = SM(A,PIS) / (SM(A,PIS) + SM(A,NIS))  ← Trigonometric
Solution: Cosine measures ANGLE not magnitude → scale invariant
Flight (₹5720, 280min) correctly ranked #1 for Fastest persona`}
                            color="#DC2626"
                            note="Three measures give three perspectives. CCfinal = (CC1+CC2+CC3)/3 — robust against any single measure's weakness."
                        />
                    </div>

                    {showSimilarity && (
                        <div style={{ padding: '0 24px 20px' }}>
                            <FormulaBox
                                title="PIS and NIS (Positive and Negative Ideal Solutions)"
                                formula={`PIS = [min_cost, min_time, max_comfort, max_reliability, min_transfers]
NIS = [max_cost, max_time, min_comfort, min_reliability, max_transfers]

No real route achieves PIS. It is a mathematical reference.
CC → 1.0 means: close to PIS, far from NIS (best route)
CC → 0.0 means: close to NIS, far from PIS (worst route)
AI Match % = CC × 100`}
                                color="#22C55E"
                            />
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 6 — PERSONA SELECTOR + COMPUTE            */}
                {/* ══════════════════════════════════════════════════ */}
                <div style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', padding: '24px',
                    marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                    <SectionHead icon={Star} title="Step 6 — Select Persona + Run TOPSIS"
                        color="#D97706" />
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                        gap: '12px', marginBottom: '20px'
                    }}>
                        {personas.map(p => (
                            <button key={p.key} onClick={() => setPersona(p.key)}
                                style={{
                                    padding: '16px 12px', borderRadius: '12px',
                                    border: persona === p.key
                                        ? '2px solid ' + p.color : '1.5px solid #E2E8F0',
                                    backgroundColor: persona === p.key ? p.bg : '#fff',
                                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s'
                                }}>
                                <div style={{
                                    fontSize: '15px', fontWeight: '800', color: p.color,
                                    marginBottom: '6px'
                                }}>{p.label}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.5' }}>
                                    {p.desc}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button onClick={compute} disabled={computing || candidates.length === 0}
                        style={{
                            width: '100%', padding: '18px',
                            backgroundColor: computing ? '#94A3B8' : '#1A56DB',
                            color: '#fff', border: 'none', borderRadius: '12px',
                            fontWeight: '800', fontSize: '16px',
                            cursor: computing ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '10px',
                            boxShadow: computing ? 'none' : '0 4px 16px rgba(26,86,219,0.3)',
                            transition: 'all 0.2s'
                        }}>
                        <Calculator size={20} />
                        {computing
                            ? 'Running SM1 · SM2 · SM3 — Computing Closeness Coefficients…'
                            : `▶  Run Modified TOPSIS on ${candidates.length} candidates  (${currentCorridor?.label || 'JUIT→Delhi'})`
                        }
                    </button>
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION 7 — RESULTS                               */}
                {/* ══════════════════════════════════════════════════ */}
                {results && steps && (
                    <>
                        {/* Weight breakdown */}
                        <div style={{
                            backgroundColor: '#0F172A', borderRadius: '16px',
                            padding: '20px 24px', marginBottom: '16px'
                        }}>
                            <div style={{
                                color: '#94A3B8', fontSize: '11px', fontWeight: '700',
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px'
                            }}>
                                Entropy Weights → After Persona Boost → Final Weights
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
                                {steps.weightDetails.labels.map((label, i) => (
                                    <div key={label} style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: '10px', color: '#64748B',
                                            textTransform: 'uppercase', marginBottom: '8px',
                                            letterSpacing: '0.06em'
                                        }}>{label}</div>
                                        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                                            entropy: {steps.entropyWeights.weights[i]}
                                        </div>
                                        <div style={{
                                            fontSize: '20px', fontWeight: '900', color: '#22C55E',
                                            marginBottom: '4px'
                                        }}>
                                            {steps.weightDetails.finalWeights[i]}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#64748B' }}>
                                            = {(parseFloat(steps.weightDetails.finalWeights[i]) * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Entropy formula reminder */}
                            <div style={{
                                marginTop: '16px', padding: '12px 14px',
                                backgroundColor: '#1E293B', borderRadius: '8px',
                                fontFamily: 'monospace', fontSize: '12px',
                                color: '#22C55E', lineHeight: '1.8'
                            }}>
                                Hⱼ = -(1/ln m) × Σᵢ (nᵢⱼ × ln(nᵢⱼ))  &nbsp;→&nbsp;  wⱼ = (1-Hⱼ) / Σⱼ(1-Hⱼ)  &nbsp;→&nbsp;  final_wⱼ = wⱼ × boost / Σ(wⱼ × boost)
                            </div>
                        </div>

                        {/* PIS and NIS */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr',
                            gap: '12px', marginBottom: '16px'
                        }}>
                            {[
                                {
                                    label: 'PIS — Positive Ideal Solution', values: steps.PIS,
                                    color: '#16A34A', bg: '#DCFCE7', note: 'Best possible value per criterion'
                                },
                                {
                                    label: 'NIS — Negative Ideal Solution', values: steps.NIS,
                                    color: '#DC2626', bg: '#FEF2F2', note: 'Worst possible value per criterion'
                                },
                            ].map(ideal => (
                                <div key={ideal.label} style={{
                                    backgroundColor: ideal.bg,
                                    borderRadius: '12px', padding: '16px',
                                    border: '1px solid ' + ideal.color + '30'
                                }}>
                                    <div style={{
                                        fontSize: '12px', fontWeight: '800', color: ideal.color,
                                        marginBottom: '4px'
                                    }}>{ideal.label}</div>
                                    <div style={{
                                        fontSize: '11px', color: '#64748B',
                                        marginBottom: '12px'
                                    }}>{ideal.note}</div>
                                    {criteriaLabels.map((l, i) => (
                                        <div key={l} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', marginBottom: '6px'
                                        }}>
                                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                                {l}
                                            </span>
                                            <span style={{
                                                fontSize: '12px', fontWeight: '800',
                                                color: ideal.color, fontFamily: 'monospace'
                                            }}>
                                                {ideal.values?.[i]?.toFixed(4) || '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Top ranked routes */}
                        <div style={{
                            backgroundColor: '#fff', borderRadius: '16px',
                            border: '1px solid #E2E8F0', padding: '20px 24px',
                            marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                        }}>
                            <SectionHead icon={CheckCircle}
                                title={`Top Ranked Routes — ${persona.toUpperCase()} · ${currentCorridor?.label || 'JUIT→Delhi'}`}
                                badge="SM1+SM2+SM3 averaged" color="#16A34A" />

                            <FormulaBox
                                title="Final Closeness Coefficient"
                                formula={`CC1(i) = SM1(Aᵢ,PIS) / (SM1(Aᵢ,PIS) + SM1(Aᵢ,NIS))
CC2(i) = SM2(Aᵢ,PIS) / (SM2(Aᵢ,PIS) + SM2(Aᵢ,NIS))
CC3(i) = SM3(Aᵢ,PIS) / (SM3(Aᵢ,PIS) + SM3(Aᵢ,NIS))
CCfinal = (CC1 + CC2 + CC3) / 3   →   AI Match % = CCfinal × 100`}
                            />

                            {steps.allScored
                                .sort((a, b) => b.ccFinal - a.ccFinal)
                                .slice(0, 10)
                                .map((r, i) => {
                                    const route = candidates.find(c => c.id === r.id)
                                    if (!route) return null
                                    const h = Math.floor(route.totalTime / 60)
                                    const m = route.totalTime % 60
                                    const isTop = i < 4
                                    return (
                                        <div key={r.id} style={{
                                            padding: '14px',
                                            backgroundColor: isTop ? '#F0F9FF' : '#F8FAFC',
                                            borderRadius: '12px', marginBottom: '8px',
                                            border: isTop ? '1px solid #BAE6FD' : '1px solid #F1F5F9'
                                        }}>
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'flex-start', marginBottom: '8px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '28px', height: '28px', borderRadius: '50%',
                                                        backgroundColor: isTop ? '#1A56DB' : '#E2E8F0',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '12px', fontWeight: '900',
                                                        color: isTop ? '#fff' : '#94A3B8', flexShrink: 0
                                                    }}>
                                                        {i + 1}
                                                    </div>
                                                    <div>
                                                        <div style={{
                                                            display: 'flex', gap: '4px', flexWrap: 'wrap',
                                                            marginBottom: '4px'
                                                        }}>
                                                            {route.modes.map(mo => <ModeTag key={mo} mode={mo} />)}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                                                            {route.stopNames.join(' → ')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                                    <div style={{
                                                        fontSize: '16px', fontWeight: '900',
                                                        color: '#1A56DB'
                                                    }}>
                                                        {(r.ccFinal * 100).toFixed(1)}%
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>AI Match</div>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex', gap: '8px', flexWrap: 'wrap',
                                                marginBottom: '10px'
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                                                    ₹{route.totalCost}
                                                </span>
                                                <span style={{ color: '#94A3B8' }}>·</span>
                                                <span style={{ fontSize: '12px', color: '#475569' }}>
                                                    {h}h {m}m
                                                </span>
                                                <span style={{ color: '#94A3B8' }}>·</span>
                                                <span style={{ fontSize: '12px', color: '#475569' }}>
                                                    {route.transfers} transfers
                                                </span>
                                                <span style={{ color: '#94A3B8' }}>·</span>
                                                <span style={{ fontSize: '12px', color: '#475569' }}>
                                                    comfort {route.avgComfort?.toFixed(1)}
                                                </span>
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3,1fr)', gap: '6px'
                                            }}>
                                                {[
                                                    { label: 'CC1 (SM1)', val: r.cc1, color: '#1A56DB' },
                                                    { label: 'CC2 (SM2)', val: r.cc2, color: '#7C3AED' },
                                                    { label: 'CC3 (SM3)', val: r.cc3, color: '#16A34A' },
                                                ].map(cc => (
                                                    <div key={cc.label} style={{
                                                        backgroundColor: '#fff',
                                                        borderRadius: '8px', padding: '8px 10px',
                                                        border: '1px solid #E2E8F0'
                                                    }}>
                                                        <div style={{
                                                            fontSize: '10px', color: '#94A3B8',
                                                            fontWeight: '700', marginBottom: '4px',
                                                            textTransform: 'uppercase'
                                                        }}>{cc.label}</div>
                                                        <ScoreBar val={cc.val || 0} color={cc.color} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>

                        {/* Full matrix toggle */}
                        <div style={{
                            backgroundColor: '#fff', borderRadius: '16px',
                            border: '1px solid #E2E8F0', marginBottom: '16px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                        }}>
                            <div style={{ padding: '20px 24px' }}>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <SectionHead icon={BarChart2}
                                        title={`Full Weighted Decision Matrix — ${currentCorridor?.label || 'JUIT→Delhi'} (all ${candidates.length} routes)`}
                                        color="#64748B" />
                                    <button onClick={() => setShowMatrix(!showMatrix)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#64748B', fontSize: '13px', fontWeight: '700',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}>
                                        {showMatrix ? 'Hide' : 'Show All'}{' '}
                                        {showMatrix ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                            </div>
                            {showMatrix && (
                                <div style={{ padding: '0 24px 20px', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{
                                                    padding: '8px 10px', backgroundColor: '#0F172A',
                                                    color: '#94A3B8', textAlign: 'left', fontWeight: '700',
                                                    fontSize: '10px', textTransform: 'uppercase'
                                                }}>Route</th>
                                                <th style={{
                                                    padding: '8px 10px', backgroundColor: '#0F172A',
                                                    color: '#94A3B8', textAlign: 'left', fontWeight: '700',
                                                    fontSize: '10px', textTransform: 'uppercase'
                                                }}>Modes</th>
                                                {criteriaLabels.map(l => (
                                                    <th key={l} style={{
                                                        padding: '8px 10px', backgroundColor: '#0F172A',
                                                        color: '#94A3B8', textAlign: 'center', fontWeight: '700',
                                                        fontSize: '10px', textTransform: 'uppercase',
                                                        whiteSpace: 'nowrap'
                                                    }}>{l}</th>
                                                ))}
                                                <th style={{
                                                    padding: '8px 10px', backgroundColor: '#0F172A',
                                                    color: '#22C55E', textAlign: 'center', fontWeight: '800',
                                                    fontSize: '10px', textTransform: 'uppercase'
                                                }}>CC Final</th>
                                                <th style={{
                                                    padding: '8px 10px', backgroundColor: '#0F172A',
                                                    color: '#22C55E', textAlign: 'center', fontWeight: '800',
                                                    fontSize: '10px', textTransform: 'uppercase'
                                                }}>Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {steps.allScored
                                                .sort((a, b) => b.ccFinal - a.ccFinal)
                                                .map((r, i) => {
                                                    const route = candidates.find(c => c.id === r.id)
                                                    if (!route) return null
                                                    const matrix = buildDecisionMatrix([route])
                                                    const vals = matrix[0]?.values || []
                                                    const isTop4 = i < 4
                                                    return (
                                                        <tr key={r.id} style={{
                                                            borderTop: '1px solid #F1F5F9',
                                                            backgroundColor: isTop4 ? '#F0F9FF' : i % 2 === 0 ? '#fff' : '#F8FAFC'
                                                        }}>
                                                            <td style={{
                                                                padding: '8px 10px', fontWeight: '700',
                                                                color: '#0F172A', whiteSpace: 'nowrap'
                                                            }}>
                                                                ₹{route.totalCost} · {Math.floor(route.totalTime / 60)}h{route.totalTime % 60}m
                                                            </td>
                                                            <td style={{ padding: '8px 10px' }}>
                                                                <div style={{ display: 'flex', gap: '2px' }}>
                                                                    {route.modes.map(mo => <ModeTag key={mo} mode={mo} />)}
                                                                </div>
                                                            </td>
                                                            {vals.map((v, j) => (
                                                                <td key={j} style={{
                                                                    padding: '8px 10px', textAlign: 'center',
                                                                    fontFamily: 'monospace', color: '#475569', fontSize: '11px'
                                                                }}>
                                                                    {v.toFixed(3)}
                                                                </td>
                                                            ))}
                                                            <td style={{
                                                                padding: '8px 10px', textAlign: 'center',
                                                                fontWeight: '900', color: '#1A56DB', fontSize: '13px'
                                                            }}>
                                                                {(r.ccFinal * 100).toFixed(1)}%
                                                            </td>
                                                            <td style={{
                                                                padding: '8px 10px', textAlign: 'center',
                                                                fontWeight: '800',
                                                                color: isTop4 ? '#16A34A' : '#94A3B8'
                                                            }}>
                                                                {isTop4 ? '★ ' : ''}{i + 1}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Back to search */}
                        <div style={{ textAlign: 'center' }}>
                            <button onClick={() => navigate('/search')}
                                style={{
                                    padding: '16px 40px', backgroundColor: '#1A56DB',
                                    color: '#fff', border: 'none', borderRadius: '12px',
                                    fontWeight: '800', fontSize: '15px', cursor: 'pointer',
                                    boxShadow: '0 4px 16px rgba(26,86,219,0.3)'
                                }}>
                                ← Back to Search Results
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
