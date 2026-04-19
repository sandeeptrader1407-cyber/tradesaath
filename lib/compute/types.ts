import type { StandardTrade } from '../intake/types'

// ============================================================
// LAYER 1: ENRICHED TRADE
// (StandardTrade + all derived fields UI currently derives)
// ============================================================
export interface EnrichedTrade extends StandardTrade {
  // --- Indexing ---
  tradeIndex: number                    // 0-based position in session
  tradeNumberInSession: number          // 1-based for display
  isFirstTrade: boolean
  isLastTrade: boolean

  // --- Time breakdown (currently derived on-the-fly by UI) ---
  dayOfWeek: number                     // 0=Sun, 1=Mon, ..., 6=Sat
  dayOfWeekName: string                 // 'Monday', etc.
  hourOfDay: number                     // 0-23
  timeSlot30min: string                 // e.g., "09:15-09:45"
  timeSlot60min: string                 // e.g., "09:00-10:00"
  sessionProgress: number               // 0.0 to 1.0 within session
  timeSincePreviousTrade: number        // minutes, 0 if first

  // --- Holding ---
  durationMinutes: number               // exit - entry in minutes
  holdingCategory: 'scalp' | 'quick' | 'normal' | 'extended' | 'positional'
  // scalp: <2, quick: 2-10, normal: 10-60, extended: 60-240, positional: >240

  // --- Capital ---
  capitalDeployed: number
  capitalAsPercentOfPeak: number        // 0-100
  lotSize: number
  numberOfLots: number
  sizeVsSessionAvg: number              // 1.0 = normal
  sizeVsUserMedian: number
  isOversized: boolean                  // >2x session avg
  isUndersized: boolean                 // <0.5x session avg

  // --- P&L ---
  pnlPerLot: number
  pnlAsPercentOfCapital: number         // signed
  isWin: boolean
  isLoss: boolean
  isBreakeven: boolean                  // abs(pnl) < 0.5% of capital
  cumulativePnl: number                 // BEFORE this trade
  cumulativePnlAfter: number            // AFTER this trade
  drawdownFromPeak: number              // peak - current, 0 if at peak

  // --- Sequence ---
  consecutiveWins: number               // ending at this trade
  consecutiveLosses: number             // ending at this trade
  winStreakBroken: boolean
  lossStreakExtended: boolean

  // --- Pattern attribution (filled by pattern detector) ---
  detectedTag: PatternTag | null        // single tag per trade
  tagConfidence: 'high' | 'medium' | 'low' | null
  tagCost: number                       // excess loss attributed, 0 if no tag

  // --- Vicious cycle stage (filled by cycle detector) ---
  cycleStageName: ViciousCycleStageName | null
  cycleStageNumber: number | null       // 1-10 or null
}

// ============================================================
// LAYER 2: PATTERN DETECTION (already working — 9 tags)
// ============================================================
export type PatternTag =
  | 'revenge'
  | 'averaging'
  | 'fomo'
  | 'panic'
  | 'overtrading'
  | 'oversize'
  | 'late_exit'
  | 'disciplined'
  | 'win'

export interface SignalResult {
  name: string
  weight: number
  value: number
  detail: string
}

export interface DetectedPattern {
  tradeIndex: number
  tag: PatternTag
  confidence: 'high' | 'medium' | 'low'
  score: number
  cost: number
  signals: SignalResult[]
  description: string
}

export interface PatternSummary {
  byTag: Array<{
    tag: PatternTag
    label: string
    count: number
    totalCost: number
    avgCost: number
  }>
  totalMistakeCost: number
  totalMistakeCount: number
  tagRate: number                       // tagged / total
  costCapped: boolean                   // 85% cap applied?
  validationIssues: string[]
}

// ============================================================
// LAYER 3: VICIOUS CYCLE (10 stages — MAJOR UPGRADE)
// Currently only 3 stages, need to expand to 10
// ============================================================
export type ViciousCycleStageName =
  | 'disciplined_win'       // 1. Trading well
  | 'overconfidence'        // 2. Size creeping up
  | 'oversized_position'    // 3. Way too big
  | 'market_reversal'       // 4. Turned against you
  | 'hope_and_hold'         // 5. Holding for recovery
  | 'averaging_down'        // 6. Adding to loser
  | 'panic_exit'            // 7. Exit at worst moment
  | 'revenge_trade'         // 8. Trying to win it back
  | 'tilt'                  // 9. Random emotional trades
  | 'fomo_reentry'          // 10. Chasing next move

export interface ViciousCycleStage {
  tradeIndex: number
  stageName: ViciousCycleStageName
  stageNumber: number
  description: string
  signals: SignalResult[]               // why this stage was detected
}

export interface ViciousCycle {
  startIndex: number
  endIndex: number
  tradeIndices: number[]
  stages: ViciousCycleStage[]           // ordered sequence of stages
  totalCost: number
  durationMinutes: number
  description: string                   // "Overconfidence → Oversized → Panic"
  severity: 'mild' | 'moderate' | 'severe'
}

// ============================================================
// LAYER 4: DQS (already fully implemented — 7 sub-scores)
// ============================================================
export interface DQSSubScore {
  name: string
  score: number                         // 0-100
  weight: number                        // percentage
  detail: string
  suggestion: string
}

export interface DQSResult {
  overall: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  subScores: {
    riskManagement: DQSSubScore         // 25%
    emotionalControl: DQSSubScore       // 20%
    positionSizing: DQSSubScore         // 15%
    exitDiscipline: DQSSubScore         // 15%
    entryQuality: DQSSubScore           // 10%
    exitTiming: DQSSubScore             // 10%
    ruleFollowing: DQSSubScore          // 5%
  }
  biggestDrag: {
    factorName: string
    currentScore: number
    potentialImprovement: number
  }
}

// ============================================================
// LAYER 5: INSIGHTS
// ============================================================
export interface TradeInsight {
  tradeIndex: number
  insight: string
  highlights: string[]
  severity: 'info' | 'positive' | 'warning' | 'critical'
}

export interface SessionInsights {
  narrative: string                     // code-generated 3-4 sentence
  aiCoaching: string                    // Haiku 2-sentence (existing)
  tradeInsights: TradeInsight[]
  keyStats: {
    longestHold: { minutes: number; tradeIndex: number }
    shortestHold: { minutes: number; tradeIndex: number }
    biggestWin: { amount: number; tradeIndex: number }
    biggestLoss: { amount: number; tradeIndex: number }
    peakCapital: number
    turningPoint: { tradeIndex: number; description: string } | null
    tradingStyle: 'scalper' | 'intraday' | 'swing' | 'mixed'
  }
  behavioralHighlights: Array<{
    icon: string
    title: string
    description: string
    severity: 'info' | 'warning' | 'critical'
  }>
}

// ============================================================
// LAYER 6: AGGREGATE METRICS (NEW — audit found gaps)
// ============================================================

// --- Per-symbol breakdown (currently missing) ---
export interface PerSymbolMetrics {
  symbol: string
  tradeCount: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnl: number
  avgPnl: number
  bestTrade: number
  worstTrade: number
  avgHoldingMinutes: number
  totalCapitalDeployed: number
}

// --- Time slot breakdown (currently only best-slot extracted) ---
export interface TimeSlotMetrics {
  slot: string                          // e.g., "09:15-09:45"
  startHour: number
  startMinute: number
  tradeCount: number
  winCount: number
  winRate: number
  totalPnl: number
  avgPnl: number
}

// --- Day of week breakdown ---
export interface DayOfWeekMetrics {
  dayOfWeek: number
  dayName: string
  tradeCount: number
  winCount: number
  winRate: number
  totalPnl: number
  avgPnl: number
  bestTrade: number
  worstTrade: number
}

// --- Holding time distribution ---
export interface HoldingTimeDistribution {
  bucket: 'scalp' | 'quick' | 'normal' | 'extended' | 'positional'
  label: string
  tradeCount: number
  winRate: number
  avgPnl: number
  totalPnl: number
}

// --- Best/worst trades (top N) ---
export interface BestWorstTrades {
  top5Wins: Array<{
    tradeIndex: number
    symbol: string
    pnl: number
    date: string
    entryTime: string
  }>
  worst5Losses: Array<{
    tradeIndex: number
    symbol: string
    pnl: number
    date: string
    entryTime: string
    tag: PatternTag | null
  }>
}

// --- Equity curve points (enhanced) ---
export interface EquityCurvePoint {
  tradeIndex: number
  tradeNumber: number
  timestamp: string
  cumulativePnl: number
  drawdownFromPeak: number
  isNewPeak: boolean
}

// ============================================================
// LAYER 7: SESSION METRICS (cross-layer aggregates)
// ============================================================
export interface SessionMetrics {
  totalTrades: number
  winCount: number
  lossCount: number
  breakevenCount: number
  winRate: number

  totalPnl: number
  grossProfit: number
  grossLoss: number
  profitFactor: number

  totalCapitalDeployed: number
  peakCapitalAtOneTime: number
  avgCapitalPerTrade: number

  avgHoldingMinutes: number
  medianHoldingMinutes: number

  avgWin: number
  avgLoss: number
  riskRewardRatio: number
  expectancy: number

  bestTradePnl: number
  bestTradeIndex: number
  worstTradePnl: number
  worstTradeIndex: number

  morningPnl: number                    // first 25% of trades
  middayPnl: number                     // middle 50%
  afternoonPnl: number                  // last 25%

  turningPointIndex: number | null
  hasRealTimeData: boolean
  tradingStyle: 'scalper' | 'intraday' | 'swing' | 'mixed'
}

// ============================================================
// FINAL: COMPLETE ANALYSIS RESULT
// This is what Module 2 produces and Module 3 reads
// ============================================================
export interface ComputeResult {
  version: number                       // bump when logic changes
  analysedAt: string                    // ISO timestamp

  // Core data
  enrichedTrades: EnrichedTrade[]
  sessionMetrics: SessionMetrics

  // Patterns
  patterns: DetectedPattern[]
  patternSummary: PatternSummary

  // Vicious cycles (10-stage)
  viciousCycles: ViciousCycle[]

  // Scoring
  dqs: DQSResult

  // Insights
  insights: SessionInsights

  // Aggregate breakdowns
  perSymbol: PerSymbolMetrics[]
  timeSlots30min: TimeSlotMetrics[]
  timeSlots60min: TimeSlotMetrics[]
  dayOfWeek: DayOfWeekMetrics[]
  holdingDistribution: HoldingTimeDistribution[]
  bestWorstTrades: BestWorstTrades
  equityCurve: EquityCurvePoint[]

  // Metadata
  warnings: string[]
  processingTimeMs: number
}

// ============================================================
// USER BASELINE (for relative comparisons)
// ============================================================
export interface UserBaseline {
  medianQty: number
  avgDailyTrades: number
  avgLossPerTrade: number
  avgWinPerTrade: number
  avgHoldingMinutes: number
  totalSessionsAnalysed: number
  computedAt: string
}
