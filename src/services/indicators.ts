import { CandleData } from '@/types/trading';

/**
 * Real technical-indicator math computed from real OHLCV candles.
 * Nothing in this file uses Math.random() — every value here is derived
 * deterministically from the candle data passed in.
 */

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev === null) {
      prev = values[i];
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function stochRsi(closes: number[], period = 14, smoothK = 3): number[] {
  const r = rsi(closes, period);
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = period * 2; i < closes.length; i++) {
    const window = r.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (window.length < period) continue;
    const min = Math.min(...window);
    const max = Math.max(...window);
    out[i] = max === min ? 50 : ((r[i] - min) / (max - min)) * 100;
  }
  // light smoothing
  const smoothed = sma(out.map(v => (isNaN(v) ? 0 : v)), smoothK);
  return smoothed.map((v, i) => (isNaN(out[i]) ? NaN : v));
}

export interface MacdResult { macd: number[]; signal: number[]; histogram: number[]; }

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export function atr(candles: CandleData[], period = 14): number[] {
  const trs: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  return emaWilder(trs, period);
}

function emaWilder(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface BollingerResult { upper: number[]; mid: number[]; lower: number[]; width: number[]; }

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const mid = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const width: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); weight.push(NaN); continue; }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + mult * sd);
    lower.push(mean - mult * sd);
    weight.push(sd === 0 ? 0 : ((mean + mult * sd) - (mean - mult * sd)) / mean);
  }
  return { upper, mid, lower, width };
}

export function vwap(candles: CandleData[]): number[] {
  const out: number[] = [];
  let cumPV = 0;
  let cumV = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    out.push(cumV === 0 ? typical : cumPV / cumV);
  }
  return out;
}

// Real approximation of order-flow delta from Binance kline taker-buy volume
// (Binance klines report takerBuyBaseVolume — this is genuine exchange data,
// not simulated, though it is candle-level not tick-level footprint).
export function volumeDelta(candles: CandleData[]): number[] {
  return candles.map(c => {
    const buyVol = c.takerBuyVolume ?? c.volume / 2; // fallback if field unavailable
    const sellVol = c.volume - buyVol;
    return +(buyVol - sellVol).toFixed(4);
  });
}

export interface SwingPoint { index: number; price: number; type: 'high' | 'low'; }

export function findSwingPoints(candles: CandleData[], lookback = 3): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const highs = window.map(c => c.high);
    const lows = window.map(c => c.low);
    if (candles[i].high === Math.max(...highs)) points.push({ index: i, price: candles[i].high, type: 'high' });
    if (candles[i].low === Math.min(...lows)) points.push({ index: i, price: candles[i].low, type: 'low' });
  }
  return points;
}

// Simple RSI divergence detector: compares the last two swing lows/highs in
// price against RSI at the same indices.
export function detectRsiDivergence(candles: CandleData[], rsiValues: number[]): 'bullish' | 'bearish' | null {
  const swings = findSwingPoints(candles, 2);
  const lows = swings.filter(s => s.type === 'low').slice(-2);
  const highs = swings.filter(s => s.type === 'high').slice(-2);

  if (lows.length === 2) {
    const [a, b] = lows;
    const rsiA = rsiValues[a.index];
    const rsiB = rsiValues[b.index];
    if (!isNaN(rsiA) && !isNaN(rsiB) && b.price < a.price && rsiB > rsiA) return 'bullish';
  }
  if (highs.length === 2) {
    const [a, b] = highs;
    const rsiA = rsiValues[a.index];
    const rsiB = rsiValues[b.index];
    if (!isNaN(rsiA) && !isNaN(rsiB) && b.price > a.price && rsiB < rsiA) return 'bearish';
  }
  return null;
}

// Three-candle Fair Value Gap detection (ICT/SMC definition).
export function findFairValueGaps(candles: CandleData[]): { index: number; type: 'bullish' | 'bearish'; top: number; bottom: number }[] {
  const gaps: { index: number; type: 'bullish' | 'bearish'; top: number; bottom: number }[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c3.low > c1.high) gaps.push({ index: i, type: 'bullish', top: c3.low, bottom: c1.high });
    if (c3.high < c1.low) gaps.push({ index: i, type: 'bearish', top: c1.low, bottom: c3.high });
  }
  return gaps;
}

export function fibLevels(high: number, low: number) {
  const range = high - low;
  return {
    l236: high - range * 0.236,
    l382: high - range * 0.382,
    l5: high - range * 0.5,
    l618: high - range * 0.618, // "golden zone" upper bound commonly paired with 0.65
    l65: high - range * 0.65,
  };
}