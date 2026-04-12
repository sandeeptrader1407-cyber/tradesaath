import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/* ─── Types ─── */
export interface Trade {
  symbol: string; side: string; entry_price: number; exit_price: number
  quantity: number; entry_time: string; exit_time: string; pnl: number
  // from analysis
  tag?: string; tag_label?: string; quick_summary?: string
  technical_analysis?: string; psychology_coaching?: string
  counterfactual?: string; cycle_stage?: string
  trade_index?: number
}

export interface MomentumIndicator {
  name: string; score: number; description: string
}

export interface CycleStage {
  stage: string; count: number; icon: string; description: string
}

export interface TechnicalInsight {
  name: string; score: number; description: string
}

export interface DQS {
  score: number
  factors: { name: string; score: number; color: string }[]
}

export interface FinancialImpact {
  total_lost_to_mistakes: number
  potential_pnl_without_mistakes: number
  message: string
}

export interface MistakePattern {
  name: string; icon: string; count: number; cost: number; frequency: string
}

export interface TradeAnalysis {
  trade_index: number; tag: string; tag_label: string
  quick_summary: string; technical_analysis: string
  psychology_coaching: string; counterfactual: string; cycle_stage: string
}

export interface Analysis {
  session_summary?: string
  momentum_indicators?: MomentumIndicator[]
  vicious_cycle?: CycleStage[]
  technical_insights?: TechnicalInsight[]
  dqs?: DQS | null
  financial_impact?: FinancialImpact | null
  mistake_patterns?: MistakePattern[]
  rules_for_next_session?: string[]
  cross_user_insight?: string | null
  trade_analyses?: TradeAnalysis[]
}

export interface Metadata {
  detected_market: string; detected_currency: string
  detected_broker: string; trade_date: string
  trade_count: number; net_pnl: number
  processing_time_ms: number; is_demo?: boolean
}

export interface KPIs {
  net_pnl: number; total_trades: number; wins: number; losses: number
  win_rate: number; profit_factor: number
  best_trade_pnl: number; worst_trade_pnl: number
  gross_profit: number; gross_loss: number
  buy_value: number; sell_value: number
}

/* ─── Store ─── */
interface AnalysisStore {
  trades: Trade[]
  analysis: Analysis | null
  metadata: Metadata | null
  kpis: KPIs | null
  isLoading: boolean
  error: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape
  setAnalysis: (data: any) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

function computeKPIs(trades: Trade[]): KPIs {
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const buyValue = trades.reduce((s, t) => {
    if (t.side?.toUpperCase() === 'BUY') return s + (t.entry_price * t.quantity)
    return s + (t.exit_price * t.quantity)
  }, 0)
  const sellValue = trades.reduce((s, t) => {
    if (t.side?.toUpperCase() === 'SELL') return s + (t.entry_price * t.quantity)
    return s + (t.exit_price * t.quantity)
  }, 0)
  return {
    net_pnl: trades.reduce((s, t) => s + t.pnl, 0),
    total_trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0,
    profit_factor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 999 : 0,
    best_trade_pnl: trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0,
    worst_trade_pnl: trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0,
    gross_profit: grossWin,
    gross_loss: grossLoss,
    buy_value: buyValue,
    sell_value: sellValue,
  }
}

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      trades: [], analysis: null, metadata: null, kpis: null,
      isLoading: false, error: null,

      setAnalysis: (data) => {
        const trades = data.trades || []
        const analyses = data.analysis?.trade_analyses || []
        for (const a of analyses) {
          const idx = a.trade_index
          if (idx >= 0 && idx < trades.length) {
            trades[idx] = { ...trades[idx], ...a }
          }
        }
        set({
          trades,
          analysis: data.analysis || null,
          metadata: data.metadata || null,
          kpis: computeKPIs(trades),
          isLoading: false,
          error: null,
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),
      reset: () => set({ trades: [], analysis: null, metadata: null, kpis: null, isLoading: false, error: null }),
    }),
    {
      name: 'tradesaath-analysis',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        trades: state.trades,
        analysis: state.analysis,
        metadata: state.metadata,
        kpis: state.kpis,
      }),
    }
  )
)
