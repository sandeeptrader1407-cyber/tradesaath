/**
 * Pattern registry — single source of truth for /patterns/[slug] SEO pages.
 *
 * Categories:
 *  - cycle-stage: One of the 10 Vicious Cycle stages (cycleStage 1-10).
 *  - cognitive-bias: A documented cognitive bias that affects trading.
 *  - emotional: Emotion-driven behavioural patterns.
 *  - behavioral: Observable trading-behaviour patterns.
 *
 * `relatedTerms` slugs MUST exist in lib/seo/glossaryRegistry.ts when
 * referenced. `slug` MUST be lowercase + hyphenated.
 */

export interface PatternInfo {
  slug: string
  name: string
  category: 'cycle-stage' | 'cognitive-bias' | 'emotional' | 'behavioral'
  /** Position in the Vicious Cycle (1-10) when category === 'cycle-stage'. */
  cycleStage?: number
  shortDef: string
  fullDef: string
  examples: string[]
  costToTrader: string
  howDetected: string
  howToFix: string[]
  relatedPatterns: string[]
  relatedTerms: string[]
}

export const PATTERNS: PatternInfo[] = [
  // ─────────────────────────────────────────────────────────────────
  // VICIOUS CYCLE STAGES (10) — ordered as the cycle plays out
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'disciplined-trade',
    name: 'Disciplined Trade',
    category: 'cycle-stage',
    cycleStage: 1,
    shortDef: 'A trade executed exactly per the trader\'s pre-defined plan — clear thesis, sized correctly, exited at the planned level.',
    fullDef: 'A disciplined trade is the baseline state of a profitable trader. The setup matched a tested rule, the position size respected the risk plan, the stop-loss was set before entry, and the exit hit the target or stop without hesitation. It is the easiest stage to overlook because it feels unremarkable — but it is the only stage that compounds wealth. Every other Vicious Cycle stage describes a deviation from this baseline.',
    examples: [
      'Took a structured pullback entry at the 9:25 AM swing low with a pre-set 1.5R target — exited cleanly at target.',
      'Skipped a setup that didn\'t meet the entry checklist, even though the move ran without you.',
      'Sized at the planned 0.5% account risk regardless of "feeling confident" about this one.',
    ],
    costToTrader: 'No direct cost — this is the standard against which all other patterns lose money. The cost shows up indirectly: most traders spend less than 30% of their session in this state.',
    howDetected: 'TradeSaath identifies disciplined trades by cross-referencing planned entry rules (from your trading journal context) against actual entry/exit prices, time-gap consistency, and position-size variance against your account median.',
    howToFix: [
      'Continue — this is the goal. Catalogue what made this trade work.',
      'Replicate the pre-trade checklist exactly on the next setup.',
      'Resist the urge to "size up" after a string of these.',
      'Journal the emotional state alongside the trade — calm, focused, patient.',
    ],
    relatedPatterns: ['overconfidence'],
    relatedTerms: ['risk-reward-ratio', 'expectancy', 'position-size'],
  },
  {
    slug: 'overconfidence',
    name: 'Overconfidence',
    category: 'cycle-stage',
    cycleStage: 2,
    shortDef: 'Inflated belief in the next trade\'s success after a string of wins, leading to bigger size and looser entry criteria.',
    fullDef: 'Overconfidence is the brain\'s attempt to extrapolate a winning streak. After 2-3 disciplined wins, a trader starts to feel that "they have the market figured out today" and begins making small concessions: skipping a confirmation candle, sizing 1.2x the planned amount, taking a setup that scores B instead of A on their checklist. Each concession is small but they compound rapidly into the larger-position stage of the cycle.',
    examples: [
      'After 3 wins in a row, doubling position size on the 4th trade because "today is the day."',
      'Skipping the entry-confirmation candle to "not miss the move."',
      'Lowering setup-quality bar from A-grade to B-grade trades.',
    ],
    costToTrader: 'On its own, overconfidence costs little — but it is the gateway to the larger-position stage. Statistically, the trade taken in an overconfident state is 30-40% more likely to result in a loss than a disciplined-baseline trade.',
    howDetected: 'TradeSaath flags overconfidence when position size grows >20% above your session median after a 3+ trade winning streak, or when entry timing tightens (less time spent before entering).',
    howToFix: [
      'Cap position size at a fixed percentage regardless of recent results — write the cap before market open.',
      'Set a "win streak break" rule: after 3 consecutive wins, take a 30-minute pause.',
      'Track the win rate of trades taken at >120% of median size — most traders find it lower than baseline.',
      'Read your pre-market journal entry before each new entry — re-anchor to the plan.',
    ],
    relatedPatterns: ['larger-position', 'disciplined-trade', 'hot-hand-fallacy'],
    relatedTerms: ['win-rate', 'position-size', 'streak-length'],
  },
  {
    slug: 'larger-position',
    name: 'Larger / Riskier Position',
    category: 'cycle-stage',
    cycleStage: 3,
    shortDef: 'Position size or strike selection becomes aggressive — the trader takes on materially more risk than their plan allows.',
    fullDef: 'Following overconfidence, the trader actually deploys the larger size: 2x lots, deeper out-of-the-money options, looser stop-loss, or a leveraged perpetual at 5x instead of the usual 2x. The trade may still work — but the asymmetry has flipped. A small adverse move now hurts disproportionately, and the emotional response to that pain triggers the next stages.',
    examples: [
      'Buying 200 lots of NIFTY when usual size is 50 lots, "because the setup is so clear."',
      'Selecting a deeply OTM weekly option for cheaper premium when the plan said ATM only.',
      'Doubling leverage on a crypto perp from 3x to 10x mid-session.',
    ],
    costToTrader: 'When this trade hits the stop-loss, the loss is 2-4x the planned risk. One such trade can erase 5-10 disciplined wins. This is the single highest-leverage point in the cycle to break.',
    howDetected: 'Position-size variance against the trader\'s 30-day median, leverage multiplier deviation, and strike-distance analysis for options trades — TradeSaath surfaces the trades where these metrics exceed personal norms.',
    howToFix: [
      'Set a hard daily maximum position size — no exceptions.',
      'Use a fixed percentage of account equity per trade (0.25%-1%) computed before market open.',
      'For options: pre-define the maximum strike distance allowed in your plan.',
      'For crypto/forex: cap leverage at the level you can hold through a 5% adverse move without panic.',
    ],
    relatedPatterns: ['overconfidence', 'market-goes-against', 'position-sizing-error'],
    relatedTerms: ['position-size', 'leverage', 'risk-reward-ratio'],
  },
  {
    slug: 'market-goes-against',
    name: 'Market Goes Against',
    category: 'cycle-stage',
    cycleStage: 4,
    shortDef: 'The oversized position moves into a loss — the planned stop-loss level is approaching or has been mentally violated.',
    fullDef: 'This is the moment the trade plan starts to bend. The price has moved against the position by 50-80% of the planned stop distance. The disciplined response is to honour the stop. Instead, many traders begin renegotiating: "let me see one more candle," "I\'ll move the stop a bit lower," or "this is just noise." The plan is no longer driving the decision — the position size is.',
    examples: [
      'Position is at -₹4,000 vs a planned -₹3,000 stop, but the stop hasn\'t been moved on the platform yet.',
      '"Watching" the price as it approaches the stop instead of letting the order trigger.',
      'Mentally reframing the stop from "this is invalidation" to "this is a temporary dip."',
    ],
    costToTrader: 'On its own, the loss equals the planned risk. The cost compounds because this stage gates entry to hope-and-hold and averaging-down — where losses balloon to 2-5x the original plan.',
    howDetected: 'Time-gap analysis: TradeSaath flags trades where the time-from-stop-trigger to actual exit exceeds your normal pattern, plus trades where the stop was modified mid-trade.',
    howToFix: [
      'Place hard stop-loss orders on the broker, not mental stops.',
      'Pre-write the response: "If the stop hits, I close the platform for 15 minutes."',
      'Never widen a stop in the direction of the loss — only tighten it.',
      'Treat the stop as "the trade was wrong" — not as a temporary setback.',
    ],
    relatedPatterns: ['hope-and-hold', 'larger-position'],
    relatedTerms: ['stop-order', 'trailing-stop', 'max-drawdown'],
  },
  {
    slug: 'hope-and-hold',
    name: 'Hope & Hold',
    category: 'cycle-stage',
    cycleStage: 5,
    shortDef: 'Holding a losing position past the planned stop, hoping it will recover — there is no longer a thesis, only hope.',
    fullDef: 'Hope-and-hold is the trader\'s emotional refusal to accept a small loss. The planned exit was breached, but the position stays open because closing it would convert a paper loss into a realised loss — and the brain prefers the uncertainty of "it might come back" to the certainty of "I was wrong." The trade has effectively converted from a tactical position into a long-shot prayer.',
    examples: [
      'Holding a stop-loss-violated position for 90 minutes "just to see what happens."',
      'Refreshing the chart every 30 seconds for a reversal candle that doesn\'t come.',
      'Telling yourself "if it just gets back to break-even, I\'ll exit."',
    ],
    costToTrader: 'Average loss in hope-and-hold trades is 2-3x the original planned stop. The position is held until either an arbitrary "I can\'t take it" exit or a margin call. Across a year, this single pattern accounts for the largest concentrated losses in most retail accounts.',
    howDetected: 'TradeSaath compares planned stop level (from your context input or detected from prior similar trades) against actual exit time and exit price. Holds beyond planned stop with worsening P&L surface as flagged.',
    howToFix: [
      'Use OCO (One-Cancels-the-Other) orders so the stop fires automatically.',
      'Leave the platform when a stop hits — physical distance enforces the decision.',
      'Pre-write a "what to do when underwater" rule and tape it next to the screen.',
      'Practice closing losing positions on demo accounts to desensitise the emotional response.',
    ],
    relatedPatterns: ['market-goes-against', 'averaging-down', 'sunk-cost-fallacy'],
    relatedTerms: ['drawdown', 'stop-order', 'oco-order'],
  },
  {
    slug: 'averaging-down',
    name: 'Averaging Down',
    category: 'cycle-stage',
    cycleStage: 6,
    shortDef: 'Buying more of a losing position to lower the average entry — escalating the loss instead of accepting it.',
    fullDef: 'Averaging down converts hope into action. Rather than close the losing trade, the trader doubles or triples the position at a "better" price. The logic feels rational — the original thesis is now cheaper. The reality is that the position is now 2-3x the original size in a market that has already proven the thesis wrong. When the next leg down comes, the loss is no longer the planned 1R but 4-6R.',
    examples: [
      'Buying 100 more lots after the position is already underwater 50%.',
      'Doubling crypto perp size when the original entry has been stopped out.',
      'Adding to a put position as the underlying rallies, hoping for "the reversal."',
    ],
    costToTrader: 'Averaging-down trades, when they fail, lose 3-5x the original planned stop. They are also the hardest trades to walk away from because the trader has now committed twice — sunk-cost fallacy reinforces hope-and-hold.',
    howDetected: 'TradeSaath identifies multiple entry orders on the same instrument within a single session, where each successive entry is at a worse price than the previous and total position size grows beyond the trader\'s session-average.',
    howToFix: [
      'Hard rule: never add to a losing position in the same session.',
      'If you must average, only average up — into a position that is already working.',
      'Pre-define maximum entries per setup (typically 1).',
      'Treat each entry as a complete decision — not a "tranche" of one big trade.',
    ],
    relatedPatterns: ['hope-and-hold', 'panic-exit', 'sunk-cost-fallacy', 'position-sizing-error'],
    relatedTerms: ['position-size', 'drawdown', 'risk-reward-ratio'],
  },
  {
    slug: 'panic-exit',
    name: 'Panic Exit',
    category: 'cycle-stage',
    cycleStage: 7,
    shortDef: 'Capitulation at the worst price — the trader closes the position when the pain becomes unbearable, often at the local low.',
    fullDef: 'After hope-and-hold and averaging-down, the position has become a financial and emotional crisis. The trader exits not at a planned level but at the moment the brain can no longer tolerate the unrealised loss — typically right at a local extreme. The market often reverses minutes later, which compounds the regret and feeds the next stage (revenge trading).',
    examples: [
      'Closing the position at -₹40,000 when the planned stop was -₹3,000.',
      'Liquidating a leveraged crypto position seconds before a reversal wick.',
      'Selling everything "to make the pain stop" near the day\'s low.',
    ],
    costToTrader: 'The realised loss in a panic exit is typically 5-8x the originally planned risk and almost always at a worse price than the prior planned stop would have given. Even worse, it sets up the revenge trade that follows.',
    howDetected: 'TradeSaath flags exits where the price is within 5% of the session low/high (depending on direction), with no preceding move toward break-even, and where the position size at exit is materially larger than the entry size (indicating averaging-down preceded the panic).',
    howToFix: [
      'Set hard stop-loss orders that fire automatically — remove your hand from the trigger.',
      'Walk away from the platform when a position is underwater beyond the plan.',
      'Pre-commit to a maximum daily loss; close everything when hit.',
      'Use position sizing small enough that no single trade can cause emotional crisis.',
    ],
    relatedPatterns: ['averaging-down', 'revenge-trade'],
    relatedTerms: ['max-drawdown', 'stop-order', 'leverage'],
  },
  {
    slug: 'revenge-trade',
    name: 'Revenge Trade',
    category: 'cycle-stage',
    cycleStage: 8,
    shortDef: 'Re-entering the market within minutes of a loss to "make it back" — emotional, unplanned, and almost always a loser.',
    fullDef: 'The revenge trade is the trader\'s attempt to undo the panic exit through immediate action. There is no setup, no checklist, no plan — only the urgency to recover the loss before the day ends. The position is often oversized (because "this one needs to count"), entered against the prevailing trend, and managed with even less discipline than the trade that caused it. The revenge trade win rate across most retail accounts is below 30%.',
    examples: [
      'Entering a 3x-size position 90 seconds after closing a stopped-out trade.',
      '"Doubling up" on the next setup to recover the previous loss in one trade.',
      'Trading a different instrument because "I\'ll get it back somewhere else."',
    ],
    costToTrader: 'Revenge trades typically lose another 50-100% of the prior loss, turning a -1R session into a -3R or -4R session. This single pattern is the most expensive recurring leak in retail trading.',
    howDetected: 'TradeSaath measures the time gap between a losing trade\'s exit and the next entry. Gaps under 5 minutes after a loss are flagged as likely revenge trades — especially when position size on the new entry exceeds the trader\'s session median.',
    howToFix: [
      'Mandatory 15-minute timer after every losing trade — physical timer, not mental.',
      'Maximum 2 consecutive losses per session — third loss closes the platform.',
      'Pre-commit to "next trade after a loss is half-size" as a circuit breaker.',
      'Use a different physical action (stand up, walk away) to interrupt the pattern.',
    ],
    relatedPatterns: ['panic-exit', 'decision-fatigue', 'fomo-re-entry', 'overtrading'],
    relatedTerms: ['streak-length', 'expectancy', 'drawdown-psychology'],
  },
  {
    slug: 'decision-fatigue',
    name: 'Decision Fatigue',
    category: 'cycle-stage',
    cycleStage: 9,
    shortDef: 'Cognitive overload from too many decisions — quality of subsequent trades drops sharply, often to random or impulsive entries.',
    fullDef: 'After multiple emotional trades, the trader\'s decision-making capacity is depleted. Setups that should be passed are taken; entries are made without checking the prior steps; risk is no longer being calibrated. The trader is operating on autopilot, taking trades because they are bored or because not trading feels worse than trading. This is the stage where session-ending blowups happen.',
    examples: [
      'Trades #9, #10, #11 in a session that should have stopped at #5.',
      'Taking a setup without checking the higher timeframe.',
      'Hitting "buy" on a chart you haven\'t fully analysed.',
    ],
    costToTrader: 'Win rate drops 20-30% on trades taken in decision fatigue compared to morning baseline. Average loss size also grows because risk-checking is impaired.',
    howDetected: 'TradeSaath counts trades per session and compares win rate by trade-number ordinal. When trades 7+ have meaningfully lower win rate than trades 1-3, decision fatigue is flagged.',
    howToFix: [
      'Set a hard cap on trades per day — typically 5-8 for active intraday.',
      'Stop trading once the cap is hit, regardless of P&L.',
      'Take a 30-minute break after every 3 trades to reset.',
      'Track win rate by trade number — the data will show your personal cap.',
    ],
    relatedPatterns: ['overtrading', 'revenge-trade', 'fomo-re-entry'],
    relatedTerms: ['win-rate', 'streak-length'],
  },
  {
    slug: 'fomo-re-entry',
    name: 'FOMO Re-entry',
    category: 'cycle-stage',
    cycleStage: 10,
    shortDef: 'Chasing a move that has already happened — entering after the move is mostly over, near the local top or bottom.',
    fullDef: 'The final stage of the Vicious Cycle is FOMO re-entry — the trader sees a move they "should have caught" and jumps in late, usually right as the move is exhausting. Without a plan, they buy near the highs of the rally or sell near the lows of the breakdown. The reversal that follows kicks them back to stage 4 (market goes against), and the cycle starts over.',
    examples: [
      'Buying NIFTY calls at 2:45 PM after a 100-point rally that started at 2:00 PM.',
      'Long crypto perp into a 15% green candle that already pumped 3 hours ago.',
      'Entering a breakout at the third retest, after price has already extended.',
    ],
    costToTrader: 'FOMO entries have a poor risk-reward by definition — you are buying near where reversals happen. Average loss size is similar to the move chased, often 2-3R against the original plan.',
    howDetected: 'TradeSaath measures entry timing relative to the local move (how far the price has already moved from session open or prior pivot). Entries in the late phase of an extended move are flagged as FOMO.',
    howToFix: [
      'Mandatory rule: the move must come back to a structure (support/resistance) before entering.',
      'Write "I missed it — next setup" on paper before clicking buy.',
      'Track win rate of "first 30 minutes of move" vs "last 30 minutes" — the latter usually loses.',
      'Trade fewer instruments — focus reduces the surface area for FOMO triggers.',
    ],
    relatedPatterns: ['chasing-momentum', 'late-entry', 'disciplined-trade', 'recency-bias'],
    relatedTerms: ['breakout', 'fakeout', 'support', 'resistance'],
  },

  // ─────────────────────────────────────────────────────────────────
  // COGNITIVE BIASES (8)
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'anchoring-bias',
    name: 'Anchoring Bias',
    category: 'cognitive-bias',
    shortDef: 'Over-reliance on the first piece of information seen — usually the entry price — when making subsequent decisions.',
    fullDef: 'Anchoring bias in trading shows up most clearly around the entry price. Once you\'ve bought at ₹100, the brain fixates on that number: ₹95 feels like a loss to recover from, ₹105 feels like a profit to lock in, ₹110 feels like greed to resist. None of these references are relevant to whether the trade is currently working — but the entry-price anchor drives the decisions anyway.',
    examples: [
      'Refusing to take a profit at ₹103 because "I bought at ₹100 and it should run further."',
      'Holding a losing position to ₹98 because "I just want to get back to break-even."',
      'Setting take-profit at exactly the round number above the entry, regardless of structure.',
    ],
    costToTrader: 'Anchoring causes both early profit-taking on winners (because "any profit is good") and late stop-outs on losers (because "I just need it to come back"). Over a year, this asymmetry typically cuts the average win to ~70% of the average loss.',
    howDetected: 'TradeSaath compares your typical exit price levels (relative to entry) against the trade\'s actual price action. Repeated patterns of exiting near round-number profits and just-past-break-even on losers surface as anchoring.',
    howToFix: [
      'Set targets and stops based on chart structure, not on entry price.',
      'After entry, hide the entry price from your visible position info.',
      'Define exit levels in absolute price terms, not "+5%" or "-2%" of entry.',
      'Practice closing at structure even when it means a small loss to avoid the anchor.',
    ],
    relatedPatterns: ['hope-and-hold', 'premature-exit', 'sunk-cost-fallacy'],
    relatedTerms: ['take-profit', 'stop-order', 'support', 'resistance'],
  },
  {
    slug: 'confirmation-bias',
    name: 'Confirmation Bias',
    category: 'cognitive-bias',
    shortDef: 'Seeking out information that supports an existing position while ignoring contradicting signals.',
    fullDef: 'Once a trader has taken a position, the brain selectively attends to information that confirms the trade was right. Bullish news is amplified, bearish news is dismissed as "noise." Indicators that show weakness are ignored; ones that show strength are screenshotted. The trader believes they\'re being analytical when they\'re being defensive.',
    examples: [
      'After buying a stock, only reading bullish posts about it on social media.',
      'Dismissing a clear bearish divergence on RSI because "the higher timeframe still looks bullish."',
      'Adding to a losing position because of a single piece of supportive news.',
    ],
    costToTrader: 'Confirmation bias delays exits. Trades that should be closed on contradicting evidence stay open, gradually growing into hope-and-hold and averaging-down. The cost is the difference between exiting at the contradicting signal and exiting at the eventual stop or panic exit.',
    howDetected: 'TradeSaath looks for trades where you held through clear technical-invalidation events (e.g. broke key support while long), and surfaces the time-gap between the invalidation and your exit.',
    howToFix: [
      'Pre-define "what would prove me wrong" before every entry — and write it down.',
      'When holding a position, deliberately read the opposing case.',
      'Set technical invalidation alerts that fire even if you\'re not watching.',
      'Periodically ask: "If I didn\'t already own this, would I buy it now?"',
    ],
    relatedPatterns: ['hope-and-hold', 'sunk-cost-fallacy', 'disposition-effect'],
    relatedTerms: ['support', 'resistance', 'rsi', 'macd'],
  },
  {
    slug: 'recency-bias',
    name: 'Recency Bias',
    category: 'cognitive-bias',
    shortDef: 'Over-weighting recent events when forecasting future price action — the last few candles matter more than the broader context.',
    fullDef: 'Recency bias in trading manifests as treating the last 30 minutes of price action as predictive of the next 30 minutes. After a strong rally, the trader expects more rally; after a sharp drop, more drop. Mean-reversion is forgotten. Higher-timeframe context is ignored. The trader trades the recent past, not the present.',
    examples: [
      'Buying breakouts after seeing 3 strong breakouts that morning, even though the market is now extended.',
      'Selling puts after a quiet hour, ignoring that volatility tends to expand later.',
      'Assuming today\'s trend will continue into tomorrow.',
    ],
    costToTrader: 'Recency-biased entries cluster at the end of moves rather than the start, leading to FOMO entries and chase trades. Win rate on recency-biased entries is typically 15-25% lower than entries with broader context.',
    howDetected: 'TradeSaath measures entry timing relative to recent volatility — entries that cluster after sharp recent moves in the same direction are flagged.',
    howToFix: [
      'Always check at least one higher timeframe before entering.',
      'Track the win rate of "trades after a 1%+ move in the last 30min" — most traders find it lower.',
      'Pause for 60 seconds before entering after any rapid recent move.',
      'Use mean-reversion as a counter-bias check: "Could this reverse?"',
    ],
    relatedPatterns: ['fomo-re-entry', 'chasing-momentum', 'hot-hand-fallacy'],
    relatedTerms: ['moving-average', 'atr', 'breakout'],
  },
  {
    slug: 'sunk-cost-fallacy',
    name: 'Sunk Cost Fallacy',
    category: 'cognitive-bias',
    shortDef: 'Holding a losing position because of the money already invested, rather than the position\'s current merit.',
    fullDef: 'The sunk-cost fallacy says: "I\'ve already lost ₹10,000 on this trade — I can\'t close it now." The fallacy is treating the prior loss as recoverable through holding, when in fact the loss is already realised mentally and the only question is whether to risk more capital on a position that no longer has a thesis. Closing the trade and reallocating to a fresh setup is almost always the rational choice.',
    examples: [
      'Holding a -50% options position because "I\'ve already lost so much on it."',
      'Refusing to cut a losing crypto bag because "I bought at the top and want my money back."',
      'Adding to a stopped-out position to "average my way back to break-even."',
    ],
    costToTrader: 'Sunk-cost trades typically take 2-3x longer to exit than disciplined trades, and exit at worse prices. The opportunity cost of capital tied up in a sunk-cost loser is also significant — that capital can\'t take fresh setups.',
    howDetected: 'TradeSaath identifies sunk-cost holds by detecting positions held materially longer than your usual time-in-trade, with worsening cumulative P&L and no responsive trade-management actions.',
    howToFix: [
      'Reframe: "Would I open this position fresh today at the current price?" If no, close it.',
      'Treat capital as fungible — exit a loser, take a new setup with the same capital.',
      'Pre-define max holding time per setup; force exit when it runs out.',
      'Track the "would have done better in cash" cost in your journal.',
    ],
    relatedPatterns: ['hope-and-hold', 'averaging-down', 'confirmation-bias'],
    relatedTerms: ['drawdown', 'expectancy', 'risk-reward-ratio'],
  },
  {
    slug: 'gambler-fallacy',
    name: 'Gambler\'s Fallacy',
    category: 'cognitive-bias',
    shortDef: 'Believing that past random outcomes change the probability of future ones — "I\'ve had 5 losses, so a win must be coming."',
    fullDef: 'The gambler\'s fallacy is the belief that streaks must self-correct in random sequences. In trading it shows up as: "I\'ve lost 5 trades in a row, so the next one is more likely to win." But each independent trade has roughly the same probability as the last. The fallacy leads traders to size up after a losing streak ("the recovery trade is here") — which is exactly when they should be sizing down.',
    examples: [
      'Doubling size after 4 consecutive losses because "the streak has to end."',
      'Taking a marginal setup after a losing morning to "balance out the day."',
      'Believing that "the win-rate has to revert" within a single session.',
    ],
    costToTrader: 'Gambler\'s-fallacy sizing is the opposite of what should happen during a losing streak — adding more risk to a state where the trader is clearly off rhythm. The realised loss when this triggers is often 3-5x normal trade size.',
    howDetected: 'TradeSaath compares position-size variance against your win/loss streak state. Sizing up after 3+ consecutive losses is flagged.',
    howToFix: [
      'Size based on plan, not on streak. Cap size during drawdown.',
      'After 3 consecutive losses, reduce size by 50% or stop trading.',
      'Track the win rate of trade #N+1 after N consecutive losses — usually unchanged.',
      'Replace "the recovery is coming" with "each trade is independent."',
    ],
    relatedPatterns: ['revenge-trade', 'hot-hand-fallacy', 'overconfidence'],
    relatedTerms: ['win-rate', 'expectancy', 'streak-length'],
  },
  {
    slug: 'hot-hand-fallacy',
    name: 'Hot-Hand Fallacy',
    category: 'cognitive-bias',
    shortDef: 'Believing that a recent winning streak indicates skill or luck that will continue — sizing up on the next trade.',
    fullDef: 'The mirror of the gambler\'s fallacy: after wins, the trader assumes the streak will continue and increases position size. The reality is that consecutive trade outcomes in liquid markets are roughly independent — there is no momentum in your win rate. Sizing up after wins is the second-most-common cause of large losses (after panic on losers).',
    examples: [
      'Doubling size on the 5th trade after 4 consecutive wins.',
      'Taking lower-quality setups because "I can\'t lose today."',
      'Holding a winner past target because "the run isn\'t over yet."',
    ],
    costToTrader: 'A single oversized loss after a 4-trade winning streak typically erases the streak\'s combined gains. Most traders\' worst single days come at the peak of a hot-hand belief.',
    howDetected: 'TradeSaath flags position-size growth after winning streaks. Size growth >20% above session-median during a 3+ win streak triggers the alert.',
    howToFix: [
      'Cap size at a fixed level regardless of recent results.',
      'After 3 consecutive wins, take a 30-minute break.',
      'Track win rate of trades after winning streaks — usually similar to baseline.',
      'Replace "I\'m hot today" with "I\'m sized for any single outcome."',
    ],
    relatedPatterns: ['overconfidence', 'larger-position', 'gambler-fallacy'],
    relatedTerms: ['win-rate', 'streak-length', 'position-size'],
  },
  {
    slug: 'disposition-effect',
    name: 'Disposition Effect',
    category: 'cognitive-bias',
    shortDef: 'Closing winners too early and holding losers too long — a documented pattern in retail trading.',
    fullDef: 'The disposition effect is the empirically observed tendency for retail traders to realise gains quickly while holding losses indefinitely. The asymmetry is driven by loss aversion: closing a winner feels good, closing a loser feels bad — so the brain biases toward locking gains and deferring losses. Over a year this single pattern flips a positive expectancy strategy into a losing account.',
    examples: [
      'Selling a +5% winner at the first sign of a pullback.',
      'Holding a -8% loser indefinitely "until it comes back."',
      'Cutting a 10R winner at 2R while letting a 1R loser run to 5R.',
    ],
    costToTrader: 'The disposition effect typically caps average win at 1.5R while letting average loss run to 2.5-3R, flipping the risk-reward ratio against the trader. This is the single largest hidden tax on retail accounts.',
    howDetected: 'TradeSaath compares your average win-size-as-multiple-of-stop vs average loss-size-as-multiple-of-stop. When the former is below 1R and the latter is above 2R, disposition effect is flagged.',
    howToFix: [
      'Use trailing stops on winners to let them run.',
      'Set hard stop-loss orders on losers — non-negotiable.',
      'Track average win size and average loss size separately — aim for win:loss > 1.5:1.',
      'Pre-define exits for both winners and losers before entry.',
    ],
    relatedPatterns: ['premature-exit', 'hope-and-hold'],
    relatedTerms: ['risk-reward-ratio', 'trailing-stop', 'expectancy', 'average-win', 'average-loss'],
  },
  {
    slug: 'herd-behavior',
    name: 'Herd Behaviour',
    category: 'cognitive-bias',
    shortDef: 'Following the crowd into trades — buying because others are buying, selling because others are selling.',
    fullDef: 'Herd behaviour in trading shows up as following social-media calls, copying influencer trades, or piling into the same setup as everyone in your trader chat. The crowd is usually right during the middle of a move and wrong at the extremes. By the time a trade is being widely talked about, the easy money has already been made — what\'s left is the late-comer chase.',
    examples: [
      'Buying a stock because three Twitter accounts mentioned it that morning.',
      'Following a copy-trading leader into a leveraged crypto position.',
      'Joining a Telegram-pumped breakout that has already moved 20%.',
    ],
    costToTrader: 'Herd-driven entries cluster at the end of moves and right before reversals. Win rate is materially lower than entries based on independent technical setups, and average loss is amplified by the crowd-driven oversizing.',
    howDetected: 'TradeSaath\'s pattern engine identifies trades taken on instruments not in your historical watchlist combined with entry-timing in the late phase of a public-narrative move.',
    howToFix: [
      'Trade only setups you can articulate without referencing what others are saying.',
      'Reduce social media intake during market hours.',
      'Use a written checklist; no entry without all boxes ticked.',
      'Check: "Would I take this trade if no one else were watching?"',
    ],
    relatedPatterns: ['fomo-re-entry', 'chasing-momentum', 'recency-bias'],
    relatedTerms: ['breakout', 'fakeout'],
  },

  // ─────────────────────────────────────────────────────────────────
  // BEHAVIORAL PATTERNS (8)
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'overtrading',
    name: 'Overtrading',
    category: 'behavioral',
    shortDef: 'Taking too many trades per session — past the point where each marginal trade has positive expected value.',
    fullDef: 'Overtrading is the result of treating activity as productivity. The trader takes setup #5, then #6, #7, #8 — and most of them are below the threshold that would have stopped them in the morning. Win rate drops 15-25% after the first 3-5 trades for most retail accounts; cumulative P&L peaks early in the session and erodes thereafter. The cure is mechanical: cap trades per day.',
    examples: [
      'Taking 12 trades in a session when 5-7 is optimal for your strategy.',
      'Trading every 30-minute candle "to stay engaged."',
      'Forcing setups during low-volatility hours when the market doesn\'t move.',
    ],
    costToTrader: 'On most retail accounts, the bottom-10 most profitable trades over a year are concentrated in trades #6+ of multi-trade sessions. Capping trades at the personal threshold typically lifts annual P&L by 15-30% with no other change.',
    howDetected: 'TradeSaath tracks your win rate by trade ordinal (trade 1, 2, 3, ...) over the trailing 30 days. When trades 6+ have a meaningfully lower win rate than trades 1-3, overtrading is flagged with the optimal cutoff suggested.',
    howToFix: [
      'Set a hard daily trade cap — typically 5-8 for active intraday.',
      'Stop trading at the cap, regardless of P&L.',
      'Take a 30-minute break after every 3 trades.',
      'Track win rate per trade ordinal monthly — refine your cap.',
    ],
    relatedPatterns: ['decision-fatigue', 'revenge-trade', 'fomo-re-entry'],
    relatedTerms: ['expectancy', 'win-rate', 'streak-length'],
  },
  {
    slug: 'premature-exit',
    name: 'Premature Exit',
    category: 'behavioral',
    shortDef: 'Closing a winning position before the planned target — locking small wins out of fear they\'ll evaporate.',
    fullDef: 'Premature exit is the loss-aversion side of the disposition effect. The trader has a setup with a 2R target, but closes at 0.7R "to lock something in." Over a year this caps average wins below average losses, creating a structurally losing strategy even when the underlying setup has positive expectancy. The fix is mechanical: trailing stops or hard targets, not gut.',
    examples: [
      'Closing a position at +5 ticks when the planned target was +25.',
      'Selling half "to take risk off" right at the start of the breakout.',
      'Tightening the stop to break-even immediately, getting flushed out on noise.',
    ],
    costToTrader: 'Premature exits cap upside without reducing downside. Over hundreds of trades, this asymmetry typically converts a positive-expectancy strategy into a flat or negative one.',
    howDetected: 'TradeSaath tracks how far each trade moved past your exit price. When the median "potential profit captured" ratio drops below 50%, premature exit is flagged.',
    howToFix: [
      'Use trailing stops anchored to ATR or recent swing structure.',
      'Pre-define hard targets and don\'t close until target or stop.',
      'Don\'t move stops to break-even on the first profitable tick.',
      'Track potential-profit-captured percentage monthly.',
    ],
    relatedPatterns: ['disposition-effect', 'anchoring-bias'],
    relatedTerms: ['take-profit', 'trailing-stop', 'risk-reward-ratio', 'atr'],
  },
  {
    slug: 'late-entry',
    name: 'Late Entry',
    category: 'behavioral',
    shortDef: 'Entering a setup after the optimal entry zone has passed — chasing instead of waiting.',
    fullDef: 'Late entry is the cousin of FOMO: the trader sees a valid setup but waits until the move has already extended before clicking buy. The risk-reward of the trade is now compressed (less room to target, same room to stop) and the probability of an immediate pullback is elevated. Most chase entries result in a small loss followed by the move continuing without the trader.',
    examples: [
      'Entering a breakout retest 30 minutes after the actual breakout.',
      'Buying after the third leg of a rally rather than on the first pullback.',
      'Waiting for "more confirmation" until the move is mostly over.',
    ],
    costToTrader: 'Late entries have meaningfully worse risk-reward by definition: less room to target, similar room to stop. Win rate is typically 10-15% below same-setup entries taken at the structure level.',
    howDetected: 'TradeSaath measures entry timing relative to the local move\'s start (session pivot, prior swing high/low). Entries materially after the move\'s start are flagged.',
    howToFix: [
      'Define the entry zone in advance — enter inside it or skip the trade.',
      'Use limit orders at the planned entry price, not market orders.',
      'Skip the trade if the move has gone 50% to target before you can enter.',
      'Track the "missed by" distance — most late entries are missed by predictable amounts.',
    ],
    relatedPatterns: ['fomo-re-entry', 'chasing-momentum', 'recency-bias'],
    relatedTerms: ['support', 'resistance', 'breakout', 'limit-order'],
  },
  {
    slug: 'position-sizing-error',
    name: 'Position Sizing Error',
    category: 'behavioral',
    shortDef: 'Sizing inconsistently — some trades 2x normal, others 0.5x — without a defined rule.',
    fullDef: 'Inconsistent position sizing is one of the most reliable predictors of poor returns. Without a fixed rule (e.g., 0.5% of account per trade, or 1R based on stop distance), the trader sizes by emotion: bigger when confident, smaller when uncertain. The result is that the worst-sized trades are systematically the worst-outcome trades, because confidence is a poor predictor of trade quality.',
    examples: [
      'Sizing 200% of normal on a "high-conviction" trade that loses.',
      'Sizing 30% of normal on a setup that ends up being the day\'s best.',
      'Letting "feel" decide size instead of stop-distance.',
    ],
    costToTrader: 'When position size correlates negatively with outcome (which it usually does for emotional sizing), the strategy\'s positive expectancy is destroyed. Even a 60% win-rate setup loses money if you size big on losers and small on winners.',
    howDetected: 'TradeSaath tracks position-size variance against your account median. Trades sized >150% or <50% of your median are flagged, with the win rate of those outliers compared to baseline.',
    howToFix: [
      'Use a fixed-fractional sizing rule (% of equity per trade).',
      'Size by stop distance — trades with wider stops should have smaller position size.',
      'Pre-compute size before market open; don\'t re-decide intraday.',
      'Track size variance monthly — should stay within 20% of median.',
    ],
    relatedPatterns: ['larger-position', 'overconfidence', 'gambler-fallacy'],
    relatedTerms: ['position-size', 'leverage', 'risk-reward-ratio'],
  },
  {
    slug: 'ignoring-stop-loss',
    name: 'Ignoring Stop-Loss',
    category: 'behavioral',
    shortDef: 'Mental stops that don\'t trigger, removed stops, or stops widened in the direction of the loss.',
    fullDef: 'Ignoring the stop-loss is the gateway to the worst losses in retail trading. The stop was set at the planned invalidation point, but when price reaches it, the trader hesitates, widens the stop, or removes it entirely. The trade is no longer governed by the original plan — it becomes a hold-and-hope position whose loss is bounded only by the trader\'s eventual emotional capitulation.',
    examples: [
      'Cancelling the stop-loss order as price approaches it "to give it more room."',
      'Setting only a mental stop and "watching" instead of triggering.',
      'Widening the stop from -2% to -5% mid-trade.',
    ],
    costToTrader: 'A trade where the stop was ignored typically realises 3-8x the planned loss. Across most retail accounts, the largest 5 losses of the year are stop-ignored trades.',
    howDetected: 'TradeSaath compares your planned stop level (from journal context or detected from prior similar trades) against the actual exit price. Trades exited beyond the planned stop are flagged.',
    howToFix: [
      'Use hard stop orders placed on the broker, not mental stops.',
      'Use OCO orders so the stop fires automatically.',
      'Never widen a stop in the direction of the loss.',
      'Walk away from the platform when a stop hits.',
    ],
    relatedPatterns: ['hope-and-hold', 'panic-exit', 'averaging-down'],
    relatedTerms: ['stop-order', 'oco-order', 'stop-limit', 'max-drawdown'],
  },
  {
    slug: 'chasing-momentum',
    name: 'Chasing Momentum',
    category: 'behavioral',
    shortDef: 'Buying strength near local highs and selling weakness near local lows — entering moves that are already overextended.',
    fullDef: 'Chasing momentum is what happens when a trader uses recent strength as the only entry signal. The trade is entered after the move is visible — by which time it\'s often near exhaustion. Without a structural entry (pullback to support, retest of breakout level), the chase trade has no edge: it\'s just buying what just happened.',
    examples: [
      'Buying a stock at the top of a 10% green candle.',
      'Long perpetual after a 5% pump in the last 15 minutes.',
      'Entering after the 3rd consecutive higher high without waiting for a pullback.',
    ],
    costToTrader: 'Chase trades reverse against the entry frequently — "buying highs" trades typically have 30-40% win rates vs 50-60% for structure-based entries on the same setup.',
    howDetected: 'TradeSaath measures price extension at entry — how far the price has moved from the relevant pivot or moving average at the moment of entry. Entries on extended price are flagged.',
    howToFix: [
      'Wait for a pullback to structure before entering.',
      'Use limit orders at planned levels, not market orders chasing.',
      'Skip the trade if the move has gone 50% to target before entry.',
      'Track win rate of "first pullback" entries vs "extended price" entries.',
    ],
    relatedPatterns: ['fomo-re-entry', 'late-entry', 'recency-bias', 'herd-behavior'],
    relatedTerms: ['breakout', 'fakeout', 'support', 'resistance', 'moving-average'],
  },
  {
    slug: 'news-trading-fomo',
    name: 'News-Trading FOMO',
    category: 'behavioral',
    shortDef: 'Entering positions in the seconds after news releases — chasing the initial spike instead of waiting for structure.',
    fullDef: 'News-trading FOMO is the urge to participate in the immediate post-release move, where volatility expands and spreads widen simultaneously. The first 30-90 seconds after major news are the worst time to enter for most strategies — slippage is high, stops are easily run, and the eventual direction often reverses the initial spike. Disciplined news traders wait 5-15 minutes for the dust to settle.',
    examples: [
      'Buying NIFTY 5 seconds after a Fed rate decision.',
      'Long crypto perp the moment a CPI print drops.',
      'Entering on the first headline of an earnings beat without seeing the chart reaction.',
    ],
    costToTrader: 'Slippage on news entries can be 3-10x normal. Stop hit-rate spikes during the first volatility burst, often stopping out structurally-correct trades before they work.',
    howDetected: 'TradeSaath cross-references entry timestamps against scheduled major events (when context provided) and flags entries within the first 5 minutes of release.',
    howToFix: [
      'Wait at least 5-15 minutes after major news before entering.',
      'Use limit orders at structural levels, not market orders into the spike.',
      'Reduce position size on news days — volatility is higher than your model assumes.',
      'Track win rate of "first-5-min-after-news" trades — usually below baseline.',
    ],
    relatedPatterns: ['fomo-re-entry', 'chasing-momentum', 'late-entry'],
    relatedTerms: ['slippage', 'spread', 'breakout', 'atr'],
  },
  {
    slug: 'analysis-paralysis',
    name: 'Analysis Paralysis',
    category: 'behavioral',
    shortDef: 'Over-analysing setups to the point of missing valid entries — looking for one more confirmation before clicking buy.',
    fullDef: 'Analysis paralysis is the mirror of FOMO: instead of entering too quickly, the trader can\'t enter at all. Each setup is checked against more and more indicators, requiring more and more confirmation. By the time all conditions are met, the move has played out. The trader watches valid setups run without them and ends up taking only the lower-quality late entries.',
    examples: [
      'Waiting for RSI, MACD, MA cross, AND a candlestick pattern before entering.',
      'Refusing to enter without "one more retest" — and missing the move.',
      'Spending 20 minutes analysing a setup that should be a 2-second decision.',
    ],
    costToTrader: 'Lost opportunities don\'t show up in trade history but are real costs. The trader\'s subjective experience is "the market doesn\'t give me good setups" — when in fact they\'re gating themselves out of them.',
    howDetected: 'TradeSaath measures time-from-setup-trigger to entry across your trades. Long average trigger-to-entry times combined with low trade frequency surface as analysis paralysis.',
    howToFix: [
      'Pre-define a maximum of 3-4 entry conditions; if all met, enter immediately.',
      'Use a stopwatch — if the decision takes more than 60 seconds, skip the trade.',
      'Practice paper-trading entries with reduced confirmation count.',
      'Track entries-skipped-that-worked vs entries-taken-that-failed.',
    ],
    relatedPatterns: ['late-entry', 'fomo-re-entry'],
    relatedTerms: ['rsi', 'macd', 'breakout', 'support'],
  },
]

/** Lookup a pattern by slug. Returns undefined when no match. */
export function getPattern(slug: string): PatternInfo | undefined {
  return PATTERNS.find((p) => p.slug === slug)
}

/** All slugs — convenient for static-site-generation `generateStaticParams`. */
export function getPatternSlugs(): string[] {
  return PATTERNS.map((p) => p.slug)
}
