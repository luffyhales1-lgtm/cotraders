import { Signal, CandleData, MarketOverview } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr, volumeDelta, rsi, macd, detectRsiDivergence } from './indicators';
import { runWalkForwardBacktest } from './backtestEngine';
import { SL_ATR, TP1_ATR, TP2_ATR, TP3_ATR, riskRewardLabel, suggestLeverage, suggestPositionSize } from './riskConfig';
import { fetchKlines, fetchTopCryptos } from './binanceApi';

export interface ScanTarget { symbol: string; pair: string; interval?: string; isScalp?: boolean; }

// Fixed macro instruments that are always scanned regardless of the crypto
// universe below: the forex majors. Binance does not list FX pairs, so these
// stay synthetic (see binanceApi.ts SYNTHETIC_SYMBOLS). Gold (XAUUSDT) and
// silver (XAGUSDT) are REAL Binance perpetuals now and are picked up
// automatically by buildDynamicWatchlist() below along with every other real
// pair -- they're intentionally not hardcoded here anymore.
export const MACRO_SCAN_WATCHLIST: ScanTarget[] = [
  { symbol: 'EURUSD', pair: 'EUR/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'GBPUSD', pair: 'GBP/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'USDJPY', pair: 'USD/JPY (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'AUDUSD', pair: 'AUD/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'USDCAD', pair: 'USD/CAD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'USDCHF', pair: 'USD/CHF (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'NZDUSD', pair: 'NZD/USD (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'EURJPY', pair: 'EUR/JPY (FOREX)', interval: '15m', isScalp: false },
  { symbol: 'GBPJPY', pair: 'GBP/JPY (FOREX)', interval: '15m', isScalp: false },
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
  { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD PERP)', interval: '5m', isScalp: true },
  { symbol: 'XAGUSDT', pair: 'XAG/USD (SILVER PERP)', interval: '5m', isScalp: true },
  ...MACRO_SCAN_WATCHLIST,
];

let cachedDynamicWatchlist: ScanTarget[] | null = null;
let cachedDynamicWatchlistAt = 0;
const DYNAMIC_LIST_TTL_MS = 5 * 60 * 1000; // refresh top-volume ranking every 5 min

/**
 * Builds the real scan universe: the top `topN` USDT perpetuals by 24h quote
 * volume (refreshed from live Binance data every 5 minutes -- this includes
 * XAUUSDT/XAGUSDT automatically, since they're real perpetuals) plus the
 * fixed forex majors (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF,
 * NZD/USD, EUR/JPY, GBP/JPY, which Binance doesn't list).
 *
 * Binance Futures currently lists ~500-800 USDT-margined perpetuals total
 * (that's the real ceiling on the exchange itself, not a limit this app
 * imposes -- there is no exchange with "2000" liquid perps). `topN` defaults
 * to 500 so we capture effectively the ENTIRE liquid universe. We don't fetch
 * full history for all 500 every single minute (that would blow public rate
 * limits); instead getScanBatch() rotates through them -- see below.
 */
export async function buildDynamicWatchlist(topN = 500): Promise<ScanTarget[]> {
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
        interval: '1m',
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

// How many top-volume pairs are ALWAYS scanned every single cycle (the pairs
// that matter most for signal quality), regardless of rotation.
const CORE_ALWAYS_SCAN = 80;
// How many additional rotating pairs we pull from the deeper universe each
// cycle. CORE + ROTATING is the per-minute batch size -- bounded so a full
// pass finishes inside the 60s window and stays under Binance rate limits.
const ROTATING_BATCH = 140;
let rotationCursor = 0;

/**
 * Returns the batch to scan THIS cycle: the top `CORE_ALWAYS_SCAN` pairs by
 * volume (always) + a rotating window of `ROTATING_BATCH` pairs from the rest
 * of the universe + all forex majors + gold/silver (guaranteed present). The
 * rotation cursor advances every call, so across a handful of 1-minute cycles
 * the ENTIRE ~500-pair universe gets covered -- "scan the whole market" --
 * without hammering the API in any single minute.
 */
export async function getScanBatch(): Promise<ScanTarget[]> {
  const full = await buildDynamicWatchlist();
  if (full.length <= CORE_ALWAYS_SCAN + ROTATING_BATCH) return full;

  // Separate forex majors (must always be included) from the crypto ranking.
  const forex = full.filter(t => MACRO_SCAN_WATCHLIST.some(m => m.symbol === t.symbol));
  const crypto = full.filter(t => !MACRO_SCAN_WATCHLIST.some(m => m.symbol === t.symbol));

  const core = crypto.slice(0, CORE_ALWAYS_SCAN);
  const rest = crypto.slice(CORE_ALWAYS_SCAN);

  const batch: ScanTarget[] = [...core];
  if (rest.length > 0) {
    for (let n = 0; n < ROTATING_BATCH; n++) {
      batch.push(rest[(rotationCursor + n) % rest.length]);
    }
    rotationCursor = (rotationCursor + ROTATING_BATCH) % rest.length;
  }

  // Guarantee gold + silver are always evaluated even if they fell in "rest".
  for (const metal of ['XAUUSDT', 'XAGUSDT']) {
    if (!batch.some(t => t.symbol === metal)) {
      const found = crypto.find(t => t.symbol === metal);
      if (found) batch.push(found);
    }
  }

  // Dedupe by symbol (the rotating window can wrap and overlap the core) so we
  // never scan the same pair twice or emit a duplicate signal in one cycle.
  const combined = [...batch, ...forex];
  const seen = new Set<string>();
  return combined.filter(t => (seen.has(t.symbol) ? false : (seen.add(t.symbol), true)));
}

const SCAN_CONCURRENCY = 20;

/**
 * Scans a watchlist against REAL candle data and REAL strategy math.
 * A signal only comes back for a symbol when one of the 21 strategies
 * actually triggered on the latest closed candle. If nothing triggers
 * anywhere, this correctly returns an empty array -- it will not invent a
 * signal just to have something to show.
 *
 * When called with no argument it pulls a rotating batch (getScanBatch) so
 * that over successive 1-minute cycles the whole ~500-pair universe + forex
 * + gold/silver is covered. Symbols are fetched with a concurrency pool so a
 * 200+ symbol batch still finishes well inside a 60-second scan cycle without
 * hammering the Binance API. Results come back sorted best-first (highest
 * confluence + win-probability), so the top signals surface immediately.
 */
export async function scanMarketForSignals(watchlist?: ScanTarget[]): Promise<Signal[]> {
  const targets = watchlist ?? await getScanBatch();
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

  // Best-first: strongest confluence + conviction at the top.
  signals.sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));

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
  const rsiVal = rsiSeries[i];
  const macdRes = macd(closes);
  const momentum = describeMomentum(hit.direction, rsiVal, macdRes.histogram[i], macdRes.histogram[i - 1]);
  const divergence = detectRsiDivergence(candles, rsiSeries);

  const suppLevel = +(Math.min(...candles.slice(-20).map(c => c.low))).toFixed(digits);
  const resLevel = +(Math.max(...candles.slice(-20).map(c => c.high))).toFixed(digits);

  // Composite conviction score (0-100) built from REAL inputs: measured win
  // probability, how many strategies agreed, momentum state, and whether RSI
  // divergence confirms or contradicts the trade direction.
  const confluenceCount = confluenceStrategies.length;
  let confidence = winProbability ?? 55;
  confidence += Math.min(15, Math.max(0, (confluenceCount - 1) * 5)); // confluence bonus
  if (momentum.status === 'HIGH_MOMENTUM_CONTINUATION') confidence += 10;
  else if (momentum.status === 'MOMENTUM_DEPLETING_SECURE_PROFIT') confidence -= 6;
  if (divergence && ((divergence === 'bullish' && hit.direction === 'LONG') || (divergence === 'bearish' && hit.direction === 'SHORT'))) {
    confidence += 8; // divergence confirms the trade
  } else if (divergence && ((divergence === 'bullish' && hit.direction === 'SHORT') || (divergence === 'bearish' && hit.direction === 'LONG'))) {
    confidence -= 8; // divergence contradicts the trade
  }
  const confidenceScore = Math.round(Math.min(98, Math.max(30, confidence)));

  const position = suggestPositionSize(atrPct, leverage.max, confidenceScore);
  const assetClass = classifyAsset(target.symbol);

  const rsiDivergenceNote = divergence
    ? ` | RSI divergence: ${divergence.toUpperCase()} (${divergence === (hit.direction === 'LONG' ? 'bullish' : 'bearish') ? 'confirms' : 'caution'})`
    : ` | RSI ${rsiVal?.toFixed(1)} (no divergence)`;

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
    rationale: (confluenceStrategies.length > 1
      ? `Confluence of ${confluenceStrategies.length} strategies (${confluenceStrategies.join(', ')}): ${hit.reason}`
      : hit.reason) + rsiDivergenceNote,
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
    // enriched analysis fields
    rsiValue: rsiVal != null && !isNaN(rsiVal) ? +rsiVal.toFixed(1) : undefined,
    rsiDivergence: divergence,
    atrPercent: +(atrPct * 100).toFixed(2),
    supportLevel: suppLevel,
    resistanceLevel: resLevel,
    positionSizeNote: position.note,
    riskPerTradePct: position.riskPct,
    confidenceScore,
    confluenceCount,
    assetClass,
  } as Signal;
}

// Maps a scan symbol to a human asset class for display + bot formatting.
function classifyAsset(symbol: string): 'CRYPTO' | 'GOLD' | 'SILVER' | 'FOREX' {
  if (symbol === 'XAUUSDT') return 'GOLD';
  if (symbol === 'XAGUSDT') return 'SILVER';
  if (MACRO_SCAN_WATCHLIST.some(m => m.symbol === symbol)) return 'FOREX';
  return 'CRYPTO';
}

/**
 * Whole-market breadth analysis for the dashboard "Analyze Whole Market"
 * panel. Given the fresh signals from a scan (and how many symbols were
 * scanned), it computes the market's net directional bias, average RSI and
 * conviction, and which strategies are firing most -- a genuine top-down read,
 * not a canned summary.
 */
export function analyzeMarketOverview(signals: Signal[], scannedCount: number): MarketOverview {
  const longCount = signals.filter(s => s.type === 'LONG').length;
  const shortCount = signals.filter(s => s.type === 'SHORT').length;
  const total = longCount + shortCount;

  const net = longCount - shortCount;
  const biasStrengthPct = total > 0 ? Math.round((Math.abs(net) / total) * 100) : 0;
  const bias: MarketOverview['bias'] =
    total === 0 || Math.abs(net) < Math.max(1, total * 0.1) ? 'NEUTRAL' : net > 0 ? 'BULLISH' : 'BEARISH';

  const rsiVals = signals.map(s => s.rsiValue).filter((v): v is number => typeof v === 'number');
  const avgRsi = rsiVals.length ? +(rsiVals.reduce((a, b) => a + b, 0) / rsiVals.length).toFixed(1) : null;

  const confVals = signals.map(s => s.confidenceScore).filter((v): v is number => typeof v === 'number');
  const avgConfidence = confVals.length ? Math.round(confVals.reduce((a, b) => a + b, 0) / confVals.length) : null;

  const stratCounts = new Map<string, number>();
  for (const s of signals) {
    stratCounts.set(s.strategy, (stratCounts.get(s.strategy) ?? 0) + 1);
  }
  const topStrategies = Array.from(stratCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const strongest = signals
    .slice()
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
    .slice(0, 6);

  const btc = signals.find(s => s.symbol === 'BTCUSDT');
  const btcTrend = btc ? `${btc.type} bias (RSI ${btc.rsiValue ?? '--'}, ${btc.momentumStatus ?? 'NEUTRAL'})` : undefined;

  return {
    scannedCount,
    signalCount: signals.length,
    longCount,
    shortCount,
    bias,
    biasStrengthPct,
    avgRsi,
    avgConfidence,
    topStrategies,
    strongest,
    btcTrend,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
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