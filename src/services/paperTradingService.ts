/**
 * Paper-trading journal — a REAL, no-risk trade tracker.
 *
 * When a user "takes" a signal, we store the exact levels the engine produced.
 * updateOpenTrades() then walks the ACTUAL Binance candles printed since the
 * trade was opened and resolves it the same way the backtest engine does:
 * first touch of TP1 = win, first touch of SL = loss (conservative: if a single
 * candle spans both, the stop is counted first). Realized R is computed from the
 * real entry/exit/stop — nothing here is simulated or random.
 *
 * Persistence is localStorage (per-device, instant, no backend needed). This is
 * the real app (not a sandboxed artifact), so localStorage is available.
 */
import { Signal } from '@/types/trading';

const BINANCE_FUTURES_URL = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT_URL = 'https://api.binance.com/api/v3';
const STORAGE_KEY = 'cotraders_paper_trades_v1';

export type PaperStatus = 'OPEN' | 'WIN' | 'LOSS';

export interface PaperTrade {
  id: string;
  symbol: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  strategy: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  leverage: string;
  confidenceScore?: number;
  openedAt: number; // ms epoch
  status: PaperStatus;
  closedAt?: number;
  exitPrice?: number;
  realizedR?: number;   // R-multiple actually realized on close
  mfeTag?: 'TP1' | 'TP2' | 'TP3' | null; // highest target the price reached
}

export interface JournalStats {
  total: number;
  open: number;
  wins: number;
  losses: number;
  winRate: number | null; // % of closed trades
  totalR: number;         // sum of realized R across closed trades
  avgR: number | null;
  bestR: number | null;
  worstR: number | null;
}

// ---- storage ----
export function getPaperTrades(): PaperTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePaperTrades(trades: PaperTrade[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.error('[paperTrading] failed to persist:', e);
  }
}

export function addPaperTradeFromSignal(signal: Signal): PaperTrade {
  const trades = getPaperTrades();
  const trade: PaperTrade = {
    id: `PT-${signal.symbol}-${Date.now()}`,
    symbol: signal.symbol,
    pair: signal.pair,
    type: signal.type,
    strategy: signal.strategy,
    timeframe: signal.timeframe,
    entryPrice: signal.entryPrice,
    stopLoss: signal.stopLoss,
    target1: signal.target1,
    target2: signal.target2,
    target3: signal.target3,
    leverage: signal.leverage,
    confidenceScore: signal.confidenceScore,
    openedAt: Date.now(),
    status: 'OPEN',
    mfeTag: null,
  };
  savePaperTrades([trade, ...trades]);
  return trade;
}

/** Input for opening a paper trade from a source that isn't a full Signal
 *  (e.g. the AI Chart Screenshot Analyzer). Only the fields the journal needs. */
export interface ManualPaperTradeInput {
  symbol: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  strategy: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  leverage?: string;
  confidenceScore?: number;
}

/**
 * Opens a paper trade from a plain level set (used by the AI Chart Analyzer).
 * Behaves exactly like addPaperTradeFromSignal — the trade is then resolved
 * against REAL Binance candles by updateOpenTrades(); nothing is simulated.
 */
export function addPaperTradeManual(input: ManualPaperTradeInput): PaperTrade {
  const trades = getPaperTrades();
  const trade: PaperTrade = {
    id: `PT-${input.symbol}-${Date.now()}`,
    symbol: input.symbol,
    pair: input.pair,
    type: input.type,
    strategy: input.strategy,
    timeframe: input.timeframe,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    target1: input.target1,
    target2: input.target2,
    target3: input.target3,
    leverage: input.leverage ?? '—',
    confidenceScore: input.confidenceScore,
    openedAt: Date.now(),
    status: 'OPEN',
    mfeTag: null,
  };
  savePaperTrades([trade, ...trades]);
  return trade;
}

export function deletePaperTrade(id: string) {
  savePaperTrades(getPaperTrades().filter(t => t.id !== id));
}

/** True if there is already an OPEN paper trade for this symbol — used by the
 *  auto-execute toggle to avoid stacking duplicate entries on every scan. */
export function hasOpenTradeForSymbol(symbol: string): boolean {
  return getPaperTrades().some(t => t.symbol === symbol && t.status === 'OPEN');
}

export function clearClosedTrades() {
  savePaperTrades(getPaperTrades().filter(t => t.status === 'OPEN'));
}

// ---- live evaluation ----
interface RawCandle { openTime: number; high: number; low: number; close: number; }

async function fetchRawKlines(symbol: string, interval: string, limit: number): Promise<RawCandle[]> {
  const url = (base: string) => `${base}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  try {
    const res =
      (await fetch(url(BINANCE_FUTURES_URL)).catch(() => null)) ??
      (await fetch(url(BINANCE_SPOT_URL)).catch(() => null));
    if (!res || !res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((c: any) => ({
      openTime: c[0],
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
    }));
  } catch {
    return [];
  }
}

function riskOf(t: PaperTrade): number {
  return Math.abs(t.entryPrice - t.stopLoss) || 1e-9;
}

function realizedR(t: PaperTrade, exitPrice: number): number {
  const risk = riskOf(t);
  const raw = t.type === 'LONG' ? (exitPrice - t.entryPrice) / risk : (t.entryPrice - exitPrice) / risk;
  return +raw.toFixed(2);
}

/**
 * Resolves every OPEN trade against the real candles printed since it opened.
 * Returns the refreshed list (and persists it). TP1-vs-SL first-touch decides
 * win/loss, matching the backtest engine exactly.
 */
export async function updateOpenTrades(): Promise<PaperTrade[]> {
  const trades = getPaperTrades();
  const open = trades.filter(t => t.status === 'OPEN');
  if (open.length === 0) return trades;

  await Promise.all(
    open.map(async (t) => {
      const ageMs = Date.now() - t.openedAt;
      // Choose a granularity that covers the trade's lifetime within ~500 bars.
      const interval = ageMs < 12 * 3600_000 ? '5m' : ageMs < 4 * 24 * 3600_000 ? '1h' : '4h';
      const candles = await fetchRawKlines(t.symbol, interval, 500);
      // Synthetic FX (no Binance listing) returns nothing — leave it OPEN.
      if (candles.length === 0) return;

      const since = candles.filter(c => c.openTime >= t.openedAt - 60_000);
      const scan = since.length > 0 ? since : candles;

      let mfeTag: PaperTrade['mfeTag'] = t.mfeTag ?? null;
      const tagRank = { TP1: 1, TP2: 2, TP3: 3 } as const;
      const bump = (tag: 'TP1' | 'TP2' | 'TP3') => {
        if (!mfeTag || tagRank[tag] > tagRank[mfeTag]) mfeTag = tag;
      };

      for (const c of scan) {
        const hitSl = t.type === 'LONG' ? c.low <= t.stopLoss : c.high >= t.stopLoss;
        const hitTp1 = t.type === 'LONG' ? c.high >= t.target1 : c.low <= t.target1;
        const hitTp2 = t.type === 'LONG' ? c.high >= t.target2 : c.low <= t.target2;
        const hitTp3 = t.type === 'LONG' ? c.high >= t.target3 : c.low <= t.target3;

        // Track how far price ran in our favour (informational).
        if (hitTp1) bump('TP1');
        if (hitTp2) bump('TP2');
        if (hitTp3) bump('TP3');

        // Conservative: stop counts first if a candle spans both levels.
        if (hitSl) {
          t.status = 'LOSS';
          t.exitPrice = t.stopLoss;
          t.realizedR = realizedR(t, t.stopLoss);
          t.closedAt = c.openTime;
          t.mfeTag = mfeTag;
          return;
        }
        if (hitTp1) {
          t.status = 'WIN';
          t.exitPrice = t.target1;
          t.realizedR = realizedR(t, t.target1);
          t.closedAt = c.openTime;
          t.mfeTag = mfeTag;
          return;
        }
      }
      // Still running — persist any favourable-excursion tag we observed.
      t.mfeTag = mfeTag;
    }),
  );

  savePaperTrades(trades);
  return trades;
}

export function computeJournalStats(trades: PaperTrade[]): JournalStats {
  const closed = trades.filter(t => t.status !== 'OPEN');
  const wins = closed.filter(t => t.status === 'WIN').length;
  const losses = closed.filter(t => t.status === 'LOSS').length;
  const rs = closed.map(t => t.realizedR ?? 0);
  const totalR = +rs.reduce((a, b) => a + b, 0).toFixed(2);

  return {
    total: trades.length,
    open: trades.filter(t => t.status === 'OPEN').length,
    wins,
    losses,
    winRate: closed.length > 0 ? +((wins / closed.length) * 100).toFixed(1) : null,
    totalR,
    avgR: closed.length > 0 ? +(totalR / closed.length).toFixed(2) : null,
    bestR: rs.length > 0 ? Math.max(...rs) : null,
    worstR: rs.length > 0 ? Math.min(...rs) : null,
  };
}
