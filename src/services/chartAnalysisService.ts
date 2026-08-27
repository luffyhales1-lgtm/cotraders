import { supabase } from '@/integrations/supabase/client';
import { ManualPaperTradeInput } from '@/services/paperTradingService';
import { fetchKlines } from '@/services/binanceApi';
import { evaluateAllStrategies } from '@/services/strategies';
import { buildSignalFromStrategyHit, ScanTarget } from '@/services/signalEngine';
import { CandleData } from '@/types/trading';

/**
 * AI Chart Screenshot Analysis
 * ----------------------------
 * The user uploads a screenshot of a chart. We send it to the `analyze-chart`
 * Supabase edge function, which asks a real vision LLM (OpenAI / Gemini — the
 * key lives server-side, never in the browser) to read the chart like a pro
 * price-action / SMC / ICT analyst and return a STRICT JSON verdict:
 *   • which strategies are in play,
 *   • support / resistance levels,
 *   • the trade that appears to be taken / set up (entry, SL, targets),
 *   • Fibonacci retracement levels,
 *   • an overall directional bias + confidence.
 *
 * Nothing here is fabricated on the client: if the function or its API key
 * isn't configured we surface a clear error instead of inventing analysis.
 * The model also returns approximate vertical positions (`yRatio`, 0 = top of
 * the image, 1 = bottom) for each level so we can draw an ANNOTATED copy of the
 * user's screenshot on a canvas. Where a yRatio is missing we derive it from the
 * price range, so the overlay always renders.
 */

export type Bias = 'LONG' | 'SHORT' | 'NEUTRAL';
export type TradeDirection = 'LONG' | 'SHORT' | 'NONE';

export interface StrategyFinding {
  name: string;
  applied: boolean;
  note: string;
}

export interface LevelHint {
  price: number;
  yRatio?: number; // 0 (top) .. 1 (bottom)
  note?: string;
}

export interface FibLevel {
  label: string;   // e.g. "0.618"
  ratio: number;   // 0.618
  price: number;
  yRatio?: number;
}

export interface AnalysisFibonacci {
  direction: 'up' | 'down';
  swingHigh?: number;
  swingLow?: number;
  levels: FibLevel[];
}

export interface DetectedTrade {
  direction: TradeDirection;
  entry?: number;
  entryYRatio?: number;
  stopLoss?: number;
  stopYRatio?: number;
  targets: LevelHint[];
  rationale?: string;
}

export interface ChartAnalysis {
  pair: string;
  timeframe: string;
  bias: Bias;
  confidence: number; // 0-100
  summary: string;
  priceContext: { lastPrice?: number; high?: number; low?: number };
  strategies: StrategyFinding[];
  supportLevels: LevelHint[];
  resistanceLevels: LevelHint[];
  fibonacci: AnalysisFibonacci | null;
  detectedTrade: DetectedTrade;
  disclaimer: string;
}

export interface AnalyzeContext {
  pair?: string;
  timeframe?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Normalisation — the model is instructed to return this exact shape, but we
// defend against missing/extra fields so the UI never crashes on a bad payload.
// ---------------------------------------------------------------------------

function num(v: any): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.\-]/g, '')) : v;
  return typeof n === 'number' && isFinite(n) ? n : undefined;
}

function clamp01(v: any): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  return Math.min(0.98, Math.max(0.02, n));
}

function asBias(v: any): Bias {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('LONG') || s.includes('BULL') || s.includes('BUY')) return 'LONG';
  if (s.includes('SHORT') || s.includes('BEAR') || s.includes('SELL')) return 'SHORT';
  return 'NEUTRAL';
}

function asDirection(v: any): TradeDirection {
  const b = asBias(v);
  return b === 'NEUTRAL' ? 'NONE' : b;
}

function levelList(arr: any): LevelHint[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((l) => ({
      price: num(l?.price) ?? num(l) ?? 0,
      yRatio: clamp01(l?.yRatio),
      note: typeof l?.note === 'string' ? l.note : undefined,
    }))
    .filter((l) => l.price > 0)
    .slice(0, 6);
}

function normalise(raw: any, ctx: AnalyzeContext): ChartAnalysis {
  const strategies: StrategyFinding[] = Array.isArray(raw?.strategies)
    ? raw.strategies
        .map((s: any) => ({
          name: String(s?.name ?? 'Unnamed pattern').slice(0, 60),
          applied: s?.applied === true || String(s?.applied).toLowerCase() === 'true',
          note: String(s?.note ?? '').slice(0, 240),
        }))
        .slice(0, 10)
    : [];

  const fibRaw = raw?.fibonacci;
  const fibonacci: AnalysisFibonacci | null =
    fibRaw && Array.isArray(fibRaw.levels) && fibRaw.levels.length > 0
      ? {
          direction: String(fibRaw.direction).toLowerCase() === 'down' ? 'down' : 'up',
          swingHigh: num(fibRaw.swingHigh),
          swingLow: num(fibRaw.swingLow),
          levels: fibRaw.levels
            .map((l: any) => ({
              label: String(l?.label ?? l?.ratio ?? '').slice(0, 12),
              ratio: num(l?.ratio) ?? 0,
              price: num(l?.price) ?? 0,
              yRatio: clamp01(l?.yRatio),
            }))
            .filter((l: FibLevel) => l.price > 0)
            .slice(0, 8),
        }
      : null;

  const t = raw?.detectedTrade ?? {};
  const detectedTrade: DetectedTrade = {
    direction: asDirection(t?.direction),
    entry: num(t?.entry),
    entryYRatio: clamp01(t?.entryYRatio),
    stopLoss: num(t?.stopLoss),
    stopYRatio: clamp01(t?.stopYRatio),
    targets: levelList(t?.targets),
    rationale: typeof t?.rationale === 'string' ? t.rationale.slice(0, 300) : undefined,
  };

  const confidence = Math.min(100, Math.max(0, Math.round(num(raw?.confidence) ?? 0)));

  return {
    pair: String(raw?.pair || ctx.pair || 'Unknown').slice(0, 24).toUpperCase(),
    timeframe: String(raw?.timeframe || ctx.timeframe || '—').slice(0, 16),
    bias: asBias(raw?.bias),
    confidence,
    summary: String(raw?.summary ?? '').slice(0, 1200) || 'No summary returned.',
    priceContext: {
      lastPrice: num(raw?.priceContext?.lastPrice),
      high: num(raw?.priceContext?.high),
      low: num(raw?.priceContext?.low),
    },
    strategies,
    supportLevels: levelList(raw?.supportLevels),
    resistanceLevels: levelList(raw?.resistanceLevels),
    fibonacci,
    detectedTrade,
    disclaimer:
      String(raw?.disclaimer ?? '') ||
      'AI-estimated read of the chart image. Educational only — not financial advice.',
  };
}

// ---------------------------------------------------------------------------
// Main entry — call the edge function with the screenshot.
// ---------------------------------------------------------------------------

/**
 * Sends a chart screenshot to the analyzer edge function and returns a
 * normalised ChartAnalysis. If the vision function isn't deployed / has no key,
 * it transparently falls back to a REAL live technical read of the pair the user
 * typed — running all 21 strategies on live Binance futures candles and telling
 * them the best trade. Nothing is fabricated: the fallback uses live market data,
 * not the image pixels, and is clearly labelled as such in the summary.
 */
export async function analyzeChartImage(
  imageDataUrl: string,
  ctx: AnalyzeContext = {},
): Promise<ChartAnalysis> {
  if (!imageDataUrl) throw new Error('Please upload a chart screenshot first.');

  // 1) Try the real vision model server-side (best — reads the actual image).
  try {
    const { data, error } = await supabase.functions.invoke('analyze-chart', {
      body: { image: imageDataUrl, context: ctx },
    });
    if (!error && data && !(data as any).error) {
      return normalise((data as any).analysis ?? data, ctx);
    }
  } catch {
    /* fall through to the live-engine read below */
  }

  // 2) Vision add-on unavailable — run a genuine LIVE 21-strategy analysis of the
  //    pair the user specified. This is real market analysis, not image reading.
  const pairGuess = (ctx.pair || '').trim();
  if (pairGuess) {
    return analyzePairLive(pairGuess, ctx.timeframe || '', ctx);
  }

  throw new Error(
    'To analyze without the vision add-on, type the Pair (e.g. BTC/USDT) in the Pair box — I\'ll run a full LIVE 21-strategy read of that market and give you the best trade. (Or deploy the "analyze-chart" edge function with a vision key to read the screenshot directly.)',
  );
}

// ---------------------------------------------------------------------------
// LIVE technical analysis fallback — all 21 strategies on real Binance candles.
// ---------------------------------------------------------------------------

/** Detect pivot highs/lows over the recent window (fractal, lookback 3). */
function findPivots(candles: CandleData[], look = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = look; i < candles.length - look; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - look; j <= i + look; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push(candles[i].high);
    if (isLow) lows.push(candles[i].low);
  }
  return { highs, lows };
}

/** Collapse near-identical levels and return the N nearest to the reference price. */
function pickLevels(values: number[], ref: number, side: 'above' | 'below', count = 3): LevelHint[] {
  const filtered = values.filter((v) => (side === 'above' ? v > ref : v < ref));
  const deduped: number[] = [];
  for (const v of filtered.sort((a, b) => (side === 'above' ? a - b : b - a))) {
    if (!deduped.some((d) => Math.abs(d - v) / (ref || 1) < 0.0025)) deduped.push(v);
    if (deduped.length >= count) break;
  }
  return deduped.map((price) => ({ price: +price.toFixed(price < 1 ? 6 : 2) }));
}

function buildFibonacci(candles: CandleData[], bias: Bias): AnalysisFibonacci {
  const recent = candles.slice(-90);
  const hi = Math.max(...recent.map((c) => c.high));
  const lo = Math.min(...recent.map((c) => c.low));
  const span = hi - lo || 1;
  const direction: 'up' | 'down' = bias === 'SHORT' ? 'down' : 'up';
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const dp = hi < 1 ? 6 : 2;
  const levels: FibLevel[] = ratios.map((r) => {
    // up = retracement from swing low toward high; down = from high toward low
    const price = direction === 'up' ? hi - span * r : lo + span * r;
    return { label: r === 0 ? '0' : r === 1 ? '1' : r.toFixed(3), ratio: r, price: +price.toFixed(dp) };
  });
  return { direction, swingHigh: +hi.toFixed(dp), swingLow: +lo.toFixed(dp), levels };
}

/**
 * Runs the full engine on live candles for a pair and returns a ChartAnalysis
 * (bias, strategies, S/R, Fibonacci, and the best detected trade with entry/SL/TP).
 */
export async function analyzePairLive(
  pairInput: string,
  timeframeInput: string,
  ctx: AnalyzeContext = {},
): Promise<ChartAnalysis> {
  const symbol = symbolFromPair(pairInput);
  const tf = /^(1m|5m|15m|1h|4h|1d)$/.test(timeframeInput) ? timeframeInput : '1h';
  const candles = await fetchKlines(symbol, tf, 200);

  if (candles.length < 60) {
    throw new Error(
      `Couldn't pull enough live candles for "${pairInput.toUpperCase()}". Check the symbol (try e.g. BTC/USDT, ETH/USDT, SOL/USDT).`,
    );
  }

  const last = candles[candles.length - 1].close;
  const results = evaluateAllStrategies(candles);
  const triggered = results.filter((r) => r.triggered && r.direction);
  const longs = triggered.filter((r) => r.direction === 'LONG').length;
  const shorts = triggered.filter((r) => r.direction === 'SHORT').length;
  const bias: Bias = longs > shorts ? 'LONG' : shorts > longs ? 'SHORT' : 'NEUTRAL';

  // Best trade: prefer a triggered strategy aligned with the net bias.
  const primary =
    triggered.find((r) => bias !== 'NEUTRAL' && r.direction === bias) ?? triggered[0] ?? null;

  const target: ScanTarget = { symbol, pair: pairInput.toUpperCase(), interval: tf, isScalp: tf === '5m' };
  const signal = primary
    ? buildSignalFromStrategyHit(
        target,
        candles,
        { name: primary.name, direction: primary.direction!, reason: primary.reason },
        triggered.filter((r) => r.direction === primary.direction).map((r) => r.name),
      )
    : null;

  const { highs, lows } = findPivots(candles);
  const resistanceLevels = pickLevels(highs.length ? highs : candles.map((c) => c.high), last, 'above');
  const supportLevels = pickLevels(lows.length ? lows : candles.map((c) => c.low), last, 'below');
  const fibonacci = buildFibonacci(candles, bias);

  const strategies: StrategyFinding[] = results
    .filter((r) => r.triggered)
    .slice(0, 10)
    .map((r) => ({ name: r.name, applied: true, note: r.reason.slice(0, 200) }));
  if (strategies.length === 0) {
    strategies.push({ name: 'No strategy firing', applied: false, note: 'Market is between clean setups on this timeframe right now.' });
  }

  const detectedTrade: DetectedTrade = signal
    ? {
        direction: signal.type,
        entry: signal.entryPrice,
        stopLoss: signal.stopLoss,
        targets: [signal.target1, signal.target2, signal.target3]
          .filter((p): p is number => typeof p === 'number' && p > 0)
          .map((price) => ({ price })),
        rationale: signal.rationale || primary?.reason,
      }
    : { direction: 'NONE', targets: [] };

  const confidence = signal?.confidenceScore ?? (bias === 'NEUTRAL' ? 35 : 50 + Math.min(30, triggered.length * 6));

  const dp = last < 1 ? 6 : 2;
  const summaryParts: string[] = [];
  summaryParts.push(
    `LIVE technical read of ${pairInput.toUpperCase()} on the ${tf} timeframe (last price ${formatPrice(last)}).`,
  );
  summaryParts.push(
    `Vision image-reading isn't enabled, so this is a real market analysis from live Binance futures candles across all 21 strategies — not a read of the uploaded picture.`,
  );
  summaryParts.push(
    bias === 'NEUTRAL'
      ? `Net bias is NEUTRAL: ${longs} bullish vs ${shorts} bearish strategy triggers — no strong edge right now.`
      : `Net bias is ${bias} — ${bias === 'LONG' ? longs : shorts} of ${triggered.length} firing strategies agree.`,
  );
  if (signal) {
    summaryParts.push(
      `Best trade: ${signal.type} via ${signal.strategy}${signal.demandSupplyZone ? ` (${signal.demandSupplyZone})` : ''} — entry ${formatPrice(signal.entryPrice)}, stop ${formatPrice(signal.stopLoss)}, first target ${formatPrice(signal.target1)}. Conviction ${signal.confidenceScore}/100.`,
    );
  } else {
    summaryParts.push('No clean entry is triggering right now — treat this as observation, not a trade.');
  }

  return {
    pair: (ctx.pair || pairInput).toUpperCase().slice(0, 24),
    timeframe: tf,
    bias,
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
    summary: summaryParts.join(' '),
    priceContext: {
      lastPrice: +last.toFixed(dp),
      high: +Math.max(...candles.slice(-90).map((c) => c.high)).toFixed(dp),
      low: +Math.min(...candles.slice(-90).map((c) => c.low)).toFixed(dp),
    },
    strategies,
    supportLevels,
    resistanceLevels,
    fibonacci,
    detectedTrade,
    disclaimer:
      'Live 21-strategy technical read from real Binance futures data. Educational only — not financial advice.',
  };
}

// ---------------------------------------------------------------------------
// Annotated image — draw the AI's levels back onto the user's screenshot.
// ---------------------------------------------------------------------------

interface DrawLevel {
  yRatio: number;
  label: string;
  price?: number;
  color: string;
  dashed: boolean;
}

const COLORS = {
  support: '#34d399',
  resistance: '#fb7185',
  entry: '#38bdf8',
  stop: '#f43f5e',
  target: '#a855f7',
  fib: '#fbbf24',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the uploaded image.'));
    img.src = src;
  });
}

/** Map a price to a vertical ratio using the visible price range, as a fallback
 *  when the model didn't return an explicit yRatio for a level. */
function makePriceToYRatio(analysis: ChartAnalysis) {
  const prices: number[] = [];
  const push = (n?: number) => { if (typeof n === 'number' && isFinite(n)) prices.push(n); };
  push(analysis.priceContext.high);
  push(analysis.priceContext.low);
  push(analysis.priceContext.lastPrice);
  analysis.supportLevels.forEach((l) => push(l.price));
  analysis.resistanceLevels.forEach((l) => push(l.price));
  push(analysis.detectedTrade.entry);
  push(analysis.detectedTrade.stopLoss);
  analysis.detectedTrade.targets.forEach((t) => push(t.price));
  (analysis.fibonacci?.levels ?? []).forEach((l) => push(l.price));

  if (prices.length < 2) return (_p?: number) => undefined as number | undefined;
  const hi = Math.max(...prices);
  const lo = Math.min(...prices);
  const span = hi - lo || 1;
  // Use the top 8% / bottom 8% as margins so lines sit inside the chart body.
  return (p?: number): number | undefined => {
    if (typeof p !== 'number' || !isFinite(p)) return undefined;
    const r = (hi - p) / span; // higher price -> nearer the top
    return Math.min(0.94, Math.max(0.06, 0.06 + r * 0.88));
  };
}

/**
 * Renders the uploaded screenshot with the AI's support/resistance, entry, stop,
 * target and Fibonacci levels drawn on top, plus a header/footer ribbon. Returns
 * a PNG data-URL the user can view, download, and share. Runs fully client-side.
 */
export async function renderAnnotatedChart(
  baseImageDataUrl: string,
  analysis: ChartAnalysis,
): Promise<string> {
  const img = await loadImage(baseImageDataUrl);

  // Cap the working width for performance while keeping aspect ratio.
  const maxW = 1280;
  const scale = img.width > maxW ? maxW / img.width : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const headerH = Math.round(Math.max(46, h * 0.075));
  const footerH = Math.round(Math.max(30, h * 0.05));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + headerH + footerH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  // Background
  ctx.fillStyle = '#0b0714';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header ribbon
  ctx.fillStyle = '#150c25';
  ctx.fillRect(0, 0, canvas.width, headerH);
  ctx.fillStyle = '#c4b5fd';
  ctx.font = `bold ${Math.round(headerH * 0.34)}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`COTRADERS AI  •  ${analysis.pair}  ${analysis.timeframe}`, 16, headerH * 0.5);

  const biasColor =
    analysis.bias === 'LONG' ? '#34d399' : analysis.bias === 'SHORT' ? '#fb7185' : '#a78bfa';
  const biasLabel = `${analysis.bias}  ${analysis.confidence}%`;
  ctx.font = `bold ${Math.round(headerH * 0.32)}px sans-serif`;
  const bw = ctx.measureText(biasLabel).width + 28;
  ctx.fillStyle = biasColor;
  const bx = canvas.width - bw - 14;
  const bh = headerH * 0.6;
  ctx.fillRect(bx, (headerH - bh) / 2, bw, bh);
  ctx.fillStyle = '#0b0714';
  ctx.textAlign = 'center';
  ctx.fillText(biasLabel, bx + bw / 2, headerH * 0.5);
  ctx.textAlign = 'left';

  // The chart image itself
  ctx.drawImage(img, 0, headerH, w, h);

  // Build the level list
  const p2y = makePriceToYRatio(analysis);
  const levels: DrawLevel[] = [];

  analysis.resistanceLevels.forEach((l) =>
    levels.push({ yRatio: l.yRatio ?? p2y(l.price) ?? 0.2, label: 'RES', price: l.price, color: COLORS.resistance, dashed: true }),
  );
  analysis.supportLevels.forEach((l) =>
    levels.push({ yRatio: l.yRatio ?? p2y(l.price) ?? 0.8, label: 'SUP', price: l.price, color: COLORS.support, dashed: true }),
  );
  (analysis.fibonacci?.levels ?? []).forEach((l) =>
    levels.push({ yRatio: l.yRatio ?? p2y(l.price) ?? 0.5, label: `FIB ${l.label}`, price: l.price, color: COLORS.fib, dashed: true }),
  );
  const tr = analysis.detectedTrade;
  if (tr.entry) levels.push({ yRatio: tr.entryYRatio ?? p2y(tr.entry) ?? 0.5, label: 'ENTRY', price: tr.entry, color: COLORS.entry, dashed: false });
  if (tr.stopLoss) levels.push({ yRatio: tr.stopYRatio ?? p2y(tr.stopLoss) ?? 0.9, label: 'SL', price: tr.stopLoss, color: COLORS.stop, dashed: true });
  tr.targets.forEach((t, i) =>
    levels.push({ yRatio: t.yRatio ?? p2y(t.price) ?? 0.15, label: `TP${i + 1}`, price: t.price, color: COLORS.target, dashed: true }),
  );

  // Draw the lines + price tags
  const tagFont = Math.round(Math.max(10, h * 0.022));
  ctx.font = `bold ${tagFont}px monospace`;
  for (const lv of levels) {
    const y = headerH + Math.min(h - 2, Math.max(2, lv.yRatio * h));
    ctx.strokeStyle = lv.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(lv.dashed ? [8, 5] : []);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const priceTxt = lv.price !== undefined ? `${lv.label}  ${formatPrice(lv.price)}` : lv.label;
    const tagW = ctx.measureText(priceTxt).width + 16;
    const tagH = tagFont + 8;
    ctx.fillStyle = lv.color;
    ctx.fillRect(w - tagW - 6, y - tagH / 2, tagW, tagH);
    ctx.fillStyle = '#0b0714';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceTxt, w - tagW + 2, y);
  }

  // Footer
  ctx.fillStyle = '#150c25';
  ctx.fillRect(0, h + headerH, canvas.width, footerH);
  ctx.fillStyle = '#8b7fb0';
  ctx.font = `${Math.round(footerH * 0.42)}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('AI-estimated overlay • educational only, not financial advice', 14, h + headerH + footerH * 0.5);

  return canvas.toDataURL('image/png');
}

export function formatPrice(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}

// ---------------------------------------------------------------------------
// Copyable text report
// ---------------------------------------------------------------------------

export function buildAnalysisText(a: ChartAnalysis): string {
  const lines: string[] = [];
  lines.push(`COTRADERS AI — CHART ANALYSIS`);
  lines.push(`Pair: ${a.pair}   Timeframe: ${a.timeframe}`);
  lines.push(`Bias: ${a.bias}   Confidence: ${a.confidence}%`);
  lines.push('');
  lines.push(`SUMMARY`);
  lines.push(a.summary);
  lines.push('');

  if (a.strategies.length) {
    lines.push(`STRATEGIES DETECTED`);
    a.strategies.forEach((s) => lines.push(`  ${s.applied ? '✔' : '✘'} ${s.name} — ${s.note}`));
    lines.push('');
  }

  if (a.supportLevels.length) {
    lines.push(`SUPPORT`);
    a.supportLevels.forEach((l) => lines.push(`  • ${formatPrice(l.price)}${l.note ? ` — ${l.note}` : ''}`));
    lines.push('');
  }
  if (a.resistanceLevels.length) {
    lines.push(`RESISTANCE`);
    a.resistanceLevels.forEach((l) => lines.push(`  • ${formatPrice(l.price)}${l.note ? ` — ${l.note}` : ''}`));
    lines.push('');
  }

  if (a.fibonacci && a.fibonacci.levels.length) {
    lines.push(`FIBONACCI (${a.fibonacci.direction === 'up' ? 'swing low → high' : 'swing high → low'})`);
    a.fibonacci.levels.forEach((l) => lines.push(`  ${l.label}: ${formatPrice(l.price)}`));
    lines.push('');
  }

  const t = a.detectedTrade;
  if (t.direction !== 'NONE') {
    lines.push(`TRADE READ — ${t.direction}`);
    if (t.entry) lines.push(`  Entry:  ${formatPrice(t.entry)}`);
    if (t.stopLoss) lines.push(`  Stop:   ${formatPrice(t.stopLoss)}`);
    t.targets.forEach((tp, i) => lines.push(`  TP${i + 1}:    ${formatPrice(tp.price)}`));
    if (t.rationale) lines.push(`  Why:    ${t.rationale}`);
    lines.push('');
  }

  lines.push(a.disclaimer);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Paper-trade mapping
// ---------------------------------------------------------------------------

/** Derive a symbol like BTCUSDT from a detected pair label (e.g. "BTC/USDT"). */
export function symbolFromPair(pair: string): string {
  const cleaned = pair.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!cleaned) return 'UNKNOWN';
  if (/(USDT|USD|USDC|PERP)$/.test(cleaned)) return cleaned.replace(/PERP$/, '');
  return `${cleaned}USDT`;
}

/**
 * Turns an analysis into a ready-to-open paper trade. Fills TP2/TP3 with R
 * multiples when the model only gave one target. Throws if there aren't enough
 * levels (entry + stop) to define real risk — we never open a trade on guesses.
 */
export function paperTradeInputFromAnalysis(a: ChartAnalysis): ManualPaperTradeInput {
  const t = a.detectedTrade;
  const type: 'LONG' | 'SHORT' = (t.direction !== 'NONE' ? t.direction : a.bias === 'SHORT' ? 'SHORT' : 'LONG');

  const entry = t.entry;
  const stop = t.stopLoss;
  if (!entry || !stop) {
    throw new Error('The AI could not pin down a clear entry and stop-loss on this chart, so a paper trade cannot be opened from it.');
  }

  const risk = Math.abs(entry - stop) || entry * 0.01;
  const dir = type === 'LONG' ? 1 : -1;

  const givenTargets = t.targets.map((x) => x.price).filter((p) => p > 0);
  const t1 = givenTargets[0] ?? entry + dir * risk * 1.5;
  const t2 = givenTargets[1] ?? entry + dir * risk * 2.5;
  const t3 = givenTargets[2] ?? entry + dir * risk * 4;

  return {
    symbol: symbolFromPair(a.pair),
    pair: a.pair,
    type,
    strategy: `AI Chart Analysis${a.strategies.find((s) => s.applied) ? ` — ${a.strategies.find((s) => s.applied)!.name}` : ''}`.slice(0, 60),
    timeframe: a.timeframe && a.timeframe !== '—' ? a.timeframe : '1h',
    entryPrice: entry,
    stopLoss: stop,
    target1: +t1.toFixed(6),
    target2: +t2.toFixed(6),
    target3: +t3.toFixed(6),
    leverage: '—',
    confidenceScore: a.confidence,
  };
}
