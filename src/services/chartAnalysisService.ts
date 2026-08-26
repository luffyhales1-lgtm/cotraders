import { supabase } from '@/integrations/supabase/client';
import { ManualPaperTradeInput } from '@/services/paperTradingService';

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
 * Sends a chart screenshot (data-URL or raw base64) to the analyzer edge
 * function and returns a normalised ChartAnalysis. Throws a friendly Error if
 * the function isn't deployed / no vision key is configured, so the UI can tell
 * the user exactly what to do rather than showing fake results.
 */
export async function analyzeChartImage(
  imageDataUrl: string,
  ctx: AnalyzeContext = {},
): Promise<ChartAnalysis> {
  if (!imageDataUrl) throw new Error('Please upload a chart screenshot first.');

  const { data, error } = await supabase.functions.invoke('analyze-chart', {
    body: { image: imageDataUrl, context: ctx },
  });

  if (error) {
    // Supabase surfaces non-2xx as an error; try to read the function's message.
    let detail = '';
    try {
      // @ts-ignore - context is present on FunctionsHttpError
      const res = error?.context;
      if (res && typeof res.json === 'function') {
        const body = await res.json();
        detail = body?.error || body?.message || '';
      }
    } catch { /* ignore */ }

    throw new Error(
      detail ||
        'AI analysis is not available yet. Deploy the "analyze-chart" edge function and set a vision API key (OPENAI_API_KEY or GEMINI_API_KEY) in your Supabase project. See SETUP_AI_CHART_ANALYSIS.md.',
    );
  }

  if (!data || (data as any).error) {
    throw new Error((data as any)?.error || 'The analyzer returned no result. Please try another screenshot.');
  }

  return normalise((data as any).analysis ?? data, ctx);
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
