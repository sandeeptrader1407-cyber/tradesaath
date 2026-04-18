import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/* --- Trading Context Types --- */
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

/* --- Market & Broker Detection from filenames --- */
const BROKER_PATTERNS: [RegExp, string, string][] = [
  [/zerodha|kite/i, 'Zerodha', 'NSE'],
  [/upstox|rksv/i, 'Upstox', 'NSE'],
  [/angelone|angel.?one|angel.?broking/i, 'Angel One', 'NSE'],
  [/groww/i, 'Groww', 'NSE'],
  [/5paisa|5.?paisa/i, '5Paisa', 'NSE'],
  [/icici.?direct|icicidirect/i, 'ICICI Direct', 'NSE'],
  [/hdfc.?sec|hdfcsec/i, 'HDFC Securities', 'NSE'],
  [/kotak/i, 'Kotak Securities', 'NSE'],
  [/fyers/i, 'Fyers', 'NSE'],
  [/dhan/i, 'Dhan', 'NSE'],
  [/paytm/i, 'Paytm Money', 'NSE'],
  [/motilal/i, 'Motilal Oswal', 'NSE'],
  [/sharekhan/i, 'Sharekhan', 'NSE'],
  [/ibkr|interactive.?broker/i, 'Interactive Brokers', 'US'],
  [/tdameritrade|thinkorswim|schwab/i, 'TD Ameritrade', 'US'],
  [/robinhood/i, 'Robinhood', 'US'],
  [/webull/i, 'Webull', 'US'],
  [/trading.?212/i, 'Trading212', 'UK'],
  [/etoro/i, 'eToro', 'US'],
]

function detectFromFiles(files: File[]): { market: string | null; broker: string | null } {
  const names = files.map(f => f.name.toLowerCase()).join(' ')

  // Try broker-specific detection first
  for (const [pattern, brokerName, market] of BROKER_PATTERNS) {
    if (pattern.test(names)) {
      const flag = market === 'NSE' ? '\ud83c\uddee\ud83c\uddf3' : market === 'US' ? '\ud83c\uddfa\ud83c\uddf8' : '\ud83c\uddec\ud83c\udddf'
      return {
        market: `${flag} ${market === 'NSE' ? 'NSE / BSE' : market === 'US' ? 'US Market' : 'UK Market'} detected`,
        broker: brokerName,
      }
    }
  }

  // Generic market detection from content hints
  if (/nse|nifty|banknifty|sensex|bse/.test(names))
    return { market: '\ud83c\uddee\ud83c\uddf3 NSE / BSE detected', broker: null }
  if (/eurusd|gbpusd|forex|mt4|mt5|metatrader|fxcm|oanda/.test(names))
    return { market: '\ud83c\udf0d Forex detected', broker: null }
  if (/btc|eth|binance|coinbase|kucoin|crypto|wazirx|coindcx/.test(names))
    return { market: '\u20bf Crypto detected', broker: null }
  if (/spy|aapl|tsla|nyse|nasdaq/.test(names))
    return { market: '\ud83c\uddfa\ud83c\uddf8 US Market detected', broker: null }

  return { market: null, broker: null }
}

/* --- Store --- */
interface UploadStore {
  /* state */
  files: File[]
  context: TradingContext
  detectedMarket: string | null
  detectedBroker: string | null
  analysisState: AnalysisState

  /* actions */
  addFiles: (newFiles: File[]) => void
  removeFile: (index: number) => void
  setContext: <K extends keyof TradingContext>(key: K, value: TradingContext[K]) => void
  setDetectedBroker: (broker: string | null) => void
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
      detectedBroker: null,
      analysisState: 'idle' as AnalysisState,

      addFiles: (newFiles) => {
        const current = get().files
        const combined = [...current, ...newFiles].slice(0, 40)
        const detected = detectFromFiles(combined)
        set({
          files: combined,
          detectedMarket: detected.market,
          detectedBroker: detected.broker || get().detectedBroker,
          analysisState: combined.length > 0 ? 'idle' : get().analysisState,
        })
      },

      removeFile: (index) => {
        const updated = get().files.filter((_, i) => i !== index)
        const detected = updated.length > 0 ? detectFromFiles(updated) : { market: null, broker: null }
        set({
          files: updated,
          detectedMarket: detected.market,
          detectedBroker: detected.broker,
        })
      },

      setContext: (key, value) =>
        set((s) => ({ context: { ...s.context, [key]: value } })),

      setDetectedBroker: (broker) => set({ detectedBroker: broker }),

      setAnalysisState: (state) => set({ analysisState: state }),

      reset: () =>
        set({
          files: [],
          context: { ...defaultContext },
          detectedMarket: null,
          detectedBroker: null,
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
