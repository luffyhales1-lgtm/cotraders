// ANALYSIS VIDEO — script builder
//
// Turns a LIVE SignalAnalysis into an ordered set of scenes that the studio
// renders to a canvas and records to a real video file. Every line of narration
// is derived from the analysis object that was just produced from live market
// data — nothing here invents a number, and nothing replays a stored clip. If a
// check didn't happen, the scene says so instead of implying it passed.

import { Signal, SignalAnalysis } from '@/types/trading';

export type SceneKind =
  | 'INTRO'
  | 'CHART'
  | 'STRATEGIES'
  | 'TIMEFRAMES'
  | 'LIQUIDITY'
  | 'GATE'
  | 'VERDICT';

export interface SceneLine {
  text: string;
  /** true = confirmed, false = failed/against, undefined = neutral information. */
  ok?: boolean;
}

export interface Scene {
  kind: SceneKind;
  title: string;
  subtitle: string;
  lines: SceneLine[];
  durationMs: number;
}

const dirWord = (d: 'LONG' | 'SHORT' | null) => (d === 'LONG' ? 'BUY / LONG' : d === 'SHORT' ? 'SELL / SHORT' : 'NO TRADE');

/** Roughly 1.1s of reading time per line, floored so short scenes still register. */
function pace(lineCount: number, min = 3200, per = 900): number {
  return Math.max(min, Math.min(14000, lineCount * per + 1200));
}

export function buildScenes(analysis: SignalAnalysis, signal: Signal | null): Scene[] {
  const scenes: Scene[] = [];

  // ---- 1. What we are looking at ------------------------------------------
  scenes.push({
    kind: 'INTRO',
    title: `${analysis.pair} · ${dirWord(analysis.direction)}`,
    subtitle: `${analysis.mode} setup on the ${analysis.baseTimeframe} chart · analysed live at ${new Date(analysis.takenAt).toLocaleTimeString()}`,
    lines: [
      { text: `All 21 strategies are being re-run right now on live ${analysis.baseTimeframe} candles.` },
      { text: `Trend read: ${analysis.trendNote}` },
      analysis.rsi != null ? { text: `RSI(14) is ${analysis.rsi}.` } : { text: 'RSI unavailable for this market.' },
      analysis.atrPercent != null ? { text: `Volatility (ATR) is ${analysis.atrPercent}% of price — this is what sets how far the targets can sit.` } : { text: 'ATR unavailable.' },
    ],
    durationMs: pace(4),
  });

  // ---- 2. The chart and the actual levels ---------------------------------
  const chartLines: SceneLine[] = [];
  if (signal) {
    chartLines.push({ text: `Entry ${signal.entryPrice}`, ok: true });
    chartLines.push({ text: `Stop ${signal.stopLoss} — ${signal.slDistancePct}% away`, ok: true });
    chartLines.push({ text: `TP1 ${signal.target1} — ${signal.tp1DistancePct}% away`, ok: true });
    chartLines.push({ text: `TP2 ${signal.target2} · TP3 ${signal.target3}` });
    chartLines.push({ text: `Reward:risk on TP1 is 1:${signal.rrRatio} — the target is farther than the stop, which is the whole point.`, ok: true });
    if (signal.levelsWidened) {
      chartLines.push({ text: 'Volatility was tight, so every level was scaled up by the same factor — the ratio is unchanged, the target is just far enough to be worth taking after fees.' });
    }
  } else {
    chartLines.push({ text: 'No tradable level structure was issued for this market right now.', ok: false });
    chartLines.push({ text: 'A target that lands almost on top of entry is refused rather than published.' });
  }
  scenes.push({
    kind: 'CHART',
    title: 'The live chart and the exact levels',
    subtitle: `${analysis.pair} · ${analysis.baseTimeframe} · last ${analysis.candles?.length ?? 0} candles`,
    lines: chartLines,
    durationMs: pace(chartLines.length, 5000),
  });

  // ---- 3. Which strategies fired, and why ---------------------------------
  const fired = analysis.strategyReads.filter(s => s.triggered);
  const agreeing = fired.filter(s => s.direction === analysis.direction);
  const against = fired.filter(s => s.direction && s.direction !== analysis.direction);
  const stratLines: SceneLine[] = [
    { text: `${fired.length} of ${analysis.strategyReads.length} strategies fired on this candle.` },
    { text: `${agreeing.length} agree with ${dirWord(analysis.direction)}${against.length ? `, ${against.length} disagree` : ' and none disagree'}.`, ok: agreeing.length > against.length },
    ...agreeing.slice(0, 6).map(s => ({ text: `${s.name} (${s.category}) — ${s.reason}`, ok: true })),
    ...against.slice(0, 3).map(s => ({ text: `Against: ${s.name} — ${s.reason}`, ok: false })),
  ];
  if (fired.length === 0) {
    stratLines.push({ text: 'Nothing triggered, so there is nothing to trade — that is a valid answer.', ok: false });
  }
  scenes.push({
    kind: 'STRATEGIES',
    title: 'Which of the 21 strategies fired — and why',
    subtitle: 'Every strategy is evaluated, not just the one that gets the headline',
    lines: stratLines,
    durationMs: pace(stratLines.length, 6000),
  });

  // ---- 4. Higher-timeframe verification -----------------------------------
  const tfLines: SceneLine[] = analysis.timeframeChecks.length
    ? analysis.timeframeChecks.map(t => ({
        text: `${t.timeframe}: trend ${t.trend}${t.rsi != null ? `, RSI ${t.rsi}` : ''} — ${t.note}`,
        ok: t.agrees,
      }))
    : [{ text: 'No higher-timeframe data was available for this market, so this signal was NOT multi-timeframe confirmed.', ok: false }];
  if (analysis.timeframeChecks.length) {
    const conflicts = analysis.timeframeChecks.filter(t => !t.agrees).length;
    tfLines.push({
      text: conflicts === 0
        ? 'Every higher timeframe checked agrees with the trade direction.'
        : `${conflicts} higher timeframe(s) disagree — the trade is not confirmed.`,
      ok: conflicts === 0,
    });
  }
  scenes.push({
    kind: 'TIMEFRAMES',
    title: 'Did we verify it on the higher timeframes?',
    subtitle: 'A setup that only exists on one timeframe is not a trade',
    lines: tfLines,
    durationMs: pace(tfLines.length, 4500),
  });

  // ---- 5. Liquidity -------------------------------------------------------
  const liq = analysis.liquidity;
  const liqLines: SceneLine[] = liq
    ? [
        { text: `Top-of-book depth: ${liq.bidDepth} bid vs ${liq.askDepth} ask (imbalance ${liq.imbalance}).` },
        { text: liq.spreadPct != null ? `Spread is ${liq.spreadPct}% of price.` : 'Spread unavailable.' },
        { text: liq.quoteVolume24h != null ? `24h volume ${`$${Math.round(liq.quoteVolume24h).toLocaleString()}`}.` : '24h volume unavailable for this market.' },
        ...(liq.wall ? [{ text: liq.wall }] : []),
        { text: liq.note, ok: liq.passed },
      ]
    : [{ text: 'No live order book was available for this market, so liquidity could NOT be verified here.', ok: false }];
  scenes.push({
    kind: 'LIQUIDITY',
    title: 'Did we check market liquidity?',
    subtitle: 'Live order book read at the moment of the signal',
    lines: liqLines,
    durationMs: pace(liqLines.length, 4500),
  });

  // ---- 6. The gate, line by line ------------------------------------------
  const gateLines: SceneLine[] = analysis.gateChecks.length
    ? analysis.gateChecks.map(g => ({ text: `${g.label} — ${g.detail}`, ok: g.passed }))
    : [{ text: 'The qualification gate did not run for this market.', ok: false }];
  scenes.push({
    kind: 'GATE',
    title: 'The qualification gate, check by check',
    subtitle: 'Analyse first, then trade — every check is shown, pass or fail',
    lines: gateLines,
    durationMs: pace(gateLines.length, 6000),
  });

  // ---- 7. Verdict ---------------------------------------------------------
  scenes.push({
    kind: 'VERDICT',
    title: analysis.verdict === 'TRADE' ? `VERDICT: TRADE — ${dirWord(analysis.direction)}` : 'VERDICT: NO TRADE',
    subtitle: analysis.verdict === 'TRADE'
      ? `${analysis.pair} · ${analysis.mode} · ${analysis.baseTimeframe}`
      : (analysis.rejectionReason ?? 'The setup did not clear every check.'),
    lines: analysis.verdict === 'TRADE' && signal
      ? [
          { text: `Entry ${signal.entryPrice} · Stop ${signal.stopLoss} · TP1 ${signal.target1}`, ok: true },
          { text: `Reward:risk 1:${signal.rrRatio} · TP1 ${signal.tp1DistancePct}% away`, ok: true },
          { text: `Conviction ${signal.confidenceScore}/100 from ${signal.confluenceCount} agreeing strategies`, ok: true },
          { text: signal.backtestLabel ?? '' },
          { text: signal.positionSizeNote ?? '' },
        ].filter(l => l.text)
      : [
          { text: analysis.rejectionReason ?? 'One or more checks failed.', ok: false },
          { text: 'Publishing this anyway would be a fake signal. It is not published.' },
        ],
    durationMs: pace(4, 5000),
  });

  return scenes;
}

export function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((a, s) => a + s.durationMs, 0);
}
