import { Signal, MarketOverview } from '@/types/trading';
import {
  scanMarketForSignals,
  analyzeMarketOverview,
  buildDynamicWatchlist,
  ScanTarget,
} from '@/services/signalEngine';
import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';
import { TelegramSignalPayload } from '@/services/telegramService';

export interface GrokResearchResult {
  statement: string;       // synthesized natural-language market read (from REAL numbers)
  overview: MarketOverview;
  topSignals: Signal[];    // strongest REAL setups across MULTIPLE coins
  goldRead: string | null; // dedicated gold line if XAUUSDT triggered
  scannedCount: number;    // how many coins have been scanned so far
  totalToScan: number;     // size of the full live universe
  done: boolean;           // false while streaming partial passes, true when complete
}

export interface GrokRunOptions {
  topN?: number;
  /** Called after every chunk with the running partial result so the UI can render live. */
  onProgress?: (partial: GrokResearchResult) => void;
  /** Set false to stop early (e.g. component unmounted). Checked between chunks. */
  shouldContinue?: () => boolean;
}

const CHUNK_SIZE = 24; // coins scanned per incremental pass (keeps the UI live, avoids rate limits)

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Builds the FULL live scan universe for Grok: every liquid Binance USDT-M
 * perpetual (top ~500 by 24h volume — effectively the entire tradable market),
 * with gold, silver and the majors pulled to the FRONT so the market statement
 * and gold read populate on the very first pass instead of at the end.
 */
async function buildGrokUniverse(): Promise<ScanTarget[]> {
  const full = await buildDynamicWatchlist(500);
  const priority = ['XAUUSDT', 'XAGUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
  const head: ScanTarget[] = [];
  for (const sym of priority) {
    const found = full.find(t => t.symbol === sym);
    if (found) head.push(found);
  }
  const rest = full.filter(t => !priority.includes(t.symbol));
  return [...head, ...rest];
}

/**
 * Grok AI "deep research" engine.
 *
 * Runs the REAL strategy engine across the ENTIRE live coin universe (not a
 * hand-picked pair, not a Math.random number). To scan every coin without
 * freezing the browser or tripping Binance rate limits, it works in small
 * chunks and streams a running result to `onProgress` after each pass — so the
 * UI fills in live (coins + setups accumulate, breadth updates) instead of
 * sitting blank until a huge scan finishes. Every figure traces back to real
 * candle math.
 */
export async function runGrokDeepResearch(opts: GrokRunOptions = {}): Promise<GrokResearchResult> {
  const topN = opts.topN ?? 8;
  const universe = await buildGrokUniverse();
  const total = universe.length;
  const collected: Signal[] = [];

  const build = (scanned: number, done: boolean): GrokResearchResult => {
    collected.sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
    const overview = analyzeMarketOverview(collected, scanned);
    const gold = collected.find(s => s.symbol === 'XAUUSDT');
    const goldRead = gold
      ? `Gold (XAU/USD): ${gold.type} bias, RSI ${gold.rsiValue ?? '--'}, conviction ${gold.confidenceScore ?? '--'}/100 via ${gold.strategy}.`
      : null;
    return {
      statement: buildStatement(overview, goldRead, scanned, total, done),
      overview,
      topSignals: collected.slice(0, topN),
      goldRead,
      scannedCount: scanned,
      totalToScan: total,
      done,
    };
  };

  for (let i = 0; i < universe.length; i += CHUNK_SIZE) {
    if (opts.shouldContinue && !opts.shouldContinue()) break;
    const chunk = universe.slice(i, i + CHUNK_SIZE);
    try {
      const chunkSignals = await scanMarketForSignals(chunk);
      collected.push(...chunkSignals);
    } catch (e) {
      console.error('[grok] chunk scan failed, continuing:', e);
    }
    const scanned = Math.min(i + CHUNK_SIZE, total);
    opts.onProgress?.(build(scanned, false));
    await sleep(120); // yield to the main thread so the page stays smooth
  }

  return build(total, true);
}

function buildStatement(
  s: MarketOverview,
  goldRead: string | null,
  scanned: number,
  total: number,
  done: boolean,
): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lead = s.strongest[0];

  const progress = done
    ? `Full-market pass complete — ${total} live instruments scanned.`
    : `Scanning the full live market… ${scanned}/${total} coins analysed so far.`;

  const biasClause =
    s.signalCount === 0
      ? ` No strategy conditions are met yet across the coins scanned — a low-signal/chop regime. Standing aside is the trade until a setup fires.`
      : ` Net market bias is ${s.bias} at ${s.biasStrengthPct}% breadth (${s.longCount} long vs ${s.shortCount} short setups live).`;

  const momentumClause =
    s.avgRsi != null
      ? ` Average RSI(14) on triggered pairs is ${s.avgRsi}, with mean conviction ${s.avgConfidence ?? '--'}/100.`
      : '';

  const btcClause = s.btcTrend ? ` BTC leadership read: ${s.btcTrend}.` : '';

  const stratClause = s.topStrategies.length
    ? ` Most active edges: ${s.topStrategies.slice(0, 3).map(t => `${t.name} (${t.count})`).join(', ')}.`
    : '';

  const leadClause = lead
    ? ` Strongest actionable setup: ${lead.type} ${lead.pair} via ${lead.strategy} — entry $${lead.entryPrice}, conviction ${lead.confidenceScore ?? '--'}/100, RSI ${lead.rsiValue ?? '--'}${lead.rsiDivergence ? `, ${lead.rsiDivergence} divergence` : ''}.`
    : '';

  const goldClause = goldRead ? ` ${goldRead}` : '';

  return `Grok AI deep-research statement (${time}): ${progress}${biasClause}${momentumClause}${btcClause}${stratClause}${leadClause}${goldClause}`;
}

/**
 * Maps a real Signal into the Telegram dispatch payload, generating a chart
 * screenshot from its REAL levels (entry/SL/TP/support/resistance).
 */
export function signalToTelegramPayload(sig: Signal): TelegramSignalPayload {
  const chartScreenshotUrl = generateTradeSetupChartImage({
    pair: sig.pair,
    type: sig.type,
    entryPrice: sig.entryPrice,
    target1: sig.target1,
    target2: sig.target2,
    target3: sig.target3,
    stopLoss: sig.stopLoss,
    support1: sig.supportLevel,
    resistance1: sig.resistanceLevel,
    timeframe: sig.timeframe,
    strategy: sig.strategy,
    winProbability: sig.confidenceScore ?? sig.winProbability,
    footprintDelta: sig.footprintDelta,
    orderBlockZone: sig.orderBlockZone,
  });

  return {
    pair: sig.pair,
    type: sig.type,
    strategy: sig.strategy,
    timeframe: sig.timeframe,
    entryPrice: sig.entryPrice,
    target1: sig.target1,
    target2: sig.target2,
    target3: sig.target3,
    stopLoss: sig.stopLoss,
    support1: sig.supportLevel,
    resistance1: sig.resistanceLevel,
    leverage: sig.leverage,
    winProbability: sig.winProbability,
    riskReward: sig.riskReward,
    rationale: sig.rationale,
    chartScreenshotUrl,
    footprintDelta: sig.footprintDelta,
    orderBlockZone: sig.orderBlockZone,
    backtestLabel: sig.backtestLabel,
    momentumNote: sig.momentumNote,
    rsiValue: sig.rsiValue,
    rsiDivergence: sig.rsiDivergence,
    atrPercent: sig.atrPercent,
    positionSizeNote: sig.positionSizeNote,
    confidenceScore: sig.confidenceScore,
    confluenceCount: sig.confluenceCount,
    assetClass: sig.assetClass,
    momentumStatus: sig.momentumStatus,
  };
}
