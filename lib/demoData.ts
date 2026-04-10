/* ─── Demo data: 10 sample NSE options trades ─── */

export const DEMO_TRADES = [
  { symbol: 'NIFTY 24500 CE', side: 'BUY', entry_price: 245.50, exit_price: 282.30, quantity: 75, entry_time: '09:22', exit_time: '09:48', pnl: 2760 },
  { symbol: 'NIFTY 24500 CE', side: 'BUY', entry_price: 270.00, exit_price: 295.80, quantity: 75, entry_time: '09:55', exit_time: '10:12', pnl: 1935 },
  { symbol: 'NIFTY 24600 CE', side: 'BUY', entry_price: 198.00, exit_price: 172.50, quantity: 150, entry_time: '10:18', exit_time: '10:45', pnl: -3825 },
  { symbol: 'NIFTY 24600 CE', side: 'BUY', entry_price: 165.00, exit_price: 148.20, quantity: 150, entry_time: '10:48', exit_time: '11:05', pnl: -2520 },
  { symbol: 'BANKNIFTY 52000 PE', side: 'BUY', entry_price: 320.00, exit_price: 355.40, quantity: 30, entry_time: '11:30', exit_time: '12:15', pnl: 1062 },
  { symbol: 'NIFTY 24400 CE', side: 'BUY', entry_price: 310.00, exit_price: 288.50, quantity: 75, entry_time: '12:45', exit_time: '13:10', pnl: -1612.5 },
  { symbol: 'NIFTY 24400 CE', side: 'BUY', entry_price: 280.00, exit_price: 265.00, quantity: 150, entry_time: '13:12', exit_time: '13:30', pnl: -2250 },
  { symbol: 'BANKNIFTY 52200 CE', side: 'BUY', entry_price: 185.00, exit_price: 210.30, quantity: 30, entry_time: '14:05', exit_time: '14:35', pnl: 759 },
  { symbol: 'NIFTY 24500 PE', side: 'BUY', entry_price: 142.00, exit_price: 118.00, quantity: 75, entry_time: '14:42', exit_time: '15:05', pnl: -1800 },
  { symbol: 'NIFTY 24500 CE', side: 'BUY', entry_price: 205.00, exit_price: 198.50, quantity: 75, entry_time: '15:10', exit_time: '15:25', pnl: -487.5 },
]

export const DEMO_RESPONSE = {
  success: true,
  trades: DEMO_TRADES,
  analysis: {
    session_summary: `**Your morning was textbook** — two clean entries on NIFTY 24500 CE netted you +₹4,695 by 10:12. You read the trend, sized correctly, and exited with discipline. That's the trader you *can* be.\n\n**Then overconfidence crept in.** Trade #3 at 10:18 doubled your lot size to 150 on NIFTY 24600 CE — a higher strike, more aggressive bet. When it moved against you, instead of cutting at your mental stop, you averaged down just 3 minutes later (Trade #4). That two-trade sequence cost you ₹6,345 and wiped your entire morning profit.\n\n**The afternoon was a slow bleed of revenge and fatigue.** Trades #6-7 were classic revenge entries — you re-entered NIFTY 24400 CE within 2 minutes of each other, chasing recovery. By Trade #9 at 14:42, you'd switched to puts (NIFTY 24500 PE) with no clear thesis — a textbook decision-fatigue trade. **Your net session P&L: -₹5,978.** Without the averaging and revenge sequence, you'd be sitting at +₹2,759.`,

    momentum_indicators: [
      { name: 'Rule Following', score: 35, description: 'Rules followed on 3 of 10 trades — morning discipline collapsed after Trade #2' },
      { name: 'Staying Calm', score: 22, description: 'Emotional cascade from Trade #3 onward — 7 consecutive impulsive decisions' },
      { name: 'Entry Timing', score: 48, description: 'Morning entries were well-timed; afternoon entries chased moves already underway' },
      { name: 'Exit Discipline', score: 30, description: 'No stop losses honoured after Trade #2 — held losers hoping for reversal' },
    ],

    vicious_cycle: [
      { stage: 'Disciplined Win', count: 2, icon: '✓', description: 'Trades #1-2: clean CE entries, proper sizing, timely exits' },
      { stage: 'Overconfidence', count: 1, icon: '⚡', description: 'After +₹4,695 morning, felt invincible entering Trade #3' },
      { stage: 'Larger Position', count: 1, icon: '📈', description: 'Trade #3 doubled lots from 75 to 150' },
      { stage: 'Market Goes Against', count: 1, icon: '↘', description: 'NIFTY 24600 CE dropped 12.9% — ignored mental stop' },
      { stage: 'Hope & Hold', count: 1, icon: '🙏', description: 'Held Trade #3 hoping for bounce instead of cutting' },
      { stage: 'Averaging Down', count: 1, icon: '📉', description: 'Trade #4: added 150 more lots 3 min after Trade #3 entry' },
      { stage: 'Panic Exit', count: 1, icon: '💨', description: 'Exited both averaged positions at worst price' },
      { stage: 'Revenge Trade', count: 2, icon: '⚔', description: 'Trades #6-7: re-entered within 2 min to recover losses' },
      { stage: 'Decision Fatigue', count: 1, icon: '😵', description: 'Trade #9-10: random entries after 2 PM with no thesis' },
      { stage: 'FOMO Re-entry', count: 0, icon: '🔄', description: 'Not detected in this session' },
    ],

    technical_insights: [
      { name: 'Trend Alignment', score: 45, description: 'Morning trades aligned with uptrend; afternoon trades fought the range' },
      { name: 'Entry Structure', score: 40, description: 'OTM strikes on Trade #3 increased theta risk significantly' },
      { name: 'Exit Quality', score: 28, description: 'Exits were reactive, not planned — no pre-set targets or stops' },
      { name: 'Entry Timing', score: 52, description: '09:22 entry caught opening momentum; 14:42 put entry had no catalyst' },
    ],

    trade_analyses: DEMO_TRADES.map((t, i) => ({
      trade_index: i,
      tag: i < 2 ? 'win' : i < 4 ? 'avg' : i === 4 ? 'win' : i < 7 ? 'rvg' : i === 7 ? 'win' : 'pnc',
      tag_label: i < 2 ? 'Disciplined Win' : i < 4 ? 'Averaging Down' : i === 4 ? 'Disciplined Win' : i < 7 ? 'Revenge Trade' : i === 7 ? 'Disciplined Win' : 'Panic Exit',
      quick_summary: `Trade #${i + 1}: ${t.symbol} ${t.side} at ₹${t.entry_price} → ₹${t.exit_price} (${t.pnl >= 0 ? '+' : ''}₹${t.pnl}). ${t.pnl >= 0 ? 'Clean execution with proper sizing.' : 'Emotional entry following prior loss sequence.'}`,
      technical_analysis: `Entry at ₹${t.entry_price} during the ${t.entry_time < '12:00' ? 'morning' : 'afternoon'} session. ${t.pnl >= 0 ? 'Price action supported the entry with momentum.' : 'No clear structural support for this entry level.'}`,
      psychology_coaching: t.pnl >= 0
        ? 'This is the version of you that makes money. You waited, you sized correctly, and you exited when the trade gave you what it had. Remember this feeling.'
        : 'I know it felt like you had to get back in. But that urgency? That\'s not analysis — that\'s your amygdala talking. The fix isn\'t willpower — it\'s a mandatory 15-minute cool-down rule after any loss.',
      counterfactual: t.pnl < 0
        ? `If you had skipped this trade and waited for the next clean setup, you would have saved ₹${Math.abs(t.pnl).toLocaleString('en-IN')}. **RULE: No re-entry within 15 minutes of a loss.**`
        : `Good execution. Holding 5 more minutes could have captured ₹${Math.round(Math.abs(t.pnl) * 0.3)} more, but taking profit was the right call.`,
      cycle_stage: i < 2 ? 'win' : i === 2 ? 'overconf' : i === 3 ? 'avg' : i === 4 ? 'win' : i < 7 ? 'rvg' : i === 7 ? 'win' : 'fatigue',
    })),
  },
  metadata: {
    detected_market: 'NSE',
    detected_currency: 'INR',
    detected_broker: 'Zerodha',
    trade_date: '2026-03-12',
    trade_count: 10,
    net_pnl: -5978,
    processing_time_ms: 0,
    is_demo: true,
  },
}
