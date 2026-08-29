import { Signal, CandleData, MarketOverview, TradeMode, SignalAnalysis, StrategyRead, TimeframeCheck, LiquidityCheck, GateCheck } from '@/types/trading';
import { evaluateAllStrategies } from './strategies';
import { atr, volumeDelta, rsi, macd, ema, detectRsiDivergence } from './indicators';
import { runWalkForwardBacktest } from './backtestEngine';
import {
  MIN_CONFLUENCE, MIN_CONFIDENCE_TO_EMIT, MIN_BACKTEST_WINRATE, MIN_RR,
  MAX_MTF_CONFLICTS, MAX_ADVERSE_BOOK_RATIO, MIN_QUOTE_VOLUME_24H,
  riskRewardLabel, suggestLeverage, suggestPositionSize,
  profileForAsset, scaleToMinReward, RiskProfile, nextTimeframeUp,
} from './riskConfig';
import { fetchKlines, fetchOrderBook, fetchTopCryptos } from './binanceApi';
import { FOREX_MAJORS } from './forexApi';

export interface ScanTarget {
  symbol: string;
  pair: string;
  interval?: string;
  isScalp?: boolean;
  /** SCALP (fast intraday) or SWING (multi-day). Defaults to SCALP. */
  mode?: TradeMode;
}

// Real forex majors (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF,
// NZD/USD, EUR/JPY, GBP/JPY). Binance lists no FX pairs, so these are pulled
// live from a free forex API (Yahoo chart) via forexApi/fetchKlines — the SAME
// strategy engine then runs on genuine FX candles. They're always included in
// every scan cycle (see getScanBatch) and classified as FOREX.
export const MACRO_SCAN_WATCHLIST: ScanTarget[] = FOREX_MAJORS.map(f => ({
  symbol: f.symbol,
  pair: f.pair,
  interval: '15m',
  isScalp: false,
  mode: 'SCALP' as TradeMode,
}));

// Used as a fallback (and as the default export for anything that still
// imports DEFAULT_SCAN_WATCHLIST directly) before the dynamic top-volume
// list has loaded for the first time.
export const DEFAULT_SCAN_WATCHLIST: ScanTarget[] = [
  { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'BNBUSDT', pair: 'BNB/USDT (PERP)', interval: '15m', isScalp: false, mode: 'SCALP' },
  { symbol: 'XRPUSDT', pair: 'XRP/USDT (PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'SUIUSDT', pair: 'SUI/USDT (PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'NEARUSDT', pair: 'NEAR/USDT (PERP)', interval: '15m', isScalp: false, mode: 'SCALP' },
  { symbol: 'AVAXUSDT', pair: 'AVAX/USDT (PERP)', interval: '15m', isScalp: false, mode: 'SCALP' },
  { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  { symbol: 'XAGUSDT', pair: 'XAG/USD (SILVER PERP)', interval: '15m', isScalp: true, mode: 'SCALP' },
  // Swing counterparts on the 4h chart — wider stops, targets with room to run.
  { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', interval: '4h', isScalp: false, mode: 'SWING' },
  { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', interval: '4h', isScalp: false, mode: 'SWING' },
  { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', interval: '4h', isScalp: false, mode: 'SWING' },
  ...MACRO_SCAN_WATCHLIST,
];

let cachedDynamicWatchlist: ScanTarget[] | null = null;
let cachedDynamicWatchlistAt = 0;
const DYNAMIC_LIST_TTL_MS = 5 * 60 * 1000; // refresh top-volume ranking every 5 min

// Live 24h quote volume per symbol, captured while building the watchlist. Used
// by the liquidity gate so we never issue a signal on an illiquid market.
const quoteVolumeBySymbol = new Map<string, number>();
export function getQuoteVolume(symbol: string): number | null {
  return quoteVolumeBySymbol.has(symbol) ? (quoteVolumeBySymbol.get(symbol) as number) : null;
}

// How many of the top-volume pairs also get a SWING (4h) scan each cycle. Swing
// setups are rarer and slower-moving, so covering the most liquid names is
// enough — and it keeps the per-cycle request count bounded.
const SWING_UNIVERSE = 40;

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
    for (const t of tickers) quoteVolumeBySymbol.set(t.symbol, t.volume24h ?? 0);

    const ranked = cryptoOnly
      .slice()
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, topN);

    // SCALP targets on the 15-minute chart, matching SCALP_PROFILE.interval.
    // 1m and 5m were both deliberately dropped: their ATR is so small that
    // targets landed inside the spread ("price 45, TP 46") and the 1.1% minimum
    // was mathematically unreachable, so every scalp got rejected outright.
    const scalp = ranked.map((t): ScanTarget => ({
      symbol: t.symbol,
      pair: t.pair,
      interval: '15m',
      isScalp: true,
      mode: 'SCALP',
    }));

    // SWING targets on the 4-hour chart for the most liquid names, so the site
    // issues real position trades alongside the scalps instead of only scalps.
    const swing = ranked.slice(0, SWING_UNIVERSE).map((t): ScanTarget => ({
      symbol: t.symbol,
      pair: t.pair,
      interval: '4h',
      isScalp: false,
      mode: 'SWING',
    }));

    const list = scalp.length > 0
      ? [...scalp, ...swing, ...MACRO_SCAN_WATCHLIST]
      : DEFAULT_SCAN_WATCHLIST;
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
const CORE_ALWAYS_SCAN = 45;
// How many additional rotating pairs we pull from the deeper universe each
// cycle. CORE + ROTATING is the per-minute batch size -- kept modest so a full
// pass finishes quickly, stays under Binance rate limits, and doesn't pin the
// browser main thread with strategy math.
const ROTATING_BATCH = 80;
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

// Each qualified candidate now also fetches its higher timeframes + order book,
// so concurrency is trimmed to stay inside Binance's rate limits.
const SCAN_CONCURRENCY = 12;

// Shared in-flight batch scan. Several timers can fire near-simultaneously
// (the 60s auto-scanner, the 5-min AI Signals refresh, the dashboard loader).
// Without this guard each would kick off its own full ~125-symbol scan and
// pile strategy math onto the main thread, which is a major source of lag.
// When a batch scan (no explicit watchlist) is already running, callers share
// its promise instead of starting another.
let batchScanInFlight: Promise<Signal[]> | null = null;

export async function scanMarketForSignals(watchlist?: ScanTarget[]): Promise<Signal[]> {
  if (!watchlist && batchScanInFlight) return batchScanInFlight;

  const run = runScan(watchlist);

  if (!watchlist) {
    batchScanInFlight = run;
    try {
      return await run;
    } finally {
      batchScanInFlight = null;
    }
  }
  return run;
}

async function runScan(watchlist?: ScanTarget[]): Promise<Signal[]> {
  const targets = watchlist ?? await getScanBatch();
  const signals: Signal[] = [];

  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      try {
        const mode: TradeMode = target.mode ?? (target.isScalp === false ? 'SWING' : 'SCALP');
        const profile = profileForAsset(mode, classifyAsset(target.symbol));
        const candles = await fetchKlines(target.symbol, target.interval ?? profile.interval, 300);
        if (candles.length < 60) continue;

        const results = evaluateAllStrategies(candles);
        const triggered = results.filter(r => r.triggered && r.direction);
        if (triggered.length === 0) continue;

        // Consensus direction: let the MAJORITY of triggered strategies vote on
        // direction instead of blindly taking the first fire (which was often a
        // lone counter-trend reversal). If longs and shorts are evenly split the
        // read is ambiguous — skip it entirely rather than force a coin-flip trade.
        const longVotes = triggered.filter(r => r.direction === 'LONG').length;
        const shortVotes = triggered.filter(r => r.direction === 'SHORT').length;
        const netDir: 'LONG' | 'SHORT' | null =
          longVotes > shortVotes ? 'LONG' : shortVotes > longVotes ? 'SHORT' : null;
        if (!netDir) continue;

        const agreeing = triggered.filter(r => r.direction === netDir);
        // Cheap pre-gate: don't spend higher-timeframe + order-book requests on a
        // setup that can't clear the confluence bar anyway. Keeps us well inside
        // Binance rate limits while still deep-verifying every real candidate.
        if (agreeing.length < MIN_CONFLUENCE) continue;

        // Headline the setup with a continuation strategy (TREND/BREAKOUT) over a
        // pure reversal when available, so the labelled trade matches the bias.
        const catRank = (c?: string) => (c === 'TREND' ? 0 : c === 'BREAKOUT' ? 1 : c === 'ICT/SMC' ? 2 : 3);
        const ordered = agreeing.slice().sort((a, b) => catRank((a as { category?: string }).category) - catRank((b as { category?: string }).category));
        const best = ordered[0];

        // FULL audit trail of every strategy, fired or not — this is what the
        // Analysis Video narrates and what proves the signal was analyzed.
        const strategyReads: StrategyRead[] = results.map(r => ({
          name: r.name,
          category: r.category,
          triggered: r.triggered,
          direction: r.direction,
          reason: r.reason,
        }));

        // DEEP pass: higher-timeframe confirmation + live order-book liquidity.
        const deep = await runDeepAnalysis(target, netDir, profile, strategyReads);

        // The hard quality gate lives inside buildSignalFromStrategyHit(): it
        // returns null unless the setup clears confluence + trend + momentum +
        // reward:risk + multi-timeframe + liquidity + conviction, so EVERY
        // signal-emitting surface on the site inherits the same
        // "analyze, then trade" bar from this one choke point.
        const signal = buildSignalFromStrategyHit(target, candles, best, agreeing.map(a => a.name), { deep });
        if (signal) signals.push(signal);
      } catch (e) {
        console.error(`[scanMarketForSignals] ${target.symbol} failed:`, e);
      }
      // Yield to the event loop between symbols. Several fetches can resolve in
      // the same tick, which would otherwise run their (synchronous) strategy
      // math back-to-back and stall a paint frame; this hands the browser a
      // window to render, keeping the UI smooth during a live scan. Network I/O
      // dominates wall-clock, so this adds no meaningful scan latency.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };

  await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, targets.length) }, worker));

  // Best-first: strongest confluence + conviction at the top.
  signals.sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));

  return signals;
}

/**
 * Reads the directional bias of a candle set the same way on every timeframe:
 * EMA50 vs EMA200 (or the longest available), plus where price sits relative to
 * the slow EMA. Used for higher-timeframe confirmation.
 */
function readTrend(candles: CandleData[]): { trend: 'UP' | 'DOWN' | 'FLAT'; rsi: number | null; note: string } {
  if (candles.length < 30) return { trend: 'FLAT', rsi: null, note: 'not enough candles to read this timeframe' };
  const closes = candles.map(c => c.close);
  const j = closes.length - 1;
  const fast = ema(closes, Math.min(50, closes.length - 1))[j];
  const slow = ema(closes, closes.length >= 200 ? 200 : Math.min(100, closes.length - 1))[j];
  const r = rsi(closes, 14)[j];
  const price = closes[j];
  const spreadPct = slow ? Math.abs((fast - slow) / slow) * 100 : 0;
  // A near-identical fast/slow EMA is a range, not a trend — say so instead of
  // forcing a direction the chart doesn't actually have.
  if (spreadPct < 0.05) return { trend: 'FLAT', rsi: r ?? null, note: `EMAs flat (${spreadPct.toFixed(3)}% apart) — ranging` };
  const trend: 'UP' | 'DOWN' = fast > slow && price > slow ? 'UP' : fast < slow && price < slow ? 'DOWN' : (fast > slow ? 'UP' : 'DOWN');
  return {
    trend,
    rsi: r ?? null,
    note: `EMA${Math.min(50, closes.length - 1)} ${fast > slow ? 'above' : 'below'} slow EMA, price ${price > slow ? 'above' : 'below'} it, RSI ${r != null ? r.toFixed(1) : '--'}`,
  };
}

/**
 * The DEEP analysis pass: fetches every higher timeframe in the profile and the
 * LIVE order book, so a signal is only issued once the direction is confirmed
 * across timeframes and the market is actually liquid enough to trade. All data
 * is fetched fresh at signal time — nothing stored or replayed.
 */
export async function runDeepAnalysis(
  target: ScanTarget,
  direction: 'LONG' | 'SHORT',
  profile: RiskProfile,
  strategyReads: StrategyRead[],
): Promise<DeepContext> {
  const wanted = direction === 'LONG' ? 'UP' : 'DOWN';

  const timeframeChecks: TimeframeCheck[] = [];
  for (const tf of profile.confirmTimeframes) {
    try {
      const c = await fetchKlines(target.symbol, tf, 220);
      const read = readTrend(c);
      timeframeChecks.push({
        timeframe: tf,
        trend: read.trend,
        rsi: read.rsi != null ? +read.rsi.toFixed(1) : null,
        // A FLAT higher timeframe is not a conflict — it simply isn't fighting
        // the trade. Only an opposing trend counts against it.
        agrees: read.trend === wanted || read.trend === 'FLAT',
        note: read.note,
      });
    } catch (e) {
      console.error(`[runDeepAnalysis] ${target.symbol} ${tf} failed:`, e);
    }
  }

  let liquidity: LiquidityCheck | null = null;
  try {
    const book = await fetchOrderBook(target.symbol);
    const bidDepth = book.bids.reduce((a, b) => a + b.amount, 0);
    const askDepth = book.asks.reduce((a, b) => a + b.amount, 0);
    const bestBid = book.bids[0]?.price ?? 0;
    const bestAsk = book.asks[0]?.price ?? 0;
    const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
    const spreadPct = mid ? +(((bestAsk - bestBid) / mid) * 100).toFixed(4) : null;
    const imbalance = askDepth > 0 ? +(bidDepth / askDepth).toFixed(2) : 0;
    const quoteVolume24h = getQuoteVolume(target.symbol);

    // "Adverse" = the book is stacked on the side that would run the trade over.
    const adverse = direction === 'LONG'
      ? (bidDepth > 0 ? askDepth / bidDepth : Infinity)
      : (askDepth > 0 ? bidDepth / askDepth : Infinity);

    const allLevels = [...book.bids, ...book.asks];
    const biggest = allLevels.slice().sort((a, b) => b.amount - a.amount)[0];
    const wall = biggest ? `Largest resting wall $${biggest.price} (${biggest.amount.toLocaleString()})` : null;

    const volumeOk = quoteVolume24h === null || quoteVolume24h >= MIN_QUOTE_VOLUME_24H;
    const bookOk = adverse <= MAX_ADVERSE_BOOK_RATIO;
    const passed = volumeOk && bookOk;

    liquidity = {
      bidDepth: +bidDepth.toFixed(2),
      askDepth: +askDepth.toFixed(2),
      imbalance,
      spreadPct,
      quoteVolume24h,
      wall,
      passed,
      note: `Book bid/ask depth ${bidDepth.toFixed(0)}/${askDepth.toFixed(0)} (imbalance ${imbalance}), spread ${spreadPct ?? '--'}%` +
        `, 24h volume ${quoteVolume24h !== null ? `$${Math.round(quoteVolume24h).toLocaleString()}` : 'unknown'}` +
        ` — ${passed ? 'liquid enough and book not stacked against the trade' : !volumeOk ? 'below the minimum 24h volume to trade safely' : `book stacked against the trade (${adverse.toFixed(2)}x, max ${MAX_ADVERSE_BOOK_RATIO}x)`}`,
    };
  } catch (e) {
    console.error(`[runDeepAnalysis] order book ${target.symbol} failed:`, e);
  }

  return { timeframeChecks, liquidity, strategyReads };
}

/**
 * Everything the deep (async) analysis pass discovered, handed to the signal
 * builder so the gate can use it and the audit trail can report it. Built by
 * runDeepAnalysis() from LIVE data at signal time — never stored/old data.
 */
export interface DeepContext {
  timeframeChecks: TimeframeCheck[];
  liquidity: LiquidityCheck | null;
  /** Every strategy's read, triggered or not — the full 21-strategy audit. */
  strategyReads?: StrategyRead[];
}

export function buildSignalFromStrategyHit(
  target: ScanTarget,
  candles: CandleData[],
  hit: { name: string; direction: 'LONG' | 'SHORT' | null; reason: string },
  confluenceStrategies: string[],
  opts: { gate?: boolean; deep?: DeepContext } = {},
): Signal | null {
  if (!hit.direction) return null;

  const i = candles.length - 1;
  const closes = candles.map(c => c.close);
  const atrSeries = atr(candles, 14);
  const atrVal = atrSeries[i];
  if (!atrVal || isNaN(atrVal)) return null;

  const entryPrice = closes[i];
  const digits = entryPrice < 1 ? 6 : entryPrice < 10 ? 4 : 2;

  const assetClass = classifyAsset(target.symbol);
  const mode: TradeMode = target.mode ?? (target.isScalp === false ? 'SWING' : 'SCALP');
  const profile: RiskProfile = profileForAsset(mode, assetClass);

  // Levels come from the shared risk model, which guarantees TP1 is BOTH far
  // enough away in percentage terms to be worth trading after fees AND farther
  // from entry than the stop (>= MIN_RR). If the market is too quiet or too
  // wild to build such a structure, it returns null and we refuse to signal —
  // that is the fix for "price is 45 and it gives TP 46".
  const levels = scaleToMinReward(entryPrice, atrVal, hit.direction, profile, digits);
  if (!levels) return null;
  const { stopLoss, target1, target2, target3 } = levels;

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

  // ----------------------------------------------------------------------
  // QUALIFICATION GATE — "analyze, THEN trade". A raw trigger is not enough;
  // the setup must be confirmed on four independent axes before it can become
  // a tradable signal. Anything that fails is dropped (returns null) so it
  // never reaches the journal, scanners or bot. This is the ONE choke point
  // every signal surface on the site shares. Research tools (the Custom
  // Scanner Sandbox) pass { gate: false } to inspect raw single-strategy reads.
  // ----------------------------------------------------------------------
  const enforceGate = opts.gate !== false;
  const gateChecks: GateCheck[] = [];
  const deep = opts.deep;
  const mtfConflicts = (deep?.timeframeChecks ?? []).filter(t => !t.agrees);

  // Every check is RECORDED (pass or fail) so the Analysis Video and the signal
  // card can show exactly what was verified and why a setup was refused.
  const record = (label: string, passed: boolean, detail: string) => {
    gateChecks.push({ label, passed, detail });
    return passed;
  };

  const ema50Arr = ema(closes, 50);
  const ema200Arr = closes.length >= 200 ? ema(closes, 200) : ema(closes, Math.min(50, closes.length - 1));
  const ema50v = ema50Arr[i];
  const ema200v = ema200Arr[i];
  const regimeUp = ema50v > ema200v;
  const regimeDown = ema50v < ema200v;
  const priceAbove200 = entryPrice > ema200v;
  const macdHist = macdRes.histogram[i];

  // 1) Confluence — at least MIN_CONFLUENCE independent strategies must agree.
  record(
    'Strategy confluence',
    confluenceCount >= MIN_CONFLUENCE,
    `${confluenceCount} of 21 strategies agree on ${hit.direction} (minimum ${MIN_CONFLUENCE})`,
  );

  // 2) Trend regime — never fight a clearly-established trend. This blocks the
  //    counter-trend knife-catches that were the main source of losing trades.
  const trendOk = hit.direction === 'LONG'
    ? !(regimeDown && !priceAbove200)
    : !(regimeUp && priceAbove200);
  record(
    'Trend regime (EMA50/EMA200)',
    trendOk,
    `EMA50 ${ema50v?.toFixed(digits)} vs EMA200 ${ema200v?.toFixed(digits)} — regime ${regimeUp ? 'bullish' : regimeDown ? 'bearish' : 'flat'}; trade is ${trendOk ? 'with' : 'against'} it`,
  );

  // 3) Momentum confirmation — RSI/MACD must not contradict the trade, and at
  //    least one of them must actively support the direction.
  const rsiSupportsLong = rsiVal >= 48;
  const rsiSupportsShort = rsiVal <= 52;
  const macdSupportsLong = macdHist > 0;
  const macdSupportsShort = macdHist < 0;
  const momentumOk = hit.direction === 'LONG'
    ? rsiVal >= 38 && (rsiSupportsLong || macdSupportsLong)
    : rsiVal <= 62 && (rsiSupportsShort || macdSupportsShort);
  record(
    'Momentum (RSI + MACD)',
    momentumOk,
    `RSI ${rsiVal?.toFixed(1)}, MACD histogram ${macdHist?.toFixed(6)} — ${momentumOk ? 'supports' : 'does not support'} ${hit.direction}`,
  );

  // 4) Reward:risk and target distance — the structure must actually be worth
  //    taking after fees. This is the check that kills "TP one tick away".
  record(
    'Reward:risk & target distance',
    levels.rr >= MIN_RR && levels.tp1Pct >= profile.minTp1Pct,
    `TP1 ${levels.tp1Pct}% away, stop ${levels.slPct}% away → 1:${levels.rr} (floor ${profile.minTp1Pct}% / 1:${MIN_RR})${levels.widened ? ' · levels scaled up to clear the floor, ratio unchanged' : ''}`,
  );

  // 5) Multi-timeframe verification — every higher timeframe checked must agree.
  record(
    'Multi-timeframe confirmation',
    deep ? mtfConflicts.length <= MAX_MTF_CONFLICTS : true,
    deep
      ? (deep.timeframeChecks.length
          ? deep.timeframeChecks.map(t => `${t.timeframe}: ${t.trend}${t.agrees ? ' ✓' : ' ✗'}`).join(' · ')
          : 'no higher-timeframe data available')
      : 'not requested for this run (base-timeframe read only)',
  );

  // 6) Live liquidity — order book must not be stacked against the trade and the
  //    market must be liquid enough to fill at these levels.
  record(
    'Market liquidity (live order book)',
    deep?.liquidity ? deep.liquidity.passed : true,
    deep?.liquidity ? deep.liquidity.note : 'not requested for this run',
  );

  // 7) Proven-loser guard — if we DO have a reliable historical win rate for
  //    this strategy on this pair, it must clear break-even + a safety margin.
  record(
    'Historical win rate',
    winProbability === null || winProbability >= MIN_BACKTEST_WINRATE,
    winProbability !== null
      ? `${winProbability}% over ${sampleSize} walk-forward trades (floor ${MIN_BACKTEST_WINRATE}%)`
      : `not enough resolved trades yet (${sampleSize}) — reported honestly rather than guessed`,
  );

  // 8) Conviction floor — only genuinely high-quality composite setups issue.
  record(
    'Composite conviction',
    confidenceScore >= MIN_CONFIDENCE_TO_EMIT,
    `${confidenceScore}/100 (floor ${MIN_CONFIDENCE_TO_EMIT})`,
  );

  const failed = gateChecks.find(c => !c.passed);
  if (enforceGate && failed) return null;

  // Position size uses the REAL stop distance (not a generic ATR proxy), so the
  // suggested size actually risks the stated % of the account.
  const position = suggestPositionSize(levels.slPct / 100, leverage.max, confidenceScore, true);

  const trendNote = `EMA50 ${ema50v?.toFixed(digits)} / EMA200 ${ema200v?.toFixed(digits)} — ${regimeUp ? 'bullish regime' : regimeDown ? 'bearish regime' : 'flat regime'}`;

  const analysis: SignalAnalysis = {
    symbol: target.symbol,
    pair: target.pair,
    mode,
    baseTimeframe: target.interval ?? profile.interval,
    takenAt: new Date().toISOString(),
    direction: hit.direction,
    strategyReads: deep?.strategyReads ?? [],
    triggeredCount: (deep?.strategyReads ?? []).filter(s => s.triggered).length,
    agreeingStrategies: confluenceStrategies,
    timeframeChecks: deep?.timeframeChecks ?? [],
    liquidity: deep?.liquidity ?? null,
    gateChecks,
    verdict: failed ? 'REJECTED' : 'TRADE',
    rejectionReason: failed ? `${failed.label}: ${failed.detail}` : undefined,
    rsi: rsiVal != null && !isNaN(rsiVal) ? +rsiVal.toFixed(1) : null,
    macdHistogram: macdHist != null && !isNaN(macdHist) ? +macdHist.toFixed(6) : null,
    atrPercent: +(atrPct * 100).toFixed(2),
    volumeDelta: +delta[i].toFixed(2),
    trendNote,
    candles: candles.slice(-120),
  };

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
    riskReward: `TP1 1:${levels.rr} (${levels.tp1Pct}% away) / TP2 ${riskRewardLabel(profile.tp2Atr, profile.slAtr)} / TP3 ${riskRewardLabel(profile.tp3Atr, profile.slAtr)}`,
    strategy: hit.name as Signal['strategy'],
    status: 'ACTIVE',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timeframe: `${target.interval ?? profile.interval} ${mode === 'SWING' ? 'Swing' : 'Scalp'}`,
    rationale: (confluenceStrategies.length > 1
      ? `Confluence of ${confluenceStrategies.length} strategies (${confluenceStrategies.join(', ')}): ${hit.reason}`
      : hit.reason) + rsiDivergenceNote,
    isVipOnly: false,
    isScalp: mode === 'SCALP',
    footprintDelta: +delta[i].toFixed(2),
    spoofingWall: undefined,
    liquidityWall: deep?.liquidity?.wall ?? undefined,
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
    // ---- mode + audit trail -------------------------------------------------
    mode,
    tp1DistancePct: levels.tp1Pct,
    slDistancePct: levels.slPct,
    rrRatio: levels.rr,
    levelsWidened: levels.widened,
    mtfNote: deep && deep.timeframeChecks.length
      ? `Verified on ${deep.timeframeChecks.map(t => t.timeframe).join(', ')} — ${mtfConflicts.length === 0 ? 'all agree' : `${mtfConflicts.length} conflict(s)`}`
      : undefined,
    liquidityNote: deep?.liquidity?.note,
    analysis,
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

export interface LiveAnalysisResult {
  /** Always present — the full audit trail, even when the verdict is REJECTED. */
  analysis: SignalAnalysis;
  /** Only set when the setup passed every gate. */
  signal: Signal | null;
}

interface LiveAttempt extends LiveAnalysisResult {
  /**
   * True when the ONLY thing wrong was that this timeframe is too quiet to build
   * a tradable structure. That is the one rejection worth retrying one timeframe
   * up — every other rejection is a real read of the market and must stand.
   */
  tooQuiet: boolean;
}

/** Runs the whole live pass on ONE timeframe. Never invents data. */
async function analyzeOnTimeframe(
  target: ScanTarget,
  mode: TradeMode,
  profile: RiskProfile,
  interval: string,
): Promise<LiveAttempt> {
  const candles = await fetchKlines(target.symbol, interval, 300);

  // NOTE: `deep` is threaded into EVERY exit path below. The higher-timeframe
  // checks and the order-book read are expensive and, once fetched, they are
  // part of the audit trail whether or not a trade qualifies — dropping them
  // would make the video claim "no higher-timeframe data was available" when it
  // had in fact been fetched and used.
  const reject = (reason: string, dir: 'LONG' | 'SHORT' | null, reads: StrategyRead[], deep?: DeepContext): SignalAnalysis => ({
    symbol: target.symbol,
    pair: target.pair,
    mode,
    baseTimeframe: interval,
    takenAt: new Date().toISOString(),
    direction: dir,
    strategyReads: reads,
    triggeredCount: reads.filter(r => r.triggered).length,
    agreeingStrategies: reads.filter(r => r.triggered && r.direction === dir).map(r => r.name),
    timeframeChecks: deep?.timeframeChecks ?? [],
    liquidity: deep?.liquidity ?? null,
    gateChecks: [],
    verdict: 'REJECTED',
    rejectionReason: reason,
    rsi: null,
    macdHistogram: null,
    atrPercent: null,
    volumeDelta: null,
    trendNote: reason,
    candles: candles.slice(-120),
  });

  if (candles.length < 60) {
    return {
      analysis: reject('Not enough live candles returned for this market to analyze it honestly.', null, []),
      signal: null,
      tooQuiet: false,
    };
  }

  const results = evaluateAllStrategies(candles);
  const strategyReads: StrategyRead[] = results.map(r => ({
    name: r.name,
    category: r.category,
    triggered: r.triggered,
    direction: r.direction,
    reason: r.reason,
  }));

  const triggered = results.filter(r => r.triggered && r.direction);
  if (triggered.length === 0) {
    return {
      analysis: reject('No strategy fired on the current candles — nothing to trade here right now.', null, strategyReads),
      signal: null,
      tooQuiet: false,
    };
  }

  const longVotes = triggered.filter(r => r.direction === 'LONG').length;
  const shortVotes = triggered.filter(r => r.direction === 'SHORT').length;
  const netDir: 'LONG' | 'SHORT' | null =
    longVotes > shortVotes ? 'LONG' : shortVotes > longVotes ? 'SHORT' : null;
  if (!netDir) {
    return {
      analysis: reject(`Strategies are evenly split (${longVotes} long vs ${shortVotes} short) — an ambiguous read is not a trade.`, null, strategyReads),
      signal: null,
      tooQuiet: false,
    };
  }

  const agreeing = triggered.filter(r => r.direction === netDir);
  const catRank = (c?: string) => (c === 'TREND' ? 0 : c === 'BREAKOUT' ? 1 : c === 'ICT/SMC' ? 2 : 3);
  const best = agreeing.slice().sort((a, b) => catRank(a.category) - catRank(b.category))[0];

  const deep = await runDeepAnalysis({ ...target, interval, mode }, netDir, profile, strategyReads);

  // Built UNGATED so the audit trail always exists; the verdict inside the
  // analysis says whether it qualified, and we only hand back a tradable signal
  // when it did. Nothing is invented — every line comes from the live read.
  const ungated = buildSignalFromStrategyHit(
    { ...target, interval, mode },
    candles,
    best,
    agreeing.map(a => a.name),
    { gate: false, deep },
  );
  if (!ungated || !ungated.analysis) {
    return {
      analysis: reject(
        `At ${interval} this market is too quiet for a tradable structure — a target that clears the ${profile.minTp1Pct}% minimum would sit too many ATRs away to call it a volatility stop.`,
        netDir,
        strategyReads,
        deep,
      ),
      signal: null,
      tooQuiet: true,
    };
  }

  return {
    analysis: ungated.analysis,
    signal: ungated.analysis.verdict === 'TRADE' ? ungated : null,
    tooQuiet: false,
  };
}

/**
 * Runs the COMPLETE analysis for one market against LIVE data, right now, and
 * returns the full audit trail whether or not a trade qualifies. This is the
 * single source the Analysis Video studio narrates, which is why it re-runs all
 * 21 strategies, the higher-timeframe verification and the live order-book
 * liquidity read on the spot instead of replaying anything stored.
 *
 * If the native timeframe is too quiet to build a structure that clears the
 * minimum target distance, it steps UP the timeframe ladder instead of either
 * distorting the levels or giving up — and says which timeframe it settled on.
 */
export async function analyzeSymbolLive(target: ScanTarget): Promise<LiveAnalysisResult> {
  const mode: TradeMode = target.mode ?? (target.isScalp === false ? 'SWING' : 'SCALP');
  const assetClass = classifyAsset(target.symbol);
  const profile = profileForAsset(mode, assetClass);

  let interval: string | null = target.interval ?? profile.interval;
  const tried: string[] = [];
  let attempt: LiveAttempt | null = null;

  while (interval) {
    tried.push(interval);
    attempt = await analyzeOnTimeframe(target, mode, profile, interval);
    if (!attempt.tooQuiet) break;
    interval = nextTimeframeUp(mode, interval);
  }

  const result = attempt as LiveAttempt;
  if (tried.length > 1) {
    const note = `Stepped up from ${tried[0]} to ${tried[tried.length - 1]}: the lower timeframe was too quiet for a target worth taking.`;
    result.analysis.trendNote = `${note} ${result.analysis.trendNote}`;
  }
  return { analysis: result.analysis, signal: result.signal };
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