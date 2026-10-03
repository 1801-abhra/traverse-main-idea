import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    MapPin, Calendar, Clock, Edit,
    Car, Train, Bus, Landmark, Plane,
    Clock3, ArrowRight, SlidersHorizontal,
    CheckCircle
} from 'lucide-react'
import { 
  findCandidateRoutesForCorridor,
  SUPPORTED_CORRIDORS 
} from '../utils/routingEngine'
import { runTOPSIS, getTopRoutePerPersona } from '../utils/topsisEngine'

function SearchResults() {
    const navigate = useNavigate()

    const [selectedCorridor, setSelectedCorridor] = useState('juit')

    const candidates = findCandidateRoutesForCorridor(selectedCorridor)
    const allTopRoutes = getTopRoutePerPersona(candidates)
    const computedRoutes = {
        balanced: allTopRoutes.balanced,
        cheapest: allTopRoutes.cheapest,
        comfort: allTopRoutes.comfort,
        fastest: allTopRoutes.fastest,
    }

    const journeys = [
        {
            id: 1,
            badge: 'Recommended',
            badgeColor: '#1A56DB',
            badgeBg: '#EFF6FF',
            tag: 'Best Overall',
            tagColor: '#1A56DB',
            tagBg: '#EFF6FF',
            accentColor: computedRoutes.balanced?.modes
                ?.includes('flight') ? '#7C3AED'
                : computedRoutes.balanced?.modes
                    ?.includes('train') ? '#1A56DB'
                    : computedRoutes.balanced?.modes
                        ?.includes('bus') ? '#D97706'
                        : '#0EA5E9',
            departs: computedRoutes.balanced?.legs?.[0]?.departs 
                && computedRoutes.balanced.legs[0].departs !== 'On demand'
                && computedRoutes.balanced.legs[0].departs !== 'Multiple'
                ? computedRoutes.balanced.legs[0].departs
                : null,
            total: '₹' + (computedRoutes.balanced?.totalCost || 1700),
            duration: Math.floor((computedRoutes.balanced?.totalTime || 510) / 60) + 'h ' + ((computedRoutes.balanced?.totalTime || 510) % 60) + 'm',
            transfers: (computedRoutes.balanced?.transfers ?? 1) + ' transfers',
            topsisScore: computedRoutes.balanced?.ccFinal || 0,
            routeStops: computedRoutes.balanced?.stopNames || [],
            rawLegs: computedRoutes.balanced?.legs || [],
            legs: (computedRoutes.balanced?.legs || []).map((leg, i) => ({
                from: computedRoutes.balanced?.stopNames?.[i] || '',
                fromSub: '',
                mode: leg.operator,
                time: Math.floor(leg.time / 60) > 0
                    ? Math.floor(leg.time / 60) + 'h ' + (leg.time % 60) + 'm'
                    : leg.time + 'm',
                price: '₹' + leg.cost,
                color: leg.mode === 'bus' ? '#D97706' : leg.mode === 'train' ? '#1A56DB' : '#0EA5E9',
                bg: leg.mode === 'bus' ? '#FFFBEB' : leg.mode === 'train' ? '#EFF6FF' : '#F0F9FF',
            })),
            dest: computedRoutes.balanced?.stopNames?.slice(-1)[0]
                || (selectedCorridor === 'juit_rampur' ? 'Rampur Bushahr' : 'New Delhi'),
            destSub: computedRoutes.balanced?.stopNames?.slice(-2, -1)[0] ===
                computedRoutes.balanced?.stopNames?.slice(-1)[0]
                ? ''
                : computedRoutes.balanced?.stopNames?.slice(-2, -1)[0] || '',
        },
        {
            id: 2,
            badge: 'Cheapest',
            badgeColor: '#059669',
            badgeBg: '#ECFDF5',
            tag: 'Save Most',
            tagColor: '#059669',
            tagBg: '#ECFDF5',
            accentColor: computedRoutes.cheapest?.modes
                ?.includes('flight') ? '#7C3AED'
                : computedRoutes.cheapest?.modes
                    ?.includes('train') ? '#1A56DB'
                    : computedRoutes.cheapest?.modes
                        ?.includes('bus') ? '#D97706'
                        : '#0EA5E9',
            departs: computedRoutes.cheapest?.legs?.[0]?.departs
                && computedRoutes.cheapest.legs[0].departs !== 'On demand'
                && computedRoutes.cheapest.legs[0].departs !== 'Multiple'
                ? computedRoutes.cheapest.legs[0].departs
                : null,
            total: '₹' + (computedRoutes.cheapest?.totalCost || 1300),
            duration: Math.floor((computedRoutes.cheapest?.totalTime || 510) / 60) + 'h ' + ((computedRoutes.cheapest?.totalTime || 510) % 60) + 'm',
            transfers: (computedRoutes.cheapest?.transfers ?? 1) + ' transfers',
            topsisScore: computedRoutes.cheapest?.ccFinal || 0,
            routeStops: computedRoutes.cheapest?.stopNames || [],
            rawLegs: computedRoutes.cheapest?.legs || [],
            legs: (computedRoutes.cheapest?.legs || []).map((leg, i) => ({
                from: computedRoutes.cheapest?.stopNames?.[i] || '',
                fromSub: '',
                mode: leg.operator,
                time: Math.floor(leg.time / 60) > 0
                    ? Math.floor(leg.time / 60) + 'h ' + (leg.time % 60) + 'm'
                    : leg.time + 'm',
                price: '₹' + leg.cost,
                color: leg.mode === 'bus' ? '#D97706' : leg.mode === 'train' ? '#1A56DB' : '#0EA5E9',
                bg: leg.mode === 'bus' ? '#FFFBEB' : leg.mode === 'train' ? '#EFF6FF' : '#F0F9FF',
            })),
            dest: computedRoutes.cheapest?.stopNames?.slice(-1)[0]
                || (selectedCorridor === 'juit_rampur' ? 'Rampur Bushahr' : 'New Delhi'),
            destSub: computedRoutes.cheapest?.stopNames?.slice(-2, -1)[0] ===
                computedRoutes.cheapest?.stopNames?.slice(-1)[0]
                ? ''
                : computedRoutes.cheapest?.stopNames?.slice(-2, -1)[0] || '',
        },
        {
            id: 3,
            badge: 'Most Comfortable',
            badgeColor: '#7C3AED',
            badgeBg: '#F5F3FF',
            tag: 'Premium',
            tagColor: '#7C3AED',
            tagBg: '#F5F3FF',
            accentColor: computedRoutes.comfort?.modes
                ?.includes('flight') ? '#7C3AED'
                : computedRoutes.comfort?.modes
                    ?.includes('train') ? '#1A56DB'
                    : computedRoutes.comfort?.modes
                        ?.includes('bus') ? '#D97706'
                        : '#0EA5E9',
            departs: computedRoutes.comfort?.legs?.[0]?.departs
                && computedRoutes.comfort.legs[0].departs !== 'On demand'
                && computedRoutes.comfort.legs[0].departs !== 'Multiple'
                ? computedRoutes.comfort.legs[0].departs
                : null,
            total: '₹' + (computedRoutes.comfort?.totalCost || 4500),
            duration: Math.floor((computedRoutes.comfort?.totalTime || 510) / 60) + 'h ' + ((computedRoutes.comfort?.totalTime || 510) % 60) + 'm',
            transfers: (computedRoutes.comfort?.transfers ?? 1) + ' transfers',
            topsisScore: computedRoutes.comfort?.ccFinal || 0,
            routeStops: computedRoutes.comfort?.stopNames || [],
            rawLegs: computedRoutes.comfort?.legs || [],
            legs: (computedRoutes.comfort?.legs || []).map((leg, i) => ({
                from: computedRoutes.comfort?.stopNames?.[i] || '',
                fromSub: '',
                mode: leg.operator,
                time: Math.floor(leg.time / 60) > 0
                    ? Math.floor(leg.time / 60) + 'h ' + (leg.time % 60) + 'm'
                    : leg.time + 'm',
                price: '₹' + leg.cost,
                color: leg.mode === 'bus' ? '#D97706' : leg.mode === 'train' ? '#1A56DB' : '#0EA5E9',
                bg: leg.mode === 'bus' ? '#FFFBEB' : leg.mode === 'train' ? '#EFF6FF' : '#F0F9FF',
            })),
            dest: computedRoutes.comfort?.stopNames?.slice(-1)[0]
                || (selectedCorridor === 'juit_rampur' ? 'Rampur Bushahr' : 'New Delhi'),
            destSub: computedRoutes.comfort?.stopNames?.slice(-2, -1)[0] ===
                computedRoutes.comfort?.stopNames?.slice(-1)[0]
                ? ''
                : computedRoutes.comfort?.stopNames?.slice(-2, -1)[0] || '',
        },
        {
            id: 4,
            badge: 'Fastest',
            badgeColor: '#DC2626',
            badgeBg: '#FEF2F2',
            tag: 'Save Time',
            tagColor: '#DC2626',
            tagBg: '#FFF1F2',
            accentColor: computedRoutes.fastest?.modes
                ?.includes('flight') ? '#7C3AED'
                : computedRoutes.fastest?.modes
                    ?.includes('train') ? '#1A56DB'
                    : computedRoutes.fastest?.modes
                        ?.includes('bus') ? '#D97706'
                        : '#0EA5E9',
            departs: computedRoutes.fastest?.legs?.[0]?.departs
                && computedRoutes.fastest.legs[0].departs !== 'On demand'
                && computedRoutes.fastest.legs[0].departs !== 'Multiple'
                ? computedRoutes.fastest.legs[0].departs
                : null,
            total: '₹' + (computedRoutes.fastest?.totalCost || 5900),
            duration: Math.floor((computedRoutes.fastest?.totalTime || 510) / 60) + 'h ' + ((computedRoutes.fastest?.totalTime || 510) % 60) + 'm',
            transfers: (computedRoutes.fastest?.transfers ?? 1) + ' transfers',
            topsisScore: computedRoutes.fastest?.ccFinal || 0,
            routeStops: computedRoutes.fastest?.stopNames || [],
            rawLegs: computedRoutes.fastest?.legs || [],
            legs: (computedRoutes.fastest?.legs || []).map((leg, i) => ({
                from: computedRoutes.fastest?.stopNames?.[i] || '',
                fromSub: '',
                mode: leg.operator,
                time: Math.floor(leg.time / 60) > 0
                    ? Math.floor(leg.time / 60) + 'h ' + (leg.time % 60) + 'm'
                    : leg.time + 'm',
                price: '₹' + leg.cost,
                color: leg.mode === 'bus' ? '#D97706' : leg.mode === 'train' ? '#1A56DB' : '#0EA5E9',
                bg: leg.mode === 'bus' ? '#FFFBEB' : leg.mode === 'train' ? '#EFF6FF' : '#F0F9FF',
            })),
            dest: computedRoutes.fastest?.stopNames?.slice(-1)[0]
                || (selectedCorridor === 'juit_rampur' ? 'Rampur Bushahr' : 'New Delhi'),
            destSub: computedRoutes.fastest?.stopNames?.slice(-2, -1)[0] ===
                computedRoutes.fastest?.stopNames?.slice(-1)[0]
                ? ''
                : computedRoutes.fastest?.stopNames?.slice(-2, -1)[0] || '',
        },
    ]

    return (
        <div style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: '#ffffff', minHeight: '100vh'
        }}>

            {/* TOP SEARCH BAR */}
            <section style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '16px 24px'
            }}>
                <div style={{
                    maxWidth: '1200px', margin: '0 auto',
                    display: 'flex', flexDirection: 'column', gap: '12px'
                }}>

                    {/* Route strip */}
                    <div style={{
                        backgroundColor: '#fff', borderRadius: '12px',
                        padding: '14px 20px', border: '1px solid #E2E8F0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center',
                            gap: '20px', flexWrap: 'wrap'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '8px'
                            }}>
                                <MapPin size={18} color="#1A56DB" />
                                <span style={{
                                    fontWeight: '800', fontSize: '16px',
                                    color: '#0F172A'
                                }}>
                                    JUIT Waknaghat
                                </span>
                                <ArrowRight size={16} color="#94A3B8" />
                                <span style={{
                                    fontWeight: '800', fontSize: '16px',
                                    color: '#0F172A'
                                }}>
                                    New Delhi
                                </span>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Calendar size={16} color="#1A56DB" />
                                <span style={{
                                    fontSize: '14px', fontWeight: '600',
                                    color: '#0F172A'
                                }}>Thu, 24 Oct</span>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Clock size={16} color="#1A56DB" />
                                <span style={{
                                    fontSize: '14px', fontWeight: '600',
                                    color: '#0F172A'
                                }}>08:30 AM</span>
                            </div>
                        </div>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: '#1A56DB', fontWeight: '600', fontSize: '14px',
                            background: 'none', border: 'none', cursor: 'pointer'
                        }}>
                            <Edit size={16} /> Edit Search
                        </button>
                    </div>

                    {/* Preference pills + count */}
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', flexWrap: 'wrap',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[
                                { label: 'Cheapest', selected: true },
                                { label: 'Fastest', selected: false },
                                { label: 'Comfortable', selected: false },
                            ].map(({ label, selected }) => (
                                <button key={label} style={{
                                    padding: '8px 16px', borderRadius: '999px',
                                    fontSize: '13px', fontWeight: '700',
                                    border: selected
                                        ? 'none' : '1px solid #E2E8F0',
                                    backgroundColor: selected ? '#1A56DB' : '#fff',
                                    color: selected ? '#fff' : '#64748B',
                                    cursor: 'pointer'
                                }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            backgroundColor: '#F1F5F9', padding: '6px 12px',
                            borderRadius: '999px'
                        }}>
                            <div style={{
                                width: '8px', height: '8px',
                                borderRadius: '999px', backgroundColor: '#22C55E'
                            }}
                            />
                            <span style={{
                                fontSize: '12px', fontWeight: '700',
                                color: '#0F172A'
                            }}>
                                4 multi-modal routes found
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <div style={{
              backgroundColor: '#fff',
              borderBottom: '1px solid #E2E8F0',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700',
                color: '#64748B', whiteSpace: 'nowrap' }}>
                Search Corridor:
              </span>
              
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <select
                  value={selectedCorridor}
                  onChange={(e) => setSelectedCorridor(e.target.value)}
                  style={{
                    padding: '10px 40px 10px 16px',
                    borderRadius: '10px',
                    border: '1.5px solid #1A56DB',
                    backgroundColor: '#EFF6FF',
                    color: '#1A56DB',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    minWidth: '280px',
                  }}
                >
                  <option value="juit">
                    JUIT Waknaghat → New Delhi (~310 km)
                  </option>
                  <option value="shimla_isbt">
                    Shimla → New Delhi (~348 km)
                  </option>
                  <option value="juit_rampur">
                    JUIT Waknaghat → Rampur Bushahr (~160 km)
                  </option>
                </select>
                <div style={{
                  position: 'absolute', right: '12px',
                  top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#1A56DB', fontSize: '12px'
                }}>▼</div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center',
                gap: '6px', fontSize: '12px',
                color: '#22C55E', fontWeight: '700'
              }}>
                <div style={{ width: '8px', height: '8px',
                  backgroundColor: '#22C55E',
                  borderRadius: '999px' }} />
                {selectedCorridor === 'juit' 
                  ? '21 real HRTC services'
                  : selectedCorridor === 'shimla_isbt'
                  ? '23 real HRTC services'
                  : '15 real HRTC services'
                } · Modified TOPSIS ranked
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{
                maxWidth: '1200px', margin: '0 auto',
                padding: '32px 24px',
                display: 'grid', gridTemplateColumns: '280px 1fr',
                gap: '32px', alignItems: 'start'
            }}>

                {/* LEFT SIDEBAR */}
                <aside style={{
                    backgroundColor: '#fff', borderRadius: '16px',
                    border: '1px solid #E2E8F0', padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    position: 'sticky', top: '80px'
                }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '20px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid #F1F5F9'
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center',
                            gap: '8px'
                        }}>
                            <SlidersHorizontal size={18} color="#1A56DB" />
                            <span style={{
                                fontWeight: '800', fontSize: '16px',
                                color: '#0F172A'
                            }}>Filters</span>
                        </div>
                        <button style={{
                            color: '#1A56DB', fontWeight: '600',
                            fontSize: '13px', background: 'none', border: 'none',
                            cursor: 'pointer'
                        }}>Reset all</button>
                    </div>

                    {/* Transport Modes */}
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: '#475569', textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>Transport Modes</span>
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            gap: '10px', marginTop: '12px'
                        }}>
                            {[
                                { icon: Car, label: 'Cab' },
                                { icon: Train, label: 'Train' },
                                { icon: Bus, label: 'Bus' },
                                { icon: Landmark, label: 'Metro' },
                                { icon: Plane, label: 'Flight' },
                            ].map(({ icon: Icon, label }) => (
                                <label key={label} style={{
                                    display: 'flex', alignItems: 'center',
                                    gap: '10px', cursor: 'pointer'
                                }}>
                                    <input type="checkbox" defaultChecked
                                        style={{
                                            accentColor: '#1A56DB', width: '16px',
                                            height: '16px'
                                        }} />
                                    <Icon size={16} color="#1A56DB" />
                                    <span style={{
                                        fontSize: '14px', fontWeight: '500',
                                        color: '#0F172A'
                                    }}>{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        height: '1px', backgroundColor: '#F1F5F9',
                        margin: '16px 0'
                    }} />

                    {/* Max Transfers */}
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: '#475569', textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>Max Transfers</span>
                        <div style={{
                            display: 'grid', gridTemplateColumns:
                                'repeat(3,1fr)', gap: '8px', marginTop: '12px'
                        }}>
                            {['Any', '1-2', 'Direct'].map((t, i) => (
                                <button key={t} style={{
                                    padding: '8px', textAlign: 'center',
                                    borderRadius: '8px', fontSize: '13px',
                                    fontWeight: '600', cursor: 'pointer',
                                    border: i === 0
                                        ? 'none' : '1px solid #E2E8F0',
                                    backgroundColor: i === 0 ? '#1A56DB' : '#fff',
                                    color: i === 0 ? '#fff' : '#64748B'
                                }}>{t}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        height: '1px', backgroundColor: '#F1F5F9',
                        margin: '16px 0'
                    }} />

                    {/* Departure Time */}
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: '#475569', textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>Departure Time</span>
                        <div style={{
                            display: 'grid', gridTemplateColumns:
                                '1fr 1fr', gap: '8px', marginTop: '12px'
                        }}>
                            {[
                                {
                                    label: 'Early Morning', sub: 'Before 6 AM',
                                    active: false
                                },
                                {
                                    label: 'Morning', sub: '6 AM - 12 PM',
                                    active: true
                                },
                                {
                                    label: 'Afternoon', sub: '12 PM - 6 PM',
                                    active: false
                                },
                                {
                                    label: 'Evening', sub: 'After 6 PM',
                                    active: false
                                },
                            ].map(({ label, sub, active }) => (
                                <div key={label} style={{
                                    padding: '10px', borderRadius: '8px',
                                    border: active
                                        ? '2px solid #1A56DB'
                                        : '1px solid #E2E8F0',
                                    backgroundColor: active ? '#EFF6FF' : '#fff',
                                    cursor: 'pointer'
                                }}>
                                    <div style={{
                                        fontSize: '12px', fontWeight: '700',
                                        color: active ? '#1A56DB' : '#0F172A'
                                    }}>
                                        {label}
                                    </div>
                                    <div style={{
                                        fontSize: '11px',
                                        color: active ? '#1A56DB' : '#94A3B8'
                                    }}>
                                        {sub}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        height: '1px', backgroundColor: '#F1F5F9',
                        margin: '16px 0'
                    }} />

                    {/* Price Range */}
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: '#475569', textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>Price Range</span>
                        <div style={{ marginTop: '16px', padding: '0 4px' }}>
                            <div style={{
                                position: 'relative', height: '6px',
                                backgroundColor: '#E2E8F0', borderRadius: '999px'
                            }}>
                                <div style={{
                                    position: 'absolute', left: '10%',
                                    right: '40%', height: '100%',
                                    backgroundColor: '#0EA5E9',
                                    borderRadius: '999px'
                                }} />
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between', marginTop: '10px'
                            }}>
                                <span style={{
                                    fontSize: '13px', fontWeight: '700',
                                    color: '#1A56DB'
                                }}>₹500</span>
                                <span style={{
                                    fontSize: '13px', fontWeight: '700',
                                    color: '#1A56DB'
                                }}>₹2,000</span>
                            </div>
                        </div>
                    </div>

                    {/* Student Pass */}
                    <div style={{
                        background: 'linear-gradient(135deg, #EFF6FF, #EEF2FF)',
                        borderRadius: '12px', padding: '16px',
                        border: '1px solid #BFDBFE', marginTop: '8px'
                    }}>
                        <div style={{
                            fontWeight: '700', fontSize: '13px',
                            color: '#1A56DB', marginBottom: '4px'
                        }}>
                            Student Pass Active
                        </div>
                        <div style={{
                            fontSize: '12px', color: '#475569',
                            lineHeight: '1.5'
                        }}>
                            Extra 15-25% off IRCTC & Metro legs auto-applied.
                        </div>
                    </div>
                </aside>

                {/* RESULTS */}
                <main>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: '24px',
                        flexWrap: 'wrap', gap: '12px'
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '22px', fontWeight: '800',
                                color: '#0F172A', margin: '0 0 4px'
                            }}>
                                {`4 journeys found for ${
                                  selectedCorridor === 'juit'
                                    ? 'JUIT Waknaghat → Delhi'
                                    : 'Shimla → Delhi'
                                }`}
                            </h1>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '6px'
                            }}>
                                <CheckCircle size={14} color="#22C55E" />
                                <span style={{ fontSize: '13px', color: '#64748B' }}>
                                    All connecting legs guaranteed
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                                Routes shown are illustrative. Real routes updating soon.
                            </div>
                        </div>
                        <select style={{
                            padding: '10px 16px', borderRadius: '10px',
                            border: '1px solid #E2E8F0', fontSize: '13px',
                            fontWeight: '600', color: '#0F172A',
                            backgroundColor: '#fff', cursor: 'pointer',
                            outline: 'none'
                        }}>
                            <option>Sort: Recommended</option>
                            <option>Cheapest First</option>
                            <option>Fastest First</option>
                        </select>
                    </div>

                    {/* Journey Cards */}
                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {journeys.map((journey) => (
                            <article key={journey.id} style={{
                                backgroundColor: '#fff', borderRadius: '16px',
                                padding: '24px',
                                border: '1px solid #E2E8F0',
                                borderLeft: '4px solid ' + journey.accentColor,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                            }}>
                                {/* Badges */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center', marginBottom: '20px',
                                    flexWrap: 'wrap', gap: '8px'
                                }}>
                                    <div style={{
                                        display: 'flex', gap: '8px',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px',
                                            fontSize: '12px', fontWeight: '700',
                                            backgroundColor: journey.badgeBg,
                                            color: journey.badgeColor
                                        }}>
                                            {journey.badge}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px',
                                            fontSize: '12px', fontWeight: '700',
                                            backgroundColor: journey.tagBg,
                                            color: journey.tagColor
                                        }}>
                                            {journey.tag}
                                        </span>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '3px 10px',
                                            borderRadius: '999px',
                                            backgroundColor: journey.accentColor + '15',
                                            color: journey.accentColor,
                                            border: '1px solid ' + journey.accentColor + '40',
                                            marginLeft: '6px',
                                        }}>
                                            {computedRoutes[
                                                journey.id === 1 ? 'balanced'
                                                : journey.id === 2 ? 'cheapest'
                                                : journey.id === 3 ? 'comfort'
                                                : 'fastest'
                                            ]?.modes?.includes('flight') ? '✈ Flight'
                                            : computedRoutes[
                                                journey.id === 1 ? 'balanced'
                                                : journey.id === 2 ? 'cheapest'
                                                : journey.id === 3 ? 'comfort'
                                                : 'fastest'
                                            ]?.modes?.includes('train') ? '🚆 Train'
                                            : computedRoutes[
                                                journey.id === 1 ? 'balanced'
                                                : journey.id === 2 ? 'cheapest'
                                                : journey.id === 3 ? 'comfort'
                                                : 'fastest'
                                            ]?.modes?.includes('bus') ? '🚌 Bus'
                                            : '🚖 Cab'}
                                        </span>
                                    </div>
                                </div>

                                {/* Journey Path */}
                                <div style={{
                                    overflowX: 'auto',
                                    paddingBottom: '8px', marginBottom: '20px'
                                }}>
                                    <div style={{
                                        minWidth: '600px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'space-between',
                                        position: 'relative', padding: '8px 0'
                                    }}>

                                        {/* Origin node */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column', alignItems: 'center',
                                            textAlign: 'center', width: '80px',
                                            zIndex: 1
                                        }}>
                                            <div style={{
                                                width: '40px', height: '40px',
                                                borderRadius: '999px', backgroundColor: '#F1F5F9',
                                                border: '1px solid #E2E8F0', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <MapPin size={18} color="#1A56DB" />
                                            </div>
                                            <span style={{
                                                fontSize: '12px', fontWeight: '800',
                                                color: '#0F172A', marginTop: '6px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {journey.legs[0].from}
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#94A3B8',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {journey.legs[0].fromSub}
                                            </span>
                                        </div>

                                        {journey.legs.map((leg, i) => (
                                            <div key={`step-${i}`} style={{
                                                display: 'flex', alignItems: 'center',
                                                flex: 1
                                            }}>
                                                {/* Leg connector */}
                                                <div style={{
                                                    flex: 1,
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', position: 'relative',
                                                    padding: '0 4px'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '20px', left: 0, right: 0,
                                                        height: '2px', borderTop: `2px dashed ${leg.color}`,
                                                        zIndex: 0
                                                    }} />
                                                    <div style={{
                                                        zIndex: 1, backgroundColor: leg.bg,
                                                        border: `1px solid ${leg.color}30`,
                                                        color: leg.color, padding: '3px 8px',
                                                        borderRadius: '999px', fontSize: '11px',
                                                        fontWeight: '700', marginBottom: '4px',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {leg.mode}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '11px',
                                                        color: '#64748B', fontWeight: '600',
                                                        backgroundColor: '#fff', padding: '2px 6px',
                                                        borderRadius: '4px', zIndex: 1,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {leg.price} · {leg.time}
                                                    </div>
                                                </div>

                                                {/* Stop node */}
                                                <div style={{
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', textAlign: 'center',
                                                    width: '80px', zIndex: 1
                                                }}>
                                                    <div style={{
                                                        width: '40px', height: '40px',
                                                        borderRadius: '999px',
                                                        backgroundColor: '#F1F5F9',
                                                        border: '1px solid #E2E8F0',
                                                        display: 'flex', alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <MapPin
                                                            size={18}
                                                            color={i === journey.legs.length - 1 ? '#1A56DB' : '#64748B'}
                                                        />
                                                    </div>
                                                    {i === journey.legs.length - 1 ? (
                                                        <>
                                                            <div style={{ fontWeight: '800', color: '#0F172A' }}>
                                                                {journey.dest}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                                                {journey.destSub}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span style={{
                                                                fontSize: '11px',
                                                                fontWeight: '800', color: '#0F172A',
                                                                marginTop: '6px',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {journey.legs[i + 1].from}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                color: '#94A3B8',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {journey.legs[i + 1].fromSub}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Bottom row */}
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingTop: '16px',
                                    borderTop: '1px solid #F1F5F9',
                                    flexWrap: 'wrap', gap: '12px'
                                }}>
                                    <div style={{
                                        display: 'flex', gap: '24px',
                                        alignItems: 'center', flexWrap: 'wrap'
                                    }}>
                                        {journey.departs && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '13px',
                                                fontWeight: '700',
                                                color: '#1A56DB',
                                                backgroundColor: '#EFF6FF',
                                                padding: '4px 10px',
                                                borderRadius: '999px',
                                                border: '1px solid #BFDBFE',
                                            }}>
                                                <span>🕐</span>
                                                Departs {journey.departs}
                                            </div>
                                        )}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center', gap: '6px'
                                        }}>
                                            <Clock3 size={16} color="#94A3B8" />
                                            <span style={{
                                                fontSize: '14px',
                                                fontWeight: '700', color: '#0F172A'
                                            }}>
                                                {journey.duration}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{
                                                fontSize: '24px',
                                                fontWeight: '900', color: '#0EA5E9',
                                                letterSpacing: '-1px'
                                            }}>
                                                {journey.total}
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#94A3B8', marginLeft: '4px'
                                            }}>
                                                / person
                                            </span>
                                            <div style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              padding: '6px 0',
                                            }}>
                                              <div style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#64748B',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                              }}>
                                                AI Match
                                              </div>
                                              <div style={{
                                                flex: 1,
                                                height: '6px',
                                                backgroundColor: '#E2E8F0',
                                                borderRadius: '999px',
                                                overflow: 'hidden',
                                                minWidth: '60px',
                                              }}>
                                                <div style={{
                                                  height: '100%',
                                                  width: (journey.topsisScore >= 0.99
                                                    ? 95
                                                    : Math.round(journey.topsisScore * 100)
                                                  ) + '%',
                                                  backgroundColor: journey.topsisScore >= 0.8
                                                    ? '#22C55E'
                                                    : journey.topsisScore >= 0.6
                                                    ? '#1A56DB'
                                                    : journey.topsisScore >= 0.5
                                                    ? '#F59E0B'
                                                    : '#94A3B8',
                                                  borderRadius: '999px',
                                                  transition: 'width 0.3s ease',
                                                }} />
                                              </div>
                                              <div style={{
                                                fontSize: '12px',
                                                fontWeight: '800',
                                                color: journey.topsisScore >= 0.8
                                                  ? '#22C55E'
                                                  : journey.topsisScore >= 0.6
                                                  ? '#1A56DB'
                                                  : journey.topsisScore >= 0.5
                                                  ? '#F59E0B'
                                                  : '#94A3B8',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                              }}>
                                                {journey.topsisScore >= 0.99
                                                  ? '95%'
                                                  : Math.round(journey.topsisScore * 100) + '%'
                                                }
                                              </div>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '6px 12px', borderRadius: '999px',
                                            backgroundColor: '#F1F5F9', fontSize: '12px',
                                            fontWeight: '600', color: '#475569'
                                        }}>
                                            {journey.transfers}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const routeData = {
                                                label: journey.badge,
                                                total: journey.total,
                                                duration: journey.duration,
                                                topsisScore: journey.topsisScore,
                                                routeStops: journey.routeStops || [],
                                                fullLegs: (journey.rawLegs || []).map(leg => ({
                                                    mode: leg.mode,
                                                    operator: leg.operator,
                                                    from: leg.from || '',
                                                    to: leg.to || '',
                                                    cost: leg.cost || 0,
                                                    time: leg.time || 0,
                                                    serviceNo: leg.serviceNo || null,
                                                }))
                                            }
                                            localStorage.setItem('selectedRoute', JSON.stringify(routeData))
                                            navigate('/journey-builder')
                                        }}
                                        style={{
                                            backgroundColor: '#1A56DB', color: '#fff',
                                            padding: '12px 24px', borderRadius: '10px',
                                            fontWeight: '700', fontSize: '14px',
                                            border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}>
                                        View Details <ArrowRight size={16} />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div style={{
                        textAlign: 'center', padding: '40px 0',
                        color: '#94A3B8', fontSize: '13px'
                    }}>
                        Showing 4 of 4 results
                    </div>
                </main>
            </div>
        </div>
    )
}

export default SearchResults