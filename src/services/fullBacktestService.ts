import { CandleData, CoinTicker } from '@/types/trading';
import { fetchKlines, fetchTopCryptos } from './binanceApi';
import { FOREX_MAJORS, fetchForexDailyYear, isForexSymbol } from './forexApi';
import { runWalkForwardBacktest, WalkForwardResult, StrategyBacktestStat } from './backtestEngine';
import { MIN_TRADES_TO_REPORT } from './riskConfig';

/**
 * WHOLE-WEBSITE 1-YEAR BACKTEST
 *
 * Runs the same genuine walk-forward engine (runWalkForwardBacktest) that powers
 * the single-pair backtest, but across the ENTIRE tradable universe — the top
 * Binance USDT-M futures by volume plus every live forex major — on ~1 year of
 * real DAILY candles per symbol. Nothing is fabricated: symbols whose candles
 * can't be fetched are skipped, and win rates below the honest minimum sample
 * size are reported as null (shown as "n/a") rather than guessed.
 */

export type AssetClass = 'CRYPTO' | 'GOLD' | 'SILVER' | 'FOREX';

export interface SymbolBacktestResult {
  symbol: string;
  label: string;
  assetClass: AssetClass;
  candlesUsed: number;
  result: WalkForwardResult;
}

export interface FullBacktestReport {
  generatedAt: string;      // ISO
  generatedAtLabel: string; // human readable
  lookbackLabel: string;    // e.g. "1 Year · Daily candles"
  symbolsRequested: number;
  symbolsCovered: number;   // symbols that actually returned enough candles
  // aggregate across every symbol
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number | null;
  avgRMultiple: number | null;
  profitFactor: number | null;
  perStrategy: StrategyBacktestStat[];
  perSymbol: SymbolBacktestResult[];
  rSequence: number[]; // combined chronological R across all symbols (equity curve)
  bestStrategy: { strategy: string; winRate: number } | null;
  worstStrategy: { strategy: string; winRate: number } | null;
  bestSymbol: { label: string; winRate: number } | null;
}

export interface BacktestProgress {
  done: number;
  total: number;
  currentLabel: string;
}

const TOP_CRYPTO_COUNT = 24;      // top-N futures by 24h volume
const DAILY_CANDLE_LIMIT = 365;   // ~1 year of daily bars
const CONCURRENCY = 4;            // gentle on Binance / Yahoo rate limits
const MIN_CANDLES = 90;           // need a meaningful window to run the engine

function classify(symbol: string): AssetClass {
  if (symbol === 'XAUUSDT') return 'GOLD';
  if (symbol === 'XAGUSDT') return 'SILVER';
  if (isForexSymbol(symbol)) return 'FOREX';
  return 'CRYPTO';
}

interface UniverseItem { symbol: string; label: string; }

/** Build the scan universe: top crypto futures by volume + all forex majors. */
async function buildUniverse(): Promise<UniverseItem[]> {
  const items: UniverseItem[] = [];
  try {
    const tickers: CoinTicker[] = await fetchTopCryptos();
    const crypto = tickers
      .filter(t => t.isFutures)          // real futures only (forex added separately)
      .slice(0, TOP_CRYPTO_COUNT)
      .map(t => ({ symbol: t.symbol, label: t.baseAsset || t.symbol }));
    items.push(...crypto);
  } catch { /* if tickers fail we still run forex below */ }

  // Always include the live forex majors.
  for (const f of FOREX_MAJORS) {
    if (!items.some(i => i.symbol === f.symbol)) {
      items.push({ symbol: f.symbol, label: f.pair.replace(' (FX)', '') });
    }
  }
  return items;
}

async function fetchYearCandles(symbol: string): Promise<CandleData[]> {
  if (isForexSymbol(symbol)) return fetchForexDailyYear(symbol, DAILY_CANDLE_LIMIT);
  return fetchKlines(symbol, '1d', DAILY_CANDLE_LIMIT);
}

/** Run a batch of async tasks with a fixed concurrency cap. */
async function runPooled<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => pump());
  await Promise.all(runners);
  return out;
}

/**
 * Runs the full 1-year backtest across the whole universe and returns an
 * aggregated, honest report. `onProgress` fires as each symbol resolves.
 */
export async function runFullWebsiteBacktest(
  onProgress?: (p: BacktestProgress) => void,
): Promise<FullBacktestReport> {
  const universe = await buildUniverse();
  const total = universe.length;
  let done = 0;

  const perSymbol: SymbolBacktestResult[] = [];

  await runPooled(universe, CONCURRENCY, async (item) => {
    try {
      const candles = await fetchYearCandles(item.symbol);
      if (candles.length >= MIN_CANDLES) {
        const result = runWalkForwardBacktest(candles, DAILY_CANDLE_LIMIT);
        perSymbol.push({
          symbol: item.symbol,
          label: item.label,
          assetClass: classify(item.symbol),
          candlesUsed: candles.length,
          result,
        });
      }
    } catch { /* skip this symbol — never fabricate */ }
    finally {
      done += 1;
      onProgress?.({ done, total, currentLabel: item.label });
    }
  });

  return aggregate(perSymbol, total);
}

function aggregate(perSymbol: SymbolBacktestResult[], symbolsRequested: number): FullBacktestReport {
  // Merge per-strategy stats across every symbol.
  const strat = new Map<string, { trades: number; wins: number; losses: number }>();
  const rSequence: number[] = [];
  let totalTrades = 0, totalWins = 0, totalLosses = 0;

  // Keep symbol order stable (crypto by volume, then forex) for the equity curve.
  for (const s of perSymbol) {
    for (const ps of s.result.perStrategy) {
      const e = strat.get(ps.strategy) ?? { trades: 0, wins: 0, losses: 0 };
      e.trades += ps.trades; e.wins += ps.wins; e.losses += ps.losses;
      strat.set(ps.strategy, e);
    }
    rSequence.push(...s.result.rSequence);
    totalTrades += s.result.totalTrades;
    totalWins += s.result.totalWins;
    totalLosses += s.result.totalLosses;
  }

  const perStrategy: StrategyBacktestStat[] = Array.from(strat.entries())
    .map(([strategy, e]) => ({
      strategy,
      trades: e.trades,
      wins: e.wins,
      losses: e.losses,
      winRate: e.trades >= MIN_TRADES_TO_REPORT ? +((e.wins / e.trades) * 100).toFixed(1) : null,
    }))
    .sort((a, b) => b.trades - a.trades);

  const grossWin = rSequence.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(rSequence.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null;
  const rSum = rSequence.reduce((a, b) => a + b, 0);

  const rated = perStrategy.filter(s => s.winRate != null) as (StrategyBacktestStat & { winRate: number })[];
  const bestStrategy = rated.length
    ? rated.reduce((best, s) => (s.winRate > best.winRate ? s : best))
    : null;
  const worstStrategy = rated.length
    ? rated.reduce((worst, s) => (s.winRate < worst.winRate ? s : worst))
    : null;

  const ratedSymbols = perSymbol
    .filter(s => s.result.overallWinRate != null)
    .map(s => ({ label: s.label, winRate: s.result.overallWinRate as number }));
  const bestSymbol = ratedSymbols.length
    ? ratedSymbols.reduce((best, s) => (s.winRate > best.winRate ? s : best))
    : null;

  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    generatedAtLabel: now.toLocaleString(),
    lookbackLabel: '1 Year · Daily candles',
    symbolsRequested,
    symbolsCovered: perSymbol.length,
    totalTrades,
    totalWins,
    totalLosses,
    overallWinRate: totalTrades >= MIN_TRADES_TO_REPORT ? +((totalWins / totalTrades) * 100).toFixed(1) : null,
    avgRMultiple: totalTrades > 0 ? +(rSum / totalTrades).toFixed(2) : null,
    profitFactor,
    perStrategy,
    perSymbol: perSymbol.sort((a, b) => b.result.totalTrades - a.result.totalTrades),
    rSequence,
    bestStrategy: bestStrategy ? { strategy: bestStrategy.strategy, winRate: bestStrategy.winRate } : null,
    worstStrategy: worstStrategy ? { strategy: worstStrategy.strategy, winRate: worstStrategy.winRate } : null,
    bestSymbol,
  };
}
