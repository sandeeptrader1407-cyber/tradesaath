'use client'

/**
 * CyclePipeline — vertical 10-stage Vicious Cycle visualizer.
 *
 * Two render modes share one component so the canonical 10-stage order +
 * label set is defined exactly once (PIPELINE_STAGES below):
 *
 *   mode='aggregate' — session-level rollup. Pass props.stages from
 *     analysis.vicious_cycle. Each stage row shows: marker + label +
 *     count badge + (optional) description. A stage is "active" when its
 *     count > 0.
 *
 *   mode='trade' — per-trade highlight. Pass props.activeStage which can
 *     be either a short code ("rvg") or the full label ("Revenge Trade")
 *     in any case. Exactly the matching stage row is highlighted.
 *
 * The 10 stages are HARDCODED here (not derived from props) to guarantee
 * order and presence even when the API or summarizer omits a stage.
 */

interface CycleStageEntry {
  stage: string
  count: number
  description?: string
}

interface CyclePipelineProps {
  mode: 'aggregate' | 'trade'
  /** Aggregate mode only: session-level cycle rollup. */
  stages?: CycleStageEntry[]
  /** Trade mode only: short code or full stage name. Case-insensitive. */
  activeStage?: string
}

const PIPELINE_STAGES = [
  { code: 'win',      label: 'Disciplined Win'      },
  { code: 'overconf', label: 'Overconfidence'       },
  { code: 'large',    label: 'Larger Position'      },
  { code: 'vs',       label: 'Market Goes Against'  },
  { code: 'hope',     label: 'Hope & Hold'          },
  { code: 'avg',      label: 'Averaging Down'       },
  { code: 'pnc',      label: 'Panic Exit'           },
  { code: 'rvg',      label: 'Revenge Trade'        },
  { code: 'fatigue',  label: 'Decision Fatigue'     },
  { code: 'fomo',     label: 'FOMO Re-entry'        },
] as const

/** Trade-mode active match: accept either short code or full label. */
function isActive(stageCode: string, stageLabel: string, active: string | undefined): boolean {
  if (!active) return false
  const a = active.toLowerCase().trim()
  return a === stageCode.toLowerCase()
      || a.includes(stageLabel.toLowerCase())
      || a.includes(stageCode.toLowerCase())
}

export default function CyclePipeline({ mode, stages, activeStage }: CyclePipelineProps) {
  const isTrade = mode === 'trade'

  // Compact spacing/sizing for trade mode; generous for aggregate.
  const markerSize = 16
  const rowGap = isTrade ? 14 : 24
  const labelFontSize = isTrade ? 11 : 13
  const sidePadding = isTrade ? 0 : 16

  // Aggregate mode: build a label/code → entry lookup so we can match
  // canonical stages to whatever the API actually returned.
  const stageMap = new Map<string, CycleStageEntry>()
  if (stages) {
    for (const s of stages) {
      const key = s.stage.toLowerCase().trim()
      if (!stageMap.has(key)) stageMap.set(key, s)
    }
  }

  return (
    <div
      style={{
        width: isTrade ? 'fit-content' : '100%',
        paddingLeft: sidePadding,
        paddingRight: sidePadding,
        position: 'relative',
      }}
    >
      {PIPELINE_STAGES.map((s, idx) => {
        let active = false
        let entry: CycleStageEntry | undefined

        if (isTrade) {
          active = isActive(s.code, s.label, activeStage)
        } else {
          entry = stageMap.get(s.label.toLowerCase()) ?? stageMap.get(s.code.toLowerCase())
          active = !!entry && entry.count > 0
        }

        const isLast = idx === PIPELINE_STAGES.length - 1
        const count = entry?.count ?? 0
        const description = entry?.description

        return (
          <div
            key={s.code}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              paddingBottom: isLast ? 0 : rowGap,
            }}
          >
            {/* Vertical connector — runs from below this marker to the next */}
            {!isLast && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: markerSize / 2 - 1,
                  top: markerSize + 2,
                  width: 2,
                  height: rowGap + 4,
                  background: 'var(--color-border)',
                }}
              />
            )}

            {/* Circle marker */}
            <div
              style={{
                flexShrink: 0,
                width: markerSize,
                height: markerSize,
                borderRadius: '50%',
                background: active ? 'var(--color-loss)' : 'var(--color-canvas)',
                border: active ? '2px solid var(--color-loss)' : '1px solid var(--color-border)',
                boxShadow: active ? '0 0 0 4px rgba(192,57,43,0.15)' : 'none',
                opacity: active ? 1 : 0.5,
                marginTop: 2,
                position: 'relative',
                zIndex: 1,
                boxSizing: 'border-box',
              }}
            />

            {/* Right side: label (+ count + description in aggregate mode) */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isTrade ? (
                <span
                  style={{
                    fontSize: labelFontSize,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--color-loss)' : 'var(--color-muted)',
                    opacity: active ? 1 : 0.7,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </span>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: description ? 4 : 0 }}>
                    <span
                      style={{
                        fontSize: labelFontSize,
                        fontFamily: 'var(--font-sans)',
                        fontWeight: active ? 500 : 400,
                        color: active ? 'var(--color-loss)' : 'var(--color-ink)',
                        opacity: active ? 1 : 0.75,
                        lineHeight: 1.3,
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: 22,
                        textAlign: 'center',
                        padding: '1px 7px',
                        borderRadius: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 500,
                        background: active ? 'rgba(192,57,43,0.1)' : 'var(--color-canvas)',
                        color: active ? 'var(--color-loss)' : 'var(--color-muted)',
                        border: active
                          ? '0.5px solid rgba(192,57,43,0.25)'
                          : '0.5px solid var(--color-border)',
                      }}
                    >
                      {count}
                    </span>
                  </div>
                  {description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--color-muted)',
                        opacity: active ? 0.85 : 0.6,
                        lineHeight: 1.5,
                      }}
                    >
                      {description}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
