/**
 * Parsing Audit Runner — Phases 3 & 4
 *
 * Runs the production intake pipeline (`intakeFile`) against every fixture
 * in fixtures/broker-samples/, and runs the four KPI calculators against
 * __tests__/fixtures/zerodha-multi-day.csv three times each for an
 * idempotency check.
 *
 * GATED behind RUN_AUDIT=true so it doesn't execute in regular `npm test`.
 *
 * To execute (PowerShell):
 *   $env:RUN_AUDIT='true'; npx vitest run __tests__/audit/run-parsing-audit.test.ts; Remove-Item Env:RUN_AUDIT
 *
 * Output:
 *   reports/parser-runs/<fixture>.json    — Phase 3 per-fixture run
 *   reports/parser-runs/_summary.json     — Phase 3 cross-fixture diff
 *   reports/parser-runs/_idempotency.json — Phase 4 multi-day stability
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { intakeFile, toLegacyTrade } from '@/lib/intake'
import { calculateIntakeKPIs } from '@/lib/intake/kpiCalculator'
import { calculateKPIs as legacyParserKpis } from '@/lib/parsers/kpiCalculator'
import { computeKPIs as dashboardKpis } from '@/lib/kpi/computeKPIs'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import { computeSessionMetrics } from '@/lib/compute/sessionMetrics'
import { resolveCurrency, type CurrencyCode } from '@/lib/utils/currency'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIXTURE_ROOT = path.join(REPO_ROOT, 'fixtures', 'broker-samples')
const REPORTS_DIR = path.join(REPO_ROOT, 'reports', 'parser-runs')
const MULTI_DAY_PATH = path.join(REPO_ROOT, '__tests__', 'fixtures', 'zerodha-multi-day.csv')

const SHOULD_RUN = process.env.RUN_AUDIT === 'true'

/* ───────── Helpers ───────── */

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function listFixtures(): { name: string; dataFile: string; expectedFile: string }[] {
  const out: { name: string; dataFile: string; expectedFile: string }[] = []
  if (!fs.existsSync(FIXTURE_ROOT)) return out
  for (const entry of fs.readdirSync(FIXTURE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('_')) continue
    const dir = path.join(FIXTURE_ROOT, entry.name)
    const expectedFile = path.join(dir, 'expected.json')
    if (!fs.existsSync(expectedFile)) continue
    const data = fs
      .readdirSync(dir)
      .find((f) => /\.(csv|xlsx|xls|tsv|pdf)$/i.test(f))
    if (!data) continue
    out.push({
      name: entry.name,
      dataFile: path.join(dir, data),
      expectedFile,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function pct(diff: number, base: number): number | null {
  if (base === 0) return null
  return Math.round((diff / Math.abs(base)) * 10000) / 100
}

function diffNumber(actual: number, expected: number) {
  const delta = Math.round((actual - expected) * 100) / 100
  return { actual, expected, delta, pctDelta: pct(delta, expected) }
}

/* ───────── Phase 3 ───────── */

async function runOneFixture(fix: { name: string; dataFile: string; expectedFile: string }) {
  const expected = JSON.parse(fs.readFileSync(fix.expectedFile, 'utf-8'))
  const buffer = fs.readFileSync(fix.dataFile)
  const t0 = Date.now()
  let result: Awaited<ReturnType<typeof intakeFile>> | null = null
  let crashError: string | null = null
  try {
    result = await intakeFile(buffer, path.basename(fix.dataFile))
  } catch (e) {
    crashError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
  }
  const tMs = Date.now() - t0

  if (!result) {
    return {
      fixture: fix.name,
      dataFile: path.basename(fix.dataFile),
      durationMs: tMs,
      parsed: false,
      crashError,
      expected,
    }
  }

  const kpis = result.kpis
  const trades = result.trades

  // Phase 5 (audit Finding F — 2026-05-04): exercise the resolveCurrency
  // chain on the intake output so _summary.json shows what each fixture
  // would resolve to in production. Audit runner has no request context,
  // so cookie + Accept-Language pass null and the chain falls through.
  const resolvedCurrency: CurrencyCode = await resolveCurrency({
    detectedCurrency: result.rawFile?.currency,
    detectedMarket: result.rawFile?.market,
    symbols: (trades.map((t) => t.symbol).filter(Boolean) as string[]),
    cookieCurrency: null,
    acceptLanguage: null,
  })
  const expectedCurrency: string | null = expected.expectedCurrency ?? null
  const currencyMatches = expectedCurrency === null
    ? null
    : resolvedCurrency === expectedCurrency

  // Symbol set
  const symbolsActual = Array.from(new Set(trades.map((t) => t.symbol))).sort()
  const symbolsExpected: string[] = expected.expectedSymbols || []
  const missingSymbols = symbolsExpected.filter((s) => !symbolsActual.includes(s))
  const extraSymbols = symbolsActual.filter((s) => !symbolsExpected.includes(s))

  // Per-symbol P&L (gross, summed from per-trade pnl)
  const perSymbolActual: Record<string, number> = {}
  for (const t of trades) {
    perSymbolActual[t.symbol] = (perSymbolActual[t.symbol] || 0) + t.pnl
  }
  for (const s of Object.keys(perSymbolActual)) {
    perSymbolActual[s] = Math.round(perSymbolActual[s] * 100) / 100
  }

  // KPI diffs
  const expGross =
    expected.grossPnl_USD ?? expected.grossPnl ?? expected.grossPnL ?? null
  const expNet =
    expected.netPnl_USD ?? expected.netPnl ?? expected.netPnL ?? null
  const expWinRate = expected.winRatePct ?? expected.winRate ?? null
  const expClosed =
    expected.closedTrades ??
    expected.totalClosedTrades ??
    expected.totalFills ??
    null
  const expWinCount = expected.winCount ?? null
  const expLossCount = expected.lossCount ?? null

  return {
    fixture: fix.name,
    dataFile: path.basename(fix.dataFile),
    durationMs: tMs,
    parsed: result.success && trades.length > 0,
    success: result.success,
    error: result.error,
    validationWarnings: result.validationWarnings,
    rawFile: {
      broker: result.rawFile.broker,
      market: result.rawFile.market,
      currency: result.rawFile.currency,
      tradeDate: result.rawFile.tradeDate,
      headers: result.rawFile.headers,
      rowCount: result.rawFile.rows.length,
      confidence: result.rawFile.confidence,
      confidenceScore: result.rawFile.confidenceScore,
      warnings: result.rawFile.warnings,
    },
    expectedSummary: {
      broker: expected.broker,
      symbols: symbolsExpected,
      grossPnl: expGross,
      netPnl: expNet,
      winRatePct: expWinRate,
      closed: expClosed,
      currency: expectedCurrency,
    },
    resolvedCurrency,
    expectedCurrency,
    currencyMatches,
    kpis,
    diffs: {
      grossPnl:
        expGross != null ? diffNumber(kpis.netPnl, expNet ?? expGross) : null,
      netPnl: expNet != null ? diffNumber(kpis.netPnl, expNet) : null,
      winRate:
        expWinRate != null ? diffNumber(kpis.winRate, expWinRate) : null,
      tradeCount:
        expClosed != null
          ? diffNumber(kpis.totalTrades, expClosed)
          : null,
      winCount:
        expWinCount != null ? diffNumber(kpis.wins, expWinCount) : null,
      lossCount:
        expLossCount != null ? diffNumber(kpis.losses, expLossCount) : null,
    },
    symbols: {
      actual: symbolsActual,
      expected: symbolsExpected,
      missing: missingSymbols,
      extra: extraSymbols,
    },
    perSymbolPnlActual: perSymbolActual,
    perSymbolPnlExpected:
      expected.perSymbolPnl_USD || expected.perSymbolPnl || null,
    sampleTrades: trades.slice(0, 3),
    fixtureNotes: expected.fixtureNotes,
  }
}

/* ───────── Phase 4: idempotency ───────── */

interface KpiSnapshot {
  source: string
  netPnl: number
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  profitFactor: number
  bestTradePnl: number
  worstTradePnl: number
  /** Stringified deterministic representation for hash comparison */
  json: string
}

function snapshotIntake(kpis: ReturnType<typeof calculateIntakeKPIs>): KpiSnapshot {
  const obj = {
    netPnl: kpis.netPnl,
    totalTrades: kpis.totalTrades,
    wins: kpis.wins,
    losses: kpis.losses,
    winRate: kpis.winRate,
    profitFactor: kpis.profitFactor,
    bestTradePnl: kpis.bestTradePnl,
    worstTradePnl: kpis.worstTradePnl,
  }
  return { source: 'intake', ...obj, json: JSON.stringify(obj) }
}

function snapshotLegacy(kpis: ReturnType<typeof legacyParserKpis>): KpiSnapshot {
  const obj = {
    netPnl: kpis.net_pnl,
    totalTrades: kpis.total_trades,
    wins: kpis.wins,
    losses: kpis.losses,
    winRate: kpis.win_rate,
    profitFactor: kpis.profit_factor,
    bestTradePnl: kpis.best_trade_pnl,
    worstTradePnl: kpis.worst_trade_pnl,
  }
  return { source: 'legacy-parsers', ...obj, json: JSON.stringify(obj) }
}

function snapshotDashboard(kpis: ReturnType<typeof dashboardKpis>): KpiSnapshot {
  const obj = {
    netPnl: kpis.totalPnl,
    totalTrades: kpis.totalTrades,
    wins: kpis.totalWins,
    losses: kpis.totalLosses,
    winRate: kpis.winRate,
    profitFactor: kpis.profitFactor,
    bestTradePnl: kpis.bestSessionPnl,
    worstTradePnl: kpis.worstSessionPnl,
  }
  return { source: 'kpi/computeKPIs', ...obj, json: JSON.stringify(obj) }
}

function snapshotModule2(metrics: ReturnType<typeof computeSessionMetrics>): KpiSnapshot {
  const winRatePct = Math.round((metrics.winRate || 0) * 10000) / 100
  const obj = {
    netPnl: metrics.totalPnl,
    totalTrades: metrics.totalTrades,
    wins: metrics.winCount,
    losses: metrics.lossCount,
    winRate: winRatePct,
    profitFactor: metrics.profitFactor,
    bestTradePnl: metrics.bestTradePnl,
    worstTradePnl: metrics.worstTradePnl,
  }
  return { source: 'compute/sessionMetrics', ...obj, json: JSON.stringify(obj) }
}

async function runIdempotency() {
  if (!fs.existsSync(MULTI_DAY_PATH)) {
    return { ok: false, error: 'multi-day fixture missing: ' + MULTI_DAY_PATH }
  }
  const buffer = fs.readFileSync(MULTI_DAY_PATH)

  // Run intakeFile 3x
  const intakeRuns: Awaited<ReturnType<typeof intakeFile>>[] = []
  for (let i = 0; i < 3; i++) {
    intakeRuns.push(await intakeFile(buffer, path.basename(MULTI_DAY_PATH)))
  }

  const matrix: { run: number; calculator: string; snapshot: KpiSnapshot }[] = []
  for (let i = 0; i < intakeRuns.length; i++) {
    const r = intakeRuns[i]
    const trades = r.trades
    const legacyTrades = trades.map(toLegacyTrade)

    matrix.push({
      run: i + 1,
      calculator: 'intake/kpiCalculator',
      snapshot: snapshotIntake(calculateIntakeKPIs(trades)),
    })

    matrix.push({
      run: i + 1,
      calculator: 'parsers/kpiCalculator',
      // legacy expects ParsedTrade-shape; toLegacyTrade gives that
      snapshot: snapshotLegacy(
        legacyParserKpis(
          legacyTrades.map((t) => ({
            index: t.index,
            time: t.time,
            date: t.date,
            symbol: t.symbol,
            side: t.side,
            qty: t.qty,
            entry: t.entry,
            exit: t.exit,
            pnl: t.pnl,
            cum_pnl: t.cum_pnl,
            session: t.session,
            time_gap_minutes: t.time_gap_minutes,
            tag: t.tag,
            label: t.label,
            entry_time: t.entry_time,
            exit_time: t.exit_time,
            holding_minutes: t.holding_minutes,
            exchange: t.exchange,
            trade_id: t.trade_id,
          })),
        ),
      ),
    })

    // Dashboard KPIs aggregate at the SESSION level — wrap multi-day
    // trades into one virtual session so the call is well-formed.
    const tradeArray = legacyTrades.map((t) => ({ pnl: t.pnl }))
    const sessionStub = [
      {
        net_pnl: legacyTrades.reduce((s, t) => s + t.pnl, 0),
        trade_count: legacyTrades.length,
        win_count: legacyTrades.filter((t) => t.pnl > 0).length,
        loss_count: legacyTrades.filter((t) => t.pnl < 0).length,
        trade_date: legacyTrades[0]?.date || '',
        trades: tradeArray,
      },
    ]
    matrix.push({
      run: i + 1,
      calculator: 'kpi/computeKPIs (dashboard)',
      snapshot: snapshotDashboard(dashboardKpis(sessionStub)),
    })

    // Module 2 sessionMetrics — feed via enrichTrades
    try {
      const enriched = enrichTrades(trades)
      const m = computeSessionMetrics(enriched)
      matrix.push({
        run: i + 1,
        calculator: 'compute/sessionMetrics (Module 2)',
        snapshot: snapshotModule2(m),
      })
    } catch (e) {
      matrix.push({
        run: i + 1,
        calculator: 'compute/sessionMetrics (Module 2)',
        snapshot: {
          source: 'compute/sessionMetrics',
          netPnl: NaN,
          totalTrades: -1,
          wins: -1,
          losses: -1,
          winRate: NaN,
          profitFactor: NaN,
          bestTradePnl: NaN,
          worstTradePnl: NaN,
          json: 'ERROR: ' + (e instanceof Error ? e.message : String(e)),
        },
      })
    }
  }

  // Within-calculator stability (same calc across 3 runs should match)
  const byCalc: Record<string, KpiSnapshot[]> = {}
  for (const m of matrix) {
    if (!byCalc[m.calculator]) byCalc[m.calculator] = []
    byCalc[m.calculator].push(m.snapshot)
  }
  const intraStability: Record<string, { stable: boolean; jsons: string[] }> = {}
  for (const [calc, snaps] of Object.entries(byCalc)) {
    const jsons = snaps.map((s) => s.json)
    intraStability[calc] = { stable: jsons.every((j) => j === jsons[0]), jsons }
  }

  // Cross-calculator divergence on run 1
  const run1 = matrix.filter((m) => m.run === 1).map((m) => m.snapshot)
  const interDiff = run1.map((s) => ({
    calculator: s.source,
    netPnl: s.netPnl,
    totalTrades: s.totalTrades,
    wins: s.wins,
    losses: s.losses,
    winRate: s.winRate,
    profitFactor: s.profitFactor,
  }))

  return {
    ok: true,
    fixture: path.basename(MULTI_DAY_PATH),
    matrix,
    intraStability,
    interDiff,
  }
}

/* ───────── Vitest entry ───────── */

const runner = SHOULD_RUN ? describe : describe.skip

runner('parsing audit runner', () => {
  it('Phase 3: runs every fixture through intakeFile', async () => {
    ensureDir(REPORTS_DIR)
    const fixtures = listFixtures()
    expect(fixtures.length, 'no fixtures found').toBeGreaterThan(0)

    const summary: Array<Record<string, unknown>> = []
    for (const f of fixtures) {
      const out = await runOneFixture(f)
      const outFile = path.join(REPORTS_DIR, `${f.name}.json`)
      fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
      summary.push({
        fixture: f.name,
        parsed: out.parsed,
        broker: out.rawFile?.broker,
        market: out.rawFile?.market,
        trades: out.kpis?.totalTrades,
        netPnl: out.kpis?.netPnl,
        winRate: out.kpis?.winRate,
        // Phase 5 (audit Finding F): currency-resolution verification.
        resolvedCurrency: out.resolvedCurrency,
        expectedCurrency: out.expectedCurrency,
        currencyMatches: out.currencyMatches,
        durationMs: out.durationMs,
        keyDiff:
          out.diffs?.netPnl?.delta ??
          out.diffs?.tradeCount?.delta ??
          null,
        crashError: out.crashError,
      })
      // eslint-disable-next-line no-console
      console.log(
        `[AUDIT] ${f.name.padEnd(20)} parsed=${String(out.parsed).padEnd(5)} ` +
          `broker=${(out.rawFile?.broker || 'n/a').padEnd(15)} ` +
          `trades=${out.kpis?.totalTrades ?? 0} netPnl=${out.kpis?.netPnl ?? 0} ` +
          `cur=${(out.resolvedCurrency || 'n/a').padEnd(3)} ` +
          `expCur=${(out.expectedCurrency || 'n/a').padEnd(3)} ` +
          `match=${out.currencyMatches === null ? 'n/a' : String(out.currencyMatches)} ` +
          `${out.durationMs}ms`,
      )
    }
    fs.writeFileSync(
      path.join(REPORTS_DIR, '_summary.json'),
      JSON.stringify(summary, null, 2),
    )
    expect(summary.length).toBe(fixtures.length)
  }, 120_000)

  it('Phase 4: idempotency matrix on zerodha-multi-day', async () => {
    ensureDir(REPORTS_DIR)
    const out = await runIdempotency()
    fs.writeFileSync(
      path.join(REPORTS_DIR, '_idempotency.json'),
      JSON.stringify(out, null, 2),
    )
    if (!out.ok) {
      // eslint-disable-next-line no-console
      console.warn('[AUDIT] idempotency aborted:', out.error)
      return
    }
    // eslint-disable-next-line no-console
    for (const [calc, s] of Object.entries(out.intraStability)) {
      console.log(`[AUDIT] intra-stability ${calc.padEnd(35)} stable=${s.stable}`)
    }
    // eslint-disable-next-line no-console
    for (const d of out.interDiff) {
      console.log(
        `[AUDIT] inter-calc ${d.calculator.padEnd(30)} netPnl=${d.netPnl} trades=${d.totalTrades} wins=${d.wins}/${d.losses} winRate=${d.winRate}`,
      )
    }
    expect(out.matrix.length).toBeGreaterThanOrEqual(12)
  }, 60_000)
})

// (Skipped silently when RUN_AUDIT≠'true' — see header comment for usage.)
