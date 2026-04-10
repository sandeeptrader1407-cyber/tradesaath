import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/* ─── Trading Context Types ─── */
export interface TradingContext {
  experience: string
  capital: string
  mood: string
  marketView: string
  stopLoss: string
  strategy: string
  plan: string
  notes: string
}

export type AnalysisState = 'idle' | 'uploading' | 'analysing' | 'parsed' | 'ai_running' | 'complete' | 'error'

/* ─── Market Detection ─── */
function detectMarketFromFiles(files: File[]): string | null {
  const names = files.map(f => f.name.toLowerCase()).join(' ')

  if (/nse|nifty|banknifty|sensex|bse|zerodha|upstox|groww|angelone|dhan|fyers/.test(names))
    return '🇮🇳 NSE / BSE detected'
  if (/eurusd|gbpusd|forex|mt4|mt5|metatrader|fxcm|oanda/.test(names))
    return '🌍 Forex detected'
  if (/btc|eth|binance|coinbase|kucoin|crypto|wazirx|coindcx/.test(names))
    return '₿ Crypto detected'
  if (/spy|aapl|tsla|nyse|nasdaq|amtd|schwab|robinhood|ibkr/.test(names))
    return '🇺🇸 US Market detected'

  return null
}

/* ─── Store ─── */
interface UploadStore {
  /* state */
  files: File[]
  context: TradingContext
  detectedMarket: string | null
  analysisState: AnalysisState

  /* actions */
  addFiles: (newFiles: File[]) => void
  removeFile: (index: number) => void
  setContext: <K extends keyof TradingContext>(key: K, value: TradingContext[K]) => void
  setAnalysisState: (state: AnalysisState) => void
  reset: () => void
}

const defaultContext: TradingContext = {
  experience: '',
  capital: '',
  mood: '',
  marketView: '',
  stopLoss: '',
  strategy: '',
  plan: '',
  notes: '',
}

export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      files: [],
      context: { ...defaultContext },
      detectedMarket: null,
      analysisState: 'idle' as AnalysisState,

      addFiles: (newFiles) => {
        const current = get().files
        const combined = [...current, ...newFiles].slice(0, 40)
        set({
          files: combined,
          detectedMarket: detectMarketFromFiles(combined),
          analysisState: combined.length > 0 ? 'idle' : get().analysisState,
        })
      },

      removeFile: (index) => {
        const updated = get().files.filter((_, i) => i !== index)
        set({
          files: updated,
          detectedMarket: updated.length > 0 ? detectMarketFromFiles(updated) : null,
        })
      },

      setContext: (key, value) =>
        set((s) => ({ context: { ...s.context, [key]: value } })),

      setAnalysisState: (state) => set({ analysisState: state }),

      reset: () =>
        set({
          files: [],
          context: { ...defaultContext },
          detectedMarket: null,
          analysisState: 'idle' as AnalysisState,
        }),
    }),
    {
      name: 'tradesaath-upload',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        analysisState: state.analysisState,
        context: state.context,
      }),
    }
  )
)
