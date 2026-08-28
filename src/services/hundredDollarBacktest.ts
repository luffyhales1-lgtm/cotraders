// $100 / 1-MONTH PORTFOLIO BACKTEST
//
// This is deliberately stricter than the generic walk-forward engine. It
// reproduces the EXACT live qualification gate — consensus direction, minimum
// confluence, EMA trend regime, RSI/MACD momentum, and the percentage-floored
// SL/TP structure from riskConfig — so the equity curve you see is what the
// website's own signal rules would have produced, not a looser proxy.
//
// It then runs a real $100 account over the month: ONE position at a time
// (which is what a $100 account can actually do), risking a fixed fraction of
// the CURRENT balance per trade, so profits compound and losses shrink the next
// position. Chronology across markets comes from the shared 1-hour bar grid —
// every market is fetched to the same recent window, so bar index is a common
// clock. Trades that never resolve inside the horizon are excluded rather than
// silently scored as wins.

import { CandleData } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr, ema, rsi, macd } from './indicators';
import { fetchTopCryptos, fetchKlines } from './binanceApi';
import { FOREX_MAJORS, fetchForexKlines } from './forexApi';
import {
  MIN_CONFLUENCE, MIN_TRADES_TO_REPORT,
  profileForAsset, scaleToMinReward,
} from './riskConfig';

export const START_EQUITY = 100;
/** Fraction of the CURRENT balance risked per trade (compounding). */
export const RISK_PER_TRADE = 0.02;

const CRYPTO_UNIVERSE = 24;
const HOURS_PER_MONTH = 24 * 30;      // 720 hourly bars ≈ 1 calendar month
const MIN_CANDLES = 200;
const CONCURRENCY = 3;
const WARMUP_BARS = 120;              // indicators need history before the first trade
const MAX_HOLD_BARS = 48;             // 2 days on the 1h grid

export type AssetClass = 'CRYPTO' | 'GOLD' | 'SILVER' | 'FOREX';

export interface SimTrade {
  symbol: string;
  pair: string;
  assetClass: AssetClass;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  confluence: number;
  entryBar: number;
  exitBar: number;
  entryAt: number;              // approximate unix ms, derived from the 1h grid
  entryPrice: number;
  stopLoss: number;
  target1: number;
  tp1Pct: number;
  slPct: number;
  rr: number;
  outcome: 'WIN' | 'LOSS';
  rMultiple: number;
}

export interface TakenTrade extends SimTrade {
  /** Balance before this trade was opened. */
  balanceBefore: number;
  /** Dollars risked (RISK_PER_TRADE of balanceBefore). */
  riskUsd: number;
  /** Realised P&L in dollars. */
  pnlUsd: number;
  balanceAfter: number;
}

export interface EquityPoint { i: number; equity: number; }

export interface SymbolStat {
  symbol: string;
  pair: string;
  assetClass: AssetClass;
  trades: number;
  wins: number;
  winRate: number | null;
  pnlUsd: number;
}

export interface StrategyStat {
  strategy: string;
  trades: number;
  wins: number;
  winRate: number | null;
  pnlUsd: number;
}

export interface HundredDollarReport {
  startEquity: number;
  endEquity: number;
  returnPct: number;
  riskPerTradePct: number;
  periodLabel: string;
  symbolsRequested: number;
  symbolsCovered: number;
  /** Every qualifying setup found across the whole universe. */
  candidateCount: number;
  /** The subset the $100 account could actually take (one position at a time). */
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  avgRMultiple: number | null;
  maxDrawdownPct: number;
  bestTradeUsd: number | null;
  worstTradeUsd: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  equityCurve: EquityPoint[];
  trades: TakenTrade[];
  perSymbol: SymbolStat[];
  perStrategy: StrategyStat[];
  generatedAtLabel: string;
  timestamp: string;
}

export interface HundredProgress {
  done: number;
  total: number;
  currentLabel: string;
}

function classify(symbol: string): AssetClass {
  if (symbol === 'XAUUSDT') return 'GOLD';
  if (symbol === 'XAGUSDT') return 'SILVER';
  if (FOREX_MAJORS.some(f => f.symbol === symbol)) return 'FOREX';
  return 'CRYPTO';
}

const catRank = (c?: string) => (c === 'TREND' ? 0 : c === 'BREAKOUT' ? 1 : c === 'ICT/SMC' ? 2 : 3);

/** Hands the browser a frame so a long backtest never freezes the UI. */
const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Walks one market bar-by-bar, applying the SAME gate the live engine applies,
 * and resolves each qualifying setup against the actual subsequent candles.
 */
async function simulateMarket(
  symbol: string,
  pair: string,
  assetClass: AssetClass,
  candles: CandleData[],
): Promise<SimTrade[]> {
  const out: SimTrade[] = [];
  const closes = candles.map(c => c.close);
  const atrSeries = atr(candles, 14);
  const rsiSeries = rsi(closes, 14);
  const macdRes = macd(closes);
  const ema50Full = ema(closes, 50);
  const ema200Full = ema(closes, Math.min(200, closes.length - 1));
  // 1h bars sit between the SCALP and SWING horizons; SWING floors are the
  // honest choice here because a 1h bar's ATR supports a real position trade.
  const profile = profileForAsset('SWING', assetClass);
  const nowMs = Date.now();
  const barMs = 60 * 60 * 1000;

  const start = Math.max(WARMUP_BARS, 60);
  for (let i = start; i < candles.length - 2; i++) {
    if ((i - start) % 40 === 0) await yieldToUi();

    const atrVal = atrSeries[i];
    if (!atrVal || isNaN(atrVal)) continue;

    const results = evaluateAllStrategies(candles.slice(0, i + 1));
    const triggered = results.filter(r => r.triggered && r.direction);
    if (triggered.length === 0) continue;

    const longVotes = triggered.filter(r => r.direction === 'LONG').length;
    const shortVotes = triggered.filter(r => r.direction === 'SHORT').length;
    const direction: 'LONG' | 'SHORT' | null =
      longVotes > shortVotes ? 'LONG' : shortVotes > longVotes ? 'SHORT' : null;
    if (!direction) continue;

    const agreeing = triggered.filter(r => r.direction === direction);
    if (agreeing.length < MIN_CONFLUENCE) continue;

    // Trend regime — never fight an established trend (live rule).
    const ema50v = ema50Full[i];
    const ema200v = ema200Full[i];
    const price = closes[i];
    if (direction === 'LONG' && ema50v < ema200v && price < ema200v) continue;
    if (direction === 'SHORT' && ema50v > ema200v && price > ema200v) continue;

    // Momentum — RSI/MACD must not contradict, and one must support (live rule).
    const rsiVal = rsiSeries[i];
    const hist = macdRes.histogram[i];
    if (direction === 'LONG') {
      if (!(rsiVal >= 38) || !(rsiVal >= 48 || hist > 0)) continue;
    } else {
      if (!(rsiVal <= 62) || !(rsiVal <= 52 || hist < 0)) continue;
    }

    // Entry on the NEXT bar's open — no look-ahead.
    const entryIdx = i + 1;
    const entryPrice = candles[entryIdx].open;
    const digits = entryPrice < 1 ? 6 : entryPrice < 10 ? 4 : 2;
    const levels = scaleToMinReward(entryPrice, atrVal, direction, profile, digits);
    if (!levels) continue; // no worthwhile risk structure — the live engine would refuse too

    const best = agreeing.slice().sort((a, b) => catRank(a.category) - catRank(b.category))[0];

    let outcome: 'WIN' | 'LOSS' | null = null;
    let exitBar = entryIdx;
    for (let f = entryIdx; f < Math.min(candles.length, entryIdx + MAX_HOLD_BARS); f++) {
      const bar = candles[f];
      const hitSl = direction === 'LONG' ? bar.low <= levels.stopLoss : bar.high >= levels.stopLoss;
      const hitTp = direction === 'LONG' ? bar.high >= levels.target1 : bar.low <= levels.target1;
      // Conservative: a bar that touches both counts as the loss.
      if (hitSl) { outcome = 'LOSS'; exitBar = f; break; }
      if (hitTp) { outcome = 'WIN'; exitBar = f; break; }
    }
    if (!outcome) continue; // unresolved inside the horizon — excluded, not guessed

    out.push({
      symbol,
      pair,
      assetClass,
      direction,
      strategy: best.name,
      confluence: agreeing.length,
      entryBar: entryIdx,
      exitBar,
      entryAt: nowMs - (candles.length - 1 - entryIdx) * barMs,
      entryPrice,
      stopLoss: levels.stopLoss,
      target1: levels.target1,
      tp1Pct: levels.tp1Pct,
      slPct: levels.slPct,
      rr: levels.rr,
      outcome,
      rMultiple: outcome === 'WIN' ? levels.rr : -1,
    });

    // Skip ahead past this trade so one market can't stack overlapping copies of
    // the same setup bar after bar.
    i = exitBar;
  }

  return out;
}

async function runPooled<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

/**
 * Runs the whole $100 / 1-month portfolio simulation across the live universe.
 */
export async function runHundredDollarBacktest(
  onProgress?: (p: HundredProgress) => void,
): Promise<HundredDollarReport> {
  onProgress?.({ done: 0, total: 0, currentLabel: 'Building the market universe…' });

  let universe: { symbol: string; pair: string }[] = [];
  try {
    const tickers = await fetchTopCryptos();
    universe = tickers
      .filter(t => t.isFutures)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, CRYPTO_UNIVERSE)
      .map(t => ({ symbol: t.symbol, pair: t.pair }));
  } catch (e) {
    console.error('[hundredDollarBacktest] ticker fetch failed:', e);
  }
  universe = [...universe, ...FOREX_MAJORS.map(f => ({ symbol: f.symbol, pair: f.pair }))];

  const total = universe.length;
  let done = 0;
  const candidates: SimTrade[] = [];
  let covered = 0;

  await runPooled(universe, CONCURRENCY, async (m) => {
    onProgress?.({ done, total, currentLabel: m.pair });
    try {
      const assetClass = classify(m.symbol);
      const candles = assetClass === 'FOREX'
        ? await fetchForexKlines(m.symbol, '1h', HOURS_PER_MONTH)
        : await fetchKlines(m.symbol, '1h', HOURS_PER_MONTH);
      if (candles.length >= MIN_CANDLES) {
        covered += 1;
        const trades = await simulateMarket(m.symbol, m.pair, assetClass, candles.slice(-HOURS_PER_MONTH));
        candidates.push(...trades);
      }
    } catch (e) {
      console.error(`[hundredDollarBacktest] ${m.symbol} failed:`, e);
    }
    done += 1;
    onProgress?.({ done, total, currentLabel: m.pair });
  });

  // ---- Run the actual $100 account -----------------------------------------
  // Chronological across every market, ONE open position at a time.
  candidates.sort((a, b) => a.entryAt - b.entryAt || a.entryBar - b.entryBar);

  let equity = START_EQUITY;
  let freeAt = -Infinity;               // ms timestamp when the account is free again
  const barMs = 60 * 60 * 1000;
  const taken: TakenTrade[] = [];
  const equityCurve: EquityPoint[] = [{ i: 0, equity: START_EQUITY }];

  for (const c of candidates) {
    if (c.entryAt < freeAt) continue;   // already in a position — this one is skipped
    const riskUsd = +(equity * RISK_PER_TRADE).toFixed(4);
    const pnlUsd = +(riskUsd * c.rMultiple).toFixed(4);
    const balanceBefore = equity;
    equity = +(equity + pnlUsd).toFixed(4);
    taken.push({ ...c, balanceBefore, riskUsd, pnlUsd, balanceAfter: equity });
    equityCurve.push({ i: taken.length, equity: +equity.toFixed(2) });
    freeAt = c.entryAt + (c.exitBar - c.entryBar + 1) * barMs;
    if (equity <= 1) break;             // account effectively blown — stop honestly
  }

  const wins = taken.filter(t => t.outcome === 'WIN').length;
  const losses = taken.length - wins;
  const grossWin = taken.filter(t => t.pnlUsd > 0).reduce((a, t) => a + t.pnlUsd, 0);
  const grossLoss = Math.abs(taken.filter(t => t.pnlUsd < 0).reduce((a, t) => a + t.pnlUsd, 0));

  let peak = START_EQUITY;
  let maxDd = 0;
  for (const p of equityCurve) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  let winStreak = 0, lossStreak = 0, curW = 0, curL = 0;
  for (const t of taken) {
    if (t.outcome === 'WIN') { curW += 1; curL = 0; } else { curL += 1; curW = 0; }
    if (curW > winStreak) winStreak = curW;
    if (curL > lossStreak) lossStreak = curL;
  }

  const symMap = new Map<string, SymbolStat>();
  for (const t of taken) {
    const s = symMap.get(t.symbol) ?? { symbol: t.symbol, pair: t.pair, assetClass: t.assetClass, trades: 0, wins: 0, winRate: null, pnlUsd: 0 };
    s.trades += 1;
    if (t.outcome === 'WIN') s.wins += 1;
    s.pnlUsd = +(s.pnlUsd + t.pnlUsd).toFixed(4);
    symMap.set(t.symbol, s);
  }
  const perSymbol = Array.from(symMap.values()).map(s => ({
    ...s,
    winRate: s.trades >= MIN_TRADES_TO_REPORT ? +((s.wins / s.trades) * 100).toFixed(1) : null,
  })).sort((a, b) => b.pnlUsd - a.pnlUsd);

  const stratMap = new Map<string, StrategyStat>();
  for (const t of taken) {
    const s = stratMap.get(t.strategy) ?? { strategy: t.strategy, trades: 0, wins: 0, winRate: null, pnlUsd: 0 };
    s.trades += 1;
    if (t.outcome === 'WIN') s.wins += 1;
    s.pnlUsd = +(s.pnlUsd + t.pnlUsd).toFixed(4);
    stratMap.set(t.strategy, s);
  }
  const perStrategy = Array.from(stratMap.values()).map(s => ({
    ...s,
    winRate: s.trades >= MIN_TRADES_TO_REPORT ? +((s.wins / s.trades) * 100).toFixed(1) : null,
  })).sort((a, b) => b.pnlUsd - a.pnlUsd);

  const rSum = taken.reduce((a, t) => a + t.rMultiple, 0);
  const now = new Date();

  return {
    startEquity: START_EQUITY,
    endEquity: +equity.toFixed(2),
    returnPct: +(((equity - START_EQUITY) / START_EQUITY) * 100).toFixed(2),
    riskPerTradePct: RISK_PER_TRADE * 100,
    periodLabel: 'Last 30 days · 1-hour candles',
    symbolsRequested: total,
    symbolsCovered: covered,
    candidateCount: candidates.length,
    totalTrades: taken.length,
    wins,
    losses,
    winRate: taken.length >= MIN_TRADES_TO_REPORT ? +((wins / taken.length) * 100).toFixed(1) : null,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
    avgRMultiple: taken.length ? +(rSum / taken.length).toFixed(2) : null,
    maxDrawdownPct: +maxDd.toFixed(2),
    bestTradeUsd: taken.length ? +Math.max(...taken.map(t => t.pnlUsd)).toFixed(2) : null,
    worstTradeUsd: taken.length ? +Math.min(...taken.map(t => t.pnlUsd)).toFixed(2) : null,
    longestWinStreak: winStreak,
    longestLossStreak: lossStreak,
    equityCurve,
    trades: taken,
    perSymbol,
    perStrategy,
    generatedAtLabel: now.toLocaleString(),
    timestamp: now.toISOString(),
  };
}
