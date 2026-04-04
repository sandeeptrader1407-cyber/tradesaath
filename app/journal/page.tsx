'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUserPlan } from '@/hooks/useUserPlan'

interface Trade {
  id: number; time: string; symbol: string; side: 'BUY' | 'SELL'
  qty: number; entry: number; exit: number; pnl: number; cumPnl: number
  fills: { qty: number; price: number }[]
}

interface PerTrade {
  tradeIndex: number; tag: string; tagColor: string; label: string
  quickSummary: string; psychologyNote: string; technicalNote: string
}

interface Analysis {
  summary: string; dqsScore: number
  perTrade: PerTrade[]
  patterns: { name: string; icon: string; costInRupees: number; frequency: string }[]
  rulesForNextSession: string[]
}

interface Session {
  id: string
  created_at: string
  broker: string | null
  trades: Trade[]
  analysis: Analysis | null
  total_pnl: number
  trade_count: number
  win_rate: number
  dqs_score: number
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: 'rgba(54,211,153,.1)', color: 'var(--green)' },
  blue: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
  orange: { bg: 'rgba(242,155,75,.1)', color: 'var(--orange)' },
  red: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
  purple: { bg: 'rgba(157,122,247,.1)', color: 'var(--purple)' },
  gold: { bg: 'rgba(240,180,41,.1)', color: 'var(--gold)' },
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN')
}

export default function JournalPage() {
  const { isPaid, isPro, loading: planLoading, plan } = useUserPlan()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'sessions' | 'journey'>('sessions')
  const [journeyStep, setJourneyStep] = useState(0)
  const [journeyData, setJourneyData] = useState<{
    experience: string; market: string; role: string; struggles: string[]; story: string
    afterLoss: string[]; goal: string; perfectDay: string; oneChange: string
  }>({
    experience: '', market: '', role: '', struggles: [], story: '',
    afterLoss: [], goal: '', perfectDay: '', oneChange: '',
  })
  const [journeySaved, setJourneySaved] = useState(false)

  useEffect(() => {
    // Load saved journey data
    const saved = localStorage.getItem('tradesaath_journey')
    if (saved) {
      try { setJourneyData(JSON.parse(saved)); setJourneySaved(true) } catch { /* ignore */ }
    }
    // Fetch sessions from Supabase
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || planLoading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading journal...</div></div>
      </section>
    )
  }

  // Journal requires a paid plan (single report or pro)
  if (!isPaid) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>Trading Journal</h2>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
              The Journal saves all your sessions with AI insights, pattern spotting, and trade timeline. Upgrade to unlock.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/pricing" className="btn btn-accent">View Plans</Link>
              <Link href="/upload" className="btn btn-ghost">Upload Trades</Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 4 }}>Trading Journal</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>0 sessions</div>
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>No Sessions Yet</h3>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
              Upload and analyse trades to build your journal. Each session becomes a journal entry with AI insights.
            </p>
            <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
          </div>
        </div>
      </section>
    )
  }

  const filtered = sessions.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    const d = new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    return d.toLowerCase().includes(q) || (s.broker || '').toLowerCase().includes(q)
  })

  const selected = filtered[selectedIdx] || filtered[0]

  // Aggregate stats
  const totalPnl = sessions.reduce((s, sess) => s + (sess.total_pnl || 0), 0)
  const totalTrades = sessions.reduce((s, sess) => s + (sess.trade_count || 0), 0)
  const totalWins = sessions.reduce((s, sess) => {
    return s + Math.round((sess.win_rate || 0) / 100 * (sess.trade_count || 0))
  }, 0)
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0

  // Most common mistake tag
  const tagCounts: Record<string, number> = {}
  sessions.forEach(s => {
    if (s.analysis?.perTrade) {
      s.analysis.perTrade.forEach(pt => {
        if (pt.label && pt.tagColor !== 'green') {
          tagCounts[pt.label] = (tagCounts[pt.label] || 0) + 1
        }
      })
    }
  })
  const topMistake = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]

  // Pattern Intelligence: check last 5 sessions for >35% recurring tags
  const last5 = sessions.slice(0, 5)
  const last5Total = last5.reduce((s, sess) => s + (sess.analysis?.perTrade?.length || 0), 0)
  const last5Tags: Record<string, number> = {}
  last5.forEach(s => {
    if (s.analysis?.perTrade) {
      s.analysis.perTrade.forEach(pt => {
        if (pt.label && pt.tagColor !== 'green') {
          last5Tags[pt.label] = (last5Tags[pt.label] || 0) + 1
        }
      })
    }
  })
  const patternAlerts = Object.entries(last5Tags)
    .filter(([, count]) => last5Total > 0 && (count / last5Total) > 0.35)
    .sort((a, b) => b[1] - a[1])

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 4 }}>Trading Journal</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sessions.length} sessions &middot; Pattern intelligence active</div>
          </div>
          <Link href="/upload" className="btn btn-ghost btn-sm">New Analysis &rarr;</Link>
        </div>

        {/* Tab Switcher — Sessions | Trading Journey */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--s2)', borderRadius: 'var(--radius-sm)', padding: 3, width: 'fit-content' }}>
          <button onClick={() => setTab('sessions')} style={{
            padding: '7px 18px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: tab === 'sessions' ? 'var(--accent)' : 'transparent',
            color: tab === 'sessions' ? 'var(--bg)' : 'var(--muted)',
          }}>Sessions</button>
          <button onClick={() => setTab('journey')} style={{
            padding: '7px 18px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: tab === 'journey' ? 'var(--accent)' : 'transparent',
            color: tab === 'journey' ? 'var(--bg)' : 'var(--muted)',
          }}>Trading Journey</button>
        </div>

        {/* Trading Journey Tab */}
        {tab === 'journey' && (
          <div style={{ maxWidth: 700 }}>
            {/* Self-Profiling Questionnaire */}
            {!journeySaved ? (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-head">Your Trading Profile</div>
                <div className="card-body">
                  <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 16, lineHeight: 1.7 }}>
                    Help TradeSaath understand you better. This powers personalized coaching and insights.
                  </div>

                  {/* Step indicator */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                    {[0, 1].map(s => (
                      <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: journeyStep >= s ? 'var(--accent)' : 'rgba(255,255,255,.06)' }} />
                    ))}
                  </div>

                  {journeyStep === 0 && (
                    <>
                      {/* Story */}
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Tell us your trading story</label>
                        <textarea value={journeyData.story} onChange={e => setJourneyData(d => ({ ...d, story: e.target.value }))}
                          placeholder="How did you start trading? What keeps you going? Any memorable wins or losses?"
                          style={{ width: '100%', minHeight: 80, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, resize: 'vertical', lineHeight: 1.7 }} />
                      </div>

                      {/* Quick Profile Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>Trading experience</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['< 6 months', '6-12 months', '1-3 years', '3+ years'].map(opt => (
                              <button key={opt} onClick={() => setJourneyData(d => ({ ...d, experience: opt }))}
                                className={`j-pill${journeyData.experience === opt ? ' on' : ''}`}
                                style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>Primary market</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['NSE Options', 'Equity', 'Crypto', 'Forex'].map(opt => (
                              <button key={opt} onClick={() => setJourneyData(d => ({ ...d, market: opt }))}
                                className={`j-pill${journeyData.market === opt ? ' on' : ''}`}
                                style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>Trading is your...</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['Primary income', 'Side income', 'Learning'].map(opt => (
                              <button key={opt} onClick={() => setJourneyData(d => ({ ...d, role: opt }))}
                                className={`j-pill${journeyData.role === opt ? ' on' : ''}`}
                                style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>Biggest struggles (pick all)</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['Revenge trading', 'Cutting losses', 'FOMO', 'Overtrading', 'No system'].map(opt => (
                              <button key={opt} onClick={() => setJourneyData(d => {
                                const s = d.struggles.includes(opt) ? d.struggles.filter(x => x !== opt) : [...d.struggles, opt]
                                return { ...d, struggles: s }
                              })}
                                className={`j-pill${journeyData.struggles.includes(opt) ? ' on' : ''}`}
                                style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button className="btn btn-accent btn-sm" style={{ marginTop: 18 }} onClick={() => setJourneyStep(1)}>
                        Next &rarr;
                      </button>
                    </>
                  )}

                  {journeyStep === 1 && (
                    <>
                      {/* Deep questions */}
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>How do you feel after a losing day?</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['Angry/frustrated', 'Anxious/worried', 'Want to trade more', 'Give up/hopeless', 'Calm/accepting'].map(opt => (
                            <button key={opt} onClick={() => setJourneyData(d => {
                              const a = d.afterLoss.includes(opt) ? d.afterLoss.filter(x => x !== opt) : [...d.afterLoss, opt]
                              return { ...d, afterLoss: a }
                            })}
                              className={`j-pill${journeyData.afterLoss.includes(opt) ? ' on' : ''}`}
                              style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>What&apos;s your trading goal?</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['Consistent income', 'Capital growth', 'Stop losing money', 'Go full-time'].map(opt => (
                            <button key={opt} onClick={() => setJourneyData(d => ({ ...d, goal: opt }))}
                              className={`j-pill${journeyData.goal === opt ? ' on' : ''}`}
                              style={{ padding: '5px 12px', fontSize: 11 }}>{opt}</button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Describe your perfect trading day</label>
                        <textarea value={journeyData.perfectDay} onChange={e => setJourneyData(d => ({ ...d, perfectDay: e.target.value }))}
                          placeholder="What does an ideal session look like for you?"
                          style={{ width: '100%', minHeight: 60, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, resize: 'vertical', lineHeight: 1.7 }} />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>If you could change ONE thing about your trading?</label>
                        <textarea value={journeyData.oneChange} onChange={e => setJourneyData(d => ({ ...d, oneChange: e.target.value }))}
                          placeholder="What would make the biggest difference?"
                          style={{ width: '100%', minHeight: 60, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, resize: 'vertical', lineHeight: 1.7 }} />
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setJourneyStep(0)}>&larr; Back</button>
                        <button className="btn btn-accent btn-sm" onClick={() => {
                          localStorage.setItem('tradesaath_journey', JSON.stringify(journeyData))
                          setJourneySaved(true)
                        }}>
                          Save Profile &rarr;
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Saved profile summary */
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Your Trading Profile</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setJourneySaved(false)}>Edit</button>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {journeyData.experience && (
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Experience</div><div style={{ fontSize: 13, fontWeight: 600 }}>{journeyData.experience}</div></div>
                    )}
                    {journeyData.market && (
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Market</div><div style={{ fontSize: 13, fontWeight: 600 }}>{journeyData.market}</div></div>
                    )}
                    {journeyData.role && (
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Role</div><div style={{ fontSize: 13, fontWeight: 600 }}>{journeyData.role}</div></div>
                    )}
                    {journeyData.goal && (
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Goal</div><div style={{ fontSize: 13, fontWeight: 600 }}>{journeyData.goal}</div></div>
                    )}
                  </div>
                  {journeyData.struggles.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Biggest Struggles</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {journeyData.struggles.map(s => (
                          <span key={s} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 12, background: 'rgba(244,63,94,.08)', color: 'var(--red)', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {journeyData.story && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Your Story</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>{journeyData.story}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session Timeline */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Your Trading Journey</div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 16 }}>
                  A timeline of your growth as a trader. Each session adds to your story.
                </div>

                {sessions.slice().reverse().map((s, i) => {
                  const d = new Date(s.created_at)
                  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  const pnl = s.total_pnl || 0
                  const dqs = s.dqs_score || 0
                  const isGreen = pnl >= 0
                  const isFirstSession = i === 0

                  return (
                    <div key={s.id} style={{
                      display: 'flex', gap: 14, marginBottom: 0, padding: '14px 0',
                      borderLeft: `2px solid ${isGreen ? 'rgba(54,211,153,.3)' : 'rgba(240,93,108,.3)'}`,
                      marginLeft: 8, paddingLeft: 18, position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', left: -6, top: 18, width: 10, height: 10, borderRadius: '50%',
                        background: isGreen ? 'var(--green)' : 'var(--red)',
                        border: '2px solid var(--bg)',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{dateStr}</span>
                          {isFirstSession && <span style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(62,232,196,.1)', color: 'var(--accent)', borderRadius: 10, fontWeight: 700 }}>FIRST SESSION</span>}
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.broker || 'Trades'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                          <span style={{ color: isGreen ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtPnl(pnl)}</span>
                          <span style={{ color: 'var(--muted)' }}>{s.trade_count || 0} trades</span>
                          <span style={{ color: 'var(--muted)' }}>WR {s.win_rate || 0}%</span>
                          <span style={{ color: dqs >= 60 ? 'var(--green)' : dqs >= 40 ? 'var(--gold)' : 'var(--red)' }}>DQS {dqs}</span>
                        </div>
                        {s.analysis?.summary && (
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>
                            {s.analysis.summary.slice(0, 150)}{s.analysis.summary.length > 150 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {sessions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                    Upload your first session to start your journey.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && <div className="journal-layout">
          {/* Sidebar */}
          <div className="journal-sidebar">
            <div className="j-sb-head">
              <div className="j-sb-title">Sessions</div>
              <input className="j-search" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setSelectedIdx(0) }} />
            </div>
            <div className="j-sess-list">
              {filtered.map((s, i) => {
                const d = new Date(s.created_at)
                const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                return (
                  <div key={s.id} className={`j-sess${i === selectedIdx ? ' active' : ''}`} onClick={() => setSelectedIdx(i)}>
                    <div className="j-sess-date">{dateStr}</div>
                    <div className="j-sess-meta">
                      <span>{s.broker || 'Trades'}</span>
                      <span>{s.trade_count || 0} trades</span>
                      <span className="j-sess-pnl" style={{ color: (s.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPnl(s.total_pnl || 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Main */}
          <div className="journal-main">
            {/* Stats Strip */}
            <div className="j-stats-row">
              <div className="j-stat">
                <div className="j-stat-lbl">Total Sessions</div>
                <div className="j-stat-val">{sessions.length}</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Total P&L</div>
                <div className="j-stat-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 16 }}>{fmtPnl(totalPnl)}</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Win Rate</div>
                <div className="j-stat-val">{winRate}%</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Most Common Mistake</div>
                <div className="j-stat-val" style={{ fontSize: 14 }}>{topMistake ? topMistake[0] : 'None'}</div>
                {topMistake && <div className="j-stat-sub">{topMistake[1]} times</div>}
              </div>
            </div>

            {/* Pattern Alerts */}
            {patternAlerts.length > 0 && (
              <div className="pattern-alert">
                <div className="pa-title">Pattern Intelligence: Recurring Behaviour Detected</div>
                <div className="pa-body">
                  {patternAlerts.map(([tag, count]) => (
                    <div key={tag} style={{ marginBottom: 4 }}>
                      <strong style={{ color: 'var(--red)' }}>{tag}</strong> detected in {count} of {last5Total} trades across last {last5.length} sessions
                      ({Math.round(count / last5Total * 100)}% frequency). This pattern is costing you consistently.
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Session Detail */}
            {selected && (
              <div className="timeline-card">
                <div className="tl-head">
                  Trade Timeline &mdash; {new Date(selected.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {selected.analysis && (
                    <span style={{ float: 'right', fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      DQS: {selected.analysis.dqsScore}/100
                    </span>
                  )}
                </div>
                <div className="tl-body">
                  {selected.analysis?.summary && (
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16, padding: '12px 16px', background: 'var(--s2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
                      {selected.analysis.summary}
                    </div>
                  )}

                  {(selected.trades || []).map((t, i) => {
                    const pt = selected.analysis?.perTrade?.find(p => p.tradeIndex === i)
                    const dotColor = t.pnl >= 0 ? 'var(--green)' : 'var(--red)'
                    return (
                      <div key={t.id || i} className="tl-item">
                        <div className="tl-dot-wrap">
                          <div className="tl-dot" style={{ borderColor: dotColor }} />
                        </div>
                        <div className="tl-content">
                          <div className="tl-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="tl-sym">{t.symbol}</span>
                              <span className={`side-badge side-${t.side.toLowerCase()}`} style={{ fontSize: 9 }}>{t.side}</span>
                              {pt && (
                                <span className="tag-pill" style={{
                                  background: TAG_COLORS[pt.tagColor]?.bg,
                                  color: TAG_COLORS[pt.tagColor]?.color,
                                  fontSize: 9
                                }}>
                                  {pt.label}
                                </span>
                              )}
                            </div>
                            <div className="tl-meta">
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {fmtPnl(t.pnl)}
                              </span>
                            </div>
                          </div>
                          {t.entry && t.exit && (
                            <div className="tl-entry-exit">Entry: &#8377;{t.entry} &rarr; Exit: &#8377;{t.exit} &middot; Qty: {t.qty}</div>
                          )}
                          {pt?.quickSummary && (
                            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{pt.quickSummary}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* View full analysis */}
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button className="btn btn-accent btn-sm" onClick={() => {
                      sessionStorage.setItem('tradesaath_results', JSON.stringify({
                        trades: selected.trades, analysis: selected.analysis, broker: selected.broker
                      }))
                      window.location.href = '/results'
                    }}>
                      View Full Analysis &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rules from last session */}
            {selected?.analysis?.rulesForNextSession && selected.analysis.rulesForNextSession.length > 0 && (
              <div className="card">
                <div className="card-head">Rules from This Session</div>
                <div className="card-body">
                  {selected.analysis.rulesForNextSession.map((rule, i) => (
                    <div key={i} className="action-item" style={{ borderLeft: '3px solid var(--accent)' }}>
                      <strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>}
      </div>
    </section>
  )
}
