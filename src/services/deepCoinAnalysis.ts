/**
 * Deep single-coin analysis.
 *
 * The whole-market scanner tells you WHAT is moving; this tells you everything
 * about ONE instrument. It runs the REAL strategy engine and indicator math
 * across MULTIPLE timeframes (5m → 4h), measures how aligned those timeframes
 * are, detects RSI divergence, and — when there's an actual trigger — builds a
 * genuine Signal (ATR-based levels + walk-forward backtested win rate) via the
 * same engine the scanner uses. No hardcoded win %, no invented targets.
 */
import { CandleData, Signal } from '@/types/trading';
import { fetchKlines } from './binanceApi';
import { evaluateAllStrategies } from './strategies';
import { rsi, macd, ema, atr, detectRsiDivergence } from './indicators';
import { buildSignalFromStrategyHit, ScanTarget } from './signalEngine';

export interface TimeframeRead {
  interval: string;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  rsi: number | null;
  macdHist: number | null;
  atrPercent: number | null;
  direction: 'LONG' | 'SHORT' | null; // net of triggered strategies on this TF
  triggeredStrategies: string[];
}

export interface DeepCoinAnalysis {
  symbol: string;
  pair: string;
  price: number;
  perTimeframe: TimeframeRead[];
  netBias: 'LONG' | 'SHORT' | 'NEUTRAL';
  alignmentScore: number; // 0-100: how strongly the weighted timeframes agree
  divergence: 'bullish' | 'bearish' | null;
  bestSignal: Signal | null; // strongest actionable setup, or null if nothing triggered
  summary: string;
  analyzedAt: string;
}

// Timeframes analysed, lowest → highest, with the weight each carries in the
// net multi-timeframe bias (higher timeframes dominate, as they should).
const TF_CONFIG: { interval: string; weight: number }[] = [
  { interval: '5m', weight: 1 },
  { interval: '15m', weight: 2 },
  { interval: '1h', weight: 3 },
  { interval: '4h', weight: 4 },
];

function readTimeframe(interval: string, candles: CandleData[]): TimeframeRead {
  const i = candles.length - 1;
  const closes = candles.map(c => c.close);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const price = closes[i];
  let trend: TimeframeRead['trend'] = 'SIDEWAYS';
  if (ema20[i] > ema50[i] && price >= ema20[i]) trend = 'UP';
  else if (ema20[i] < ema50[i] && price <= ema20[i]) trend = 'DOWN';

  const rsiSeries = rsi(closes, 14);
  const rsiVal = rsiSeries[i];
  const macdRes = macd(closes);
  const macdHist = macdRes.histogram[i];
  const atrSeries = atr(candles, 14);
  const atrVal = atrSeries[i];

  const results = evaluateAllStrategies(candles);
  const triggered = results.filter(r => r.triggered && r.direction);
  const longs = triggered.filter(r => r.direction === 'LONG').length;
  const shorts = triggered.filter(r => r.direction === 'SHORT').length;
  const direction: TimeframeRead['direction'] =
    longs === 0 && shorts === 0 ? null : longs >= shorts ? 'LONG' : 'SHORT';

  return {
    interval,
    trend,
    rsi: rsiVal != null && !isNaN(rsiVal) ? +rsiVal.toFixed(1) : null,
    macdHist: macdHist != null && !isNaN(macdHist) ? +macdHist.toFixed(4) : null,
    atrPercent: atrVal && price ? +((atrVal / price) * 100).toFixed(2) : null,
    direction,
    triggeredStrategies: triggered.map(r => r.name),
  };
}

/**
 * Runs the full multi-timeframe deep-dive on one symbol. Fetches real candles
 * for each timeframe, reads each, computes a weighted net bias + alignment
 * score, and builds the strongest actionable Signal from whichever timeframe
 * has the most confluence in the net-bias direction.
 */
export async function analyzeCoinDeep(symbol: string, pair: string): Promise<DeepCoinAnalysis> {
  const perTimeframe: TimeframeRead[] = [];
  const candlesByTf: Record<string, CandleData[]> = {};

  for (const { interval } of TF_CONFIG) {
    try {
      const candles = await fetchKlines(symbol, interval, 200);
      if (candles.length < 60) continue;
      candlesByTf[interval] = candles;
      perTimeframe.push(readTimeframe(interval, candles));
    } catch (e) {
      console.error(`[analyzeCoinDeep] ${symbol} ${interval} failed:`, e);
    }
  }

  if (perTimeframe.length === 0) {
    throw new Error(`Could not load any live candles for ${pair}. Try again in a moment.`);
  }

  // Weighted net directional bias across the timeframes we successfully read.
  let score = 0;
  let totalWeight = 0;
  for (const tf of perTimeframe) {
    const w = TF_CONFIG.find(c => c.interval === tf.interval)?.weight ?? 1;
    totalWeight += w;
    if (tf.direction === 'LONG') score += w;
    else if (tf.direction === 'SHORT') score -= w;
  }
  const netBias: DeepCoinAnalysis['netBias'] =
    Math.abs(score) < totalWeight * 0.2 ? 'NEUTRAL' : score > 0 ? 'LONG' : 'SHORT';
  const alignmentScore = totalWeight > 0 ? Math.round((Math.abs(score) / totalWeight) * 100) : 0;

  // Divergence from the 1h read (fall back to the highest TF we have).
  const primaryTf = candlesByTf['1h'] ?? candlesByTf[perTimeframe[perTimeframe.length - 1].interval];
  const divergence = primaryTf
    ? detectRsiDivergence(primaryTf, rsi(primaryTf.map(c => c.close), 14))
    : null;

  // Build the strongest actionable Signal: prefer a timeframe that triggered in
  // the net-bias direction (or any triggered TF if the market is NEUTRAL). We
  // pick the timeframe with the most agreeing strategies for the cleanest read.
  let bestSignal: Signal | null = null;
  const candidateTfs = perTimeframe
    .filter(tf => tf.direction && (netBias === 'NEUTRAL' || tf.direction === netBias))
    .sort((a, b) => b.triggeredStrategies.length - a.triggeredStrategies.length);

  const chosen = candidateTfs[0];
  if (chosen) {
    const candles = candlesByTf[chosen.interval];
    const results = evaluateAllStrategies(candles);
    const triggered = results.filter(r => r.triggered && r.direction && r.direction === chosen.direction);
    if (triggered.length > 0) {
      const best = triggered[0];
      const agreeing = triggered.map(r => r.name);
      const target: ScanTarget = {
        symbol,
        pair,
        interval: chosen.interval,
        isScalp: chosen.interval === '5m',
      };
      bestSignal = buildSignalFromStrategyHit(target, candles, best, agreeing);
    }
  }

  const price = (candlesByTf['5m'] ?? candlesByTf[perTimeframe[0].interval]);
  const lastPrice = price[price.length - 1].close;

  const summary = buildSummary(pair, netBias, alignmentScore, perTimeframe, divergence, bestSignal);

  return {
    symbol,
    pair,
    price: lastPrice,
    perTimeframe,
    netBias,
    alignmentScore,
    divergence,
    bestSignal,
    summary,
    analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function buildSummary(
  pair: string,
  netBias: DeepCoinAnalysis['netBias'],
  alignment: number,
  tfs: TimeframeRead[],
  divergence: 'bullish' | 'bearish' | null,
  signal: Signal | null,
): string {
  const trendMap = tfs.map(t => `${t.interval} ${t.trend.toLowerCase()}`).join(', ');
  const biasClause =
    netBias === 'NEUTRAL'
      ? `${pair} is showing no clear multi-timeframe agreement right now (alignment ${alignment}%) — timeframes are mixed (${trendMap}). Best to wait for structure to resolve.`
      : `${pair} carries a ${netBias} multi-timeframe bias at ${alignment}% alignment across the timeframes read (${trendMap}).`;

  const divClause = divergence
    ? ` A ${divergence} RSI divergence is present on the higher timeframe — ${
        (divergence === 'bullish' && netBias === 'LONG') || (divergence === 'bearish' && netBias === 'SHORT')
          ? 'this confirms the bias.'
          : 'treat this as a caution flag against the bias.'
      }`
    : ' No RSI divergence detected on the higher timeframe.';

  const signalClause = signal
    ? ` Actionable setup: ${signal.type} via ${signal.strategy} on the ${signal.timeframe} — entry $${signal.entryPrice}, SL $${signal.stopLoss}, TP1 $${signal.target1}, conviction ${signal.confidenceScore ?? '--'}/100. ${signal.backtestLabel ?? ''}`
    : ' No strategy is triggering a clean entry on any timeframe at this moment — there is no forced trade here.';

  return `${biasClause}${divClause}${signalClause}`;
}
