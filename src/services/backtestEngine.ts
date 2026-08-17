import { CandleData } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr } from './indicators';
import { SL_ATR, TP1_ATR, MAX_FORWARD_BARS, MIN_TRADES_TO_REPORT } from './riskConfig';

export interface StrategyBacktestStat {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null; // null when there isn't enough sample size to report honestly
}

export interface WalkForwardResult {
  perStrategy: StrategyBacktestStat[];
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number | null;
  avgRMultiple: number | null;
}

/**
 * Walks forward through real historical candles, re-evaluates every strategy
 * causally at each bar (only using data up to that bar), and when a strategy
 * triggers, simulates the trade forward against the ACTUAL subsequent
 * candles to see whether TP or SL was hit first. This is a genuine, if
 * simplified, backtest — not a random number.
 */
export function runWalkForwardBacktest(candles: CandleData[], maxBars = 180): WalkForwardResult {
  const atrSeries = atr(candles, 14);
  const start = Math.max(60, candles.length - maxBars);
  const statsMap = new Map<string, { trades: number; wins: number; losses: number; rSum: number }>();

  for (let i = start; i < candles.length - 1; i++) {
    const windowCandles = candles.slice(0, i + 1);
    const results = evaluateAllStrategies(windowCandles);
    const atrVal = atrSeries[i];
    if (!atrVal || isNaN(atrVal)) continue;

    for (const r of results) {
      if (!r.triggered || !r.direction) continue;
      const entryIdx = i + 1;
      if (entryIdx >= candles.length) continue;

      const entry = candles[entryIdx].open;
      const dirMult = r.direction === 'LONG' ? 1 : -1;
      const sl = entry - dirMult * SL_ATR * atrVal;
      const tp1 = entry + dirMult * TP1_ATR * atrVal;

      let outcome: 'win' | 'loss' | null = null;
      for (let f = entryIdx; f < Math.min(candles.length, entryIdx + MAX_FORWARD_BARS); f++) {
        const bar = candles[f];
        const hitSl = r.direction === 'LONG' ? bar.low <= sl : bar.high >= sl;
        const hitTp1 = r.direction === 'LONG' ? bar.high >= tp1 : bar.low <= tp1;
        // Conservative: if both levels are touched in the same candle, count the loss first.
        if (hitSl) { outcome = 'loss'; break; }
        if (hitTp1) { outcome = 'win'; break; }
      }
      if (outcome === null) continue; // trade never resolved within the horizon — excluded, not counted either way

      const entry_stats = statsMap.get(r.name) ?? { trades: 0, wins: 0, losses: 0, rSum: 0 };
      entry_stats.trades += 1;
      if (outcome === 'win') { entry_stats.wins += 1; entry_stats.rSum += TP1_ATR / SL_ATR; }
      else { entry_stats.losses += 1; entry_stats.rSum -= 1; }
      statsMap.set(r.name, entry_stats);
    }
  }

  const perStrategy: StrategyBacktestStat[] = Array.from(statsMap.entries()).map(([strategy, s]) => ({
    strategy,
    trades: s.trades,
    wins: s.wins,
    losses: s.losses,
    winRate: s.trades >= MIN_TRADES_TO_REPORT ? +((s.wins / s.trades) * 100).toFixed(1) : null,
  }));

  const totalTrades = perStrategy.reduce((sum, s) => sum + s.trades, 0);
  const totalWins = perStrategy.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = perStrategy.reduce((sum, s) => sum + s.losses, 0);
  const rSum = Array.from(statsMap.values()).reduce((sum, s) => sum + s.rSum, 0);

  return {
    perStrategy: perStrategy.sort((a, b) => b.trades - a.trades),
    totalTrades,
    totalWins,
    totalLosses,
    overallWinRate: totalTrades >= MIN_TRADES_TO_REPORT ? +((totalWins / totalTrades) * 100).toFixed(1) : null,
    avgRMultiple: totalTrades > 0 ? +(rSum / totalTrades).toFixed(2) : null,
  };
}