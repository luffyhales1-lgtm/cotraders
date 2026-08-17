import { Signal, CandleData } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr, volumeDelta, rsi, macd } from './indicators';
import { runWalkForwardBacktest } from './backtestEngine';
import { SL_ATR, TP1_ATR, TP2_ATR, TP3_ATR, riskRewardLabel, suggestLeverage } from './riskConfig';
import { fetchKlines } from './binanceApi';

export interface ScanTarget { symbol: string; pair: string; interval?: string; isScalp?: boolean; }

export const DEFAULT_SCAN_WATCHLIST: ScanTarget[] = [
  { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'BNBUSDT', pair: 'BNB/USDT (PERP)', interval: '15m', isScalp: false },
  { symbol: 'XRPUSDT', pair: 'XRP/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'SUIUSDT', pair: 'SUI/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'NEARUSDT', pair: 'NEAR/USDT (PERP)', interval: '15m', isScalp: false },
  { symbol: 'AVAXUSDT', pair: 'AVAX/USDT (PERP)', interval: '15m', isScalp: false },
  { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', interval: '5m', isScalp: true },
];

/**
 * Scans a watchlist against REAL candle data and REAL strategy math.
 * A signal only comes back for a symbol when one of the 21 strategies
 * actually triggered on the latest closed candle. If nothing triggers
 * anywhere, this correctly returns an empty array -- it will not invent a
 * signal just to have something to show.
 */
export async function scanMarketForSignals(watchlist: ScanTarget[] = DEFAULT_SCAN_WATCHLIST): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const target of watchlist) {
    try {
      const candles = await fetchKlines(target.symbol, target.interval ?? '5m', 200);
      if (candles.length < 60) continue;

      const results = evaluateAllStrategies(candles);
      const triggered = results.filter(r => r.triggered && r.direction);
      if (triggered.length === 0) continue;

      const best = triggered[0];
      const agreeing = triggered.filter(r => r.direction === best.direction);

      const signal = buildSignalFromStrategyHit(target, candles, best, agreeing.map(a => a.name));
      if (signal) signals.push(signal);
    } catch (e) {
      console.error(`[scanMarketForSignals] ${target.symbol} failed:`, e);
    }
  }

  return signals;
}

export function buildSignalFromStrategyHit(
  target: ScanTarget,
  candles: CandleData[],
  hit: { name: string; direction: 'LONG' | 'SHORT' | null; reason: string },
  confluenceStrategies: string[],
): Signal | null {
  if (!hit.direction) return null;

  const i = candles.length - 1;
  const closes = candles.map(c => c.close);
  const atrSeries = atr(candles, 14);
  const atrVal = atrSeries[i];
  if (!atrVal || isNaN(atrVal)) return null;

  const entryPrice = closes[i];
  const digits = entryPrice < 1 ? 6 : entryPrice < 10 ? 4 : 2;
  const dirMult = hit.direction === 'LONG' ? 1 : -1;

  const stopLoss = +(entryPrice - dirMult * SL_ATR * atrVal).toFixed(digits);
  const target1 = +(entryPrice + dirMult * TP1_ATR * atrVal).toFixed(digits);
  const target2 = +(entryPrice + dirMult * TP2_ATR * atrVal).toFixed(digits);
  const target3 = +(entryPrice + dirMult * TP3_ATR * atrVal).toFixed(digits);

  const atrPct = atrVal / entryPrice;
  const leverage = suggestLeverage(atrPct);

  const backtest = runWalkForwardBacktest(candles, 150);
  const strategyStat = backtest.perStrategy.find(s => s.strategy === hit.name);
  const winProbability = strategyStat?.winRate ?? backtest.overallWinRate;
  const sampleSize = strategyStat?.trades ?? backtest.totalTrades;

  const delta = volumeDelta(candles);
  const rsiSeries = rsi(closes, 14);
  const macdRes = macd(closes);
  const momentum = describeMomentum(hit.direction, rsiSeries[i], macdRes.histogram[i], macdRes.histogram[i - 1]);

  const suppLevel = +(Math.min(...candles.slice(-20).map(c => c.low))).toFixed(digits);
  const resLevel = +(Math.max(...candles.slice(-20).map(c => c.high))).toFixed(digits);

  return {
    id: `SIG-${target.symbol}-${Date.now()}`,
    symbol: target.symbol,
    pair: target.pair,
    type: hit.direction,
    entryPrice,
    target1,
    target2,
    target3,
    stopLoss,
    leverage: leverage.label,
    winProbability: winProbability ?? 0,
    riskReward: `TP1 ${riskRewardLabel(TP1_ATR)} / TP2 ${riskRewardLabel(TP2_ATR)} / TP3 ${riskRewardLabel(TP3_ATR)}`,
    strategy: hit.name as Signal['strategy'],
    status: 'ACTIVE',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timeframe: `${target.interval ?? '5m'}${target.isScalp ? ' Scalp' : ' Intraday'}`,
    rationale: confluenceStrategies.length > 1
      ? `Confluence of ${confluenceStrategies.length} strategies (${confluenceStrategies.join(', ')}): ${hit.reason}`
      : hit.reason,
    isVipOnly: false,
    isScalp: target.isScalp,
    footprintDelta: +delta[i].toFixed(2),
    spoofingWall: undefined,
    liquidityWall: undefined,
    orderBlockZone: `Recent range: $${suppLevel} - $${resLevel}`,
    demandSupplyZone: hit.direction === 'LONG' ? `Support ~$${suppLevel}` : `Resistance ~$${resLevel}`,
    ictPattern: confluenceStrategies.join(' + '),
    momentumStatus: momentum.status as Signal['momentumStatus'],
    backtestSampleSize: sampleSize,
    backtestLabel: winProbability !== null
      ? `Backtested ${winProbability}% over ${sampleSize} historical trades on this pair`
      : `Not enough historical trades yet to report a reliable win rate (${sampleSize} sample)`,
    momentumNote: momentum.note,
  } as Signal;
}

export function describeMomentum(
  direction: 'LONG' | 'SHORT',
  rsiVal: number,
  histNow: number,
  histPrev: number,
): { status: 'HIGH_MOMENTUM_CONTINUATION' | 'MOMENTUM_DEPLETING_SECURE_PROFIT' | 'NEUTRAL'; note: string } {
  const histExpanding = Math.abs(histNow) > Math.abs(histPrev);
  const rsiFavorable = direction === 'LONG' ? rsiVal > 50 && rsiVal < 78 : rsiVal < 50 && rsiVal > 22;
  const rsiExtreme = direction === 'LONG' ? rsiVal >= 78 : rsiVal <= 22;

  if (rsiExtreme) {
    return { status: 'MOMENTUM_DEPLETING_SECURE_PROFIT', note: `RSI at ${rsiVal.toFixed(1)} is stretched -- momentum likely to fade, consider securing partial profit.` };
  }
  if (histExpanding && rsiFavorable) {
    return { status: 'HIGH_MOMENTUM_CONTINUATION', note: `MACD histogram still expanding and RSI (${rsiVal.toFixed(1)}) not overextended -- trend has room to continue.` };
  }
  return { status: 'NEUTRAL', note: `Momentum is mixed (RSI ${rsiVal.toFixed(1)}, histogram ${histExpanding ? 'expanding' : 'flattening'}) -- no strong signal either way.` };
}