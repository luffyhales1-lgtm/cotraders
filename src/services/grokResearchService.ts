import { Signal, MarketOverview } from '@/types/trading';
import { getScanBatch, scanMarketForSignals, analyzeMarketOverview } from '@/services/signalEngine';
import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';
import { TelegramSignalPayload } from '@/services/telegramService';

export interface GrokResearchResult {
  statement: string;       // synthesized natural-language market read (from REAL numbers)
  overview: MarketOverview;
  topSignals: Signal[];    // strongest REAL setups across MULTIPLE coins
  goldRead: string | null; // dedicated gold line if XAUUSDT triggered
}

/**
 * Grok AI "deep research" engine.
 *
 * This does NOT fabricate a signal (the old version picked gold-vs-BTC with
 * Math.random and invented a 95% number). Instead it runs the REAL strategy
 * engine across the whole rotating scan batch — dozens of coins plus gold &
 * silver — then synthesizes a genuine top-down statement from the measured
 * breadth, bias, average RSI/conviction, leading strategies and the strongest
 * actual setups. Every figure in the statement traces back to real candle math.
 *
 * "Deep research on multiple coins" = we surface the strongest setups across
 * the entire scanned universe, not one hand-picked pair.
 */
export async function runGrokDeepResearch(topN = 6): Promise<GrokResearchResult> {
  const batch = await getScanBatch();
  const signals = await scanMarketForSignals(batch);
  const overview = analyzeMarketOverview(signals, batch.length);
  const topSignals = signals.slice(0, topN);

  const gold = signals.find(s => s.symbol === 'XAUUSDT');
  const goldRead = gold
    ? `Gold (XAU/USD): ${gold.type} bias, RSI ${gold.rsiValue ?? '--'}, conviction ${gold.confidenceScore ?? '--'}/100 via ${gold.strategy}.`
    : null;

  const statement = buildStatement(overview, goldRead);
  return { statement, overview, topSignals, goldRead };
}

function buildStatement(s: MarketOverview, goldRead: string | null): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lead = s.strongest[0];

  const biasClause =
    s.signalCount === 0
      ? `No strategy conditions are met across the ${s.scannedCount} instruments scanned right now — the market is in a low-signal/chop regime. Standing aside is the trade.`
      : `Net market bias is ${s.bias} at ${s.biasStrengthPct}% breadth (${s.longCount} long vs ${s.shortCount} short setups live across ${s.scannedCount} scanned instruments).`;

  const momentumClause =
    s.avgRsi != null
      ? ` Average RSI(14) on triggered pairs is ${s.avgRsi}, with mean conviction ${s.avgConfidence ?? '--'}/100.`
      : '';

  const btcClause = s.btcTrend ? ` BTC leadership read: ${s.btcTrend}.` : '';

  const stratClause = s.topStrategies.length
    ? ` Most active edges this pass: ${s.topStrategies.slice(0, 3).map(t => `${t.name} (${t.count})`).join(', ')}.`
    : '';

  const leadClause = lead
    ? ` Strongest actionable setup: ${lead.type} ${lead.pair} via ${lead.strategy} — entry $${lead.entryPrice}, conviction ${lead.confidenceScore ?? '--'}/100, RSI ${lead.rsiValue ?? '--'}${lead.rsiDivergence ? `, ${lead.rsiDivergence} divergence` : ''}.`
    : '';

  const goldClause = goldRead ? ` ${goldRead}` : '';

  return `Grok AI deep-research statement (${time}): ${biasClause}${momentumClause}${btcClause}${stratClause}${leadClause}${goldClause}`;
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
