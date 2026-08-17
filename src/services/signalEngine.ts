import { Signal, CandleData } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr, volumeDelta, rsi, macd } from './indicators';
import { runWalkForwardBacktest } from './backtestEngine';
import { SL_ATR, TP1_ATR, TP2_ATR, TP3_ATR, riskRewardLabel, suggestLeverage } from './riskConfig';
import { fetchKlines, fetchTopCryptos } from './binanceApi';

export interface ScanTarget { symbol: string; pair: string; interval?: string; isScalp?: boolean; }

// Fixed macro instruments that are always scanned regardless of the crypto
// universe below: gold, silver, and the 3 majors. XAU/XAG/forex candles are
// synthetic (see binanceApi.ts) -- everything else here is real Binance data.
export const MACRO_SCAN_WATCHLIST: ScanTarget[] = [
  { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', interval: '5m', isScalp: true },
  { symbol: 'XAGUSDT', pair: 'XAG/USD (SILVER SPOT)', interval: '5m', isScalp: true },
  { symbol: 'EURUSD', pair: 'EUR/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'GBPUSD', pair: 'GBP/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'USDJPY', pair: 'USD/JPY (FOREX)', interval: '15m', isScalp: false },
];

// Used as a fallback (and as the default export for anything that still
// imports DEFAULT_SCAN_WATCHLIST directly) before the dynamic top-volume
// list has loaded for the first time.
export const DEFAULT_SCAN_WATCHLIST: ScanTarget[] = [
  { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'BNBUSDT', pair: 'BNB/USDT (PERP)', interval: '15m', isScalp: false },
  { symbol: 'XRPUSDT', pair: 'XRP/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'SUIUSDT', pair: 'SUI/USDT (PERP)', interval: '5m', isScalp: true },
  { symbol: 'NEARUSDT', pair: 'NEAR/USDT (PERP)', interval: '15m', isScalp: false },
  { symbol: 'AVAXUSDT', pair: 'AVAX/USDT (PERP)', interval: '15m', isScalp: false },
  ...MACRO_SCAN_WATCHLIST,
];

let cachedDynamicWatchlist: ScanTarget[] | null = null;
let cachedDynamicWatchlistAt = 0;
const DYNAMIC_LIST_TTL_MS = 5 * 60 * 1000; // refresh top-volume ranking every 5 min

/**
 * Builds the real scan universe: the top `topN` USDT perpetuals by 24h quote
 * volume (refreshed from live Binance data every 5 minutes) plus the fixed
 * macro instruments (gold, silver, EUR/USD, GBP/USD, USD/JPY). This is what
 * "scan all coins" resolves to in practice -- Binance Futures lists ~400-500
 * USDT pairs total, and fetching full 200-candle history for all of them
 * every single minute would blow through public rate limits and take far
 * longer than the 60s cycle. `topN` defaults to 60, which comfortably
 * finishes a full pass (with concurrency, see below) inside the 60s window.
 */
export async function buildDynamicWatchlist(topN = 60): Promise<ScanTarget[]> {
  const now = Date.now();
  if (cachedDynamicWatchlist && now - cachedDynamicWatchlistAt < DYNAMIC_LIST_TTL_MS) {
    return cachedDynamicWatchlist;
  }

  try {
    const tickers = await fetchTopCryptos();
    const cryptoOnly = tickers.filter(t => t.isFutures);
    const top = cryptoOnly
      .slice()
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, topN)
      .map((t): ScanTarget => ({
        symbol: t.symbol,
        pair: t.pair,
        interval: '5m',
        isScalp: true,
      }));

    const list = top.length > 0 ? [...top, ...MACRO_SCAN_WATCHLIST] : DEFAULT_SCAN_WATCHLIST;
    cachedDynamicWatchlist = list;
    cachedDynamicWatchlistAt = now;
    return list;
  } catch (e) {
    console.error('[buildDynamicWatchlist] failed, falling back to static list:', e);
    return DEFAULT_SCAN_WATCHLIST;
  }
}

const SCAN_CONCURRENCY = 8;

/**
 * Scans a watchlist against REAL candle data and REAL strategy math.
 * A signal only comes back for a symbol when one of the 21 strategies
 * actually triggered on the latest closed candle. If nothing triggers
 * anywhere, this correctly returns an empty array -- it will not invent a
 * signal just to have something to show.
 *
 * Symbols are fetched with a small concurrency pool (not fully sequential,
 * not all-at-once) so a 60+ symbol watchlist still finishes well inside a
 * 60-second scan cycle without hammering the Binance API.
 */
export async function scanMarketForSignals(watchlist?: ScanTarget[]): Promise<Signal[]> {
  const targets = watchlist ?? await buildDynamicWatchlist();
  const signals: Signal[] = [];

  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
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
  };

  await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, targets.length) }, worker));

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