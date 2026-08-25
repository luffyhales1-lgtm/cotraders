/**
 * FREE, keyless whale tracker powered entirely by Hyperliquid's PUBLIC
 * WebSocket API (wss://api.hyperliquid.xyz/ws).
 *
 * Hyperliquid streams every fill on its perp DEX in real time with no API key
 * and no rate-limit gymnastics. We subscribe to the `trades` channel for the
 * most liquid coins, keep only fills at/above a USD "whale" threshold, and hold
 * them in a rolling in-memory buffer. This completely replaces the old paid
 * CoinGlass edge function (which required a premium key the user doesn't have).
 *
 * Everything runs in the browser — no Supabase function, no secret key, no
 * server cost. The data is genuinely live: it's the exchange's own trade feed.
 */

export interface WhaleEvent {
  id: string;
  source: 'hyperliquid' | 'chain';
  timestamp: number; // unix seconds
  asset: string;
  action: 'BUY' | 'SELL' | 'TRANSFER';
  usdValue: number;
  amount: number;
  price: number;
  wallet: string; // shortened to first6...last4
  detail?: string;
}

export interface WhaleTrackerResponse {
  events: WhaleEvent[];
  sourceErrors: {
    hyperliquid: string | null;
    chain: string | null;
  };
  fetchedAt: string; // ISO timestamp
}

export class WhaleTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhaleTrackerError';
  }
}

// --- Tunables -------------------------------------------------------------
const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';
// Hyperliquid gets thousands of small fills per minute, so a $10k floor would
// bury real whales in noise. We surface genuinely large fills; tune here.
const MIN_WHALE_USD = 50_000;
const BUFFER_LIMIT = 60; // keep the most recent N whale fills
// Most liquid Hyperliquid perps — the coins whales actually move size in.
const WATCH_COINS = [
  'BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'DOGE', 'SUI', 'AVAX',
  'BNB', 'LINK', 'LTC', 'ARB', 'OP', 'WLD', 'PEPE', 'AAVE',
];

// --- Module-level singleton stream ---------------------------------------
let ws: WebSocket | null = null;
let connecting = false;
let connectionError: string | null = null;
let buffer: WhaleEvent[] = [];
const seenHashes = new Set<string>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let firstDataResolvers: Array<() => void> = [];

function shortWallet(addr?: string): string {
  if (!addr || addr.length < 12) return addr || 'unknown';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function handleTrades(trades: any[]) {
  let added = false;
  for (const t of trades) {
    const px = parseFloat(t.px);
    const sz = parseFloat(t.sz);
    if (!isFinite(px) || !isFinite(sz)) continue;
    const usd = px * sz;
    if (usd < MIN_WHALE_USD) continue;

    const hash: string = t.hash ?? `${t.coin}-${t.tid ?? t.time}`;
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    // side "B" = aggressor bought (BUY), "A" = aggressor sold (SELL)
    const action: WhaleEvent['action'] = t.side === 'B' ? 'BUY' : 'SELL';
    const users: string[] = Array.isArray(t.users) ? t.users : [];

    const event: WhaleEvent = {
      id: hash,
      source: 'hyperliquid',
      timestamp: Math.floor((t.time ?? Date.now()) / 1000),
      asset: t.coin ?? '?',
      action,
      usdValue: usd,
      amount: sz,
      price: px,
      wallet: shortWallet(users[0]),
      detail: `${action === 'BUY' ? 'Market buy' : 'Market sell'} on Hyperliquid perps`,
    };

    buffer.unshift(event);
    added = true;
  }

  if (added) {
    buffer = buffer.slice(0, BUFFER_LIMIT);
    // Keep the dedupe set from growing unbounded.
    if (seenHashes.size > 4000) seenHashes.clear();
    // Wake up any callers waiting for the first batch of data.
    if (firstDataResolvers.length) {
      firstDataResolvers.forEach(r => r());
      firstDataResolvers = [];
    }
  }
}

function subscribeAll(sock: WebSocket) {
  for (const coin of WATCH_COINS) {
    sock.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }));
  }
}

function ensureWhaleStream(): void {
  if (typeof WebSocket === 'undefined') {
    connectionError = 'WebSocket is not available in this environment.';
    return;
  }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (connecting) return;

  connecting = true;
  try {
    ws = new WebSocket(HL_WS_URL);
  } catch (e: any) {
    connecting = false;
    connectionError = e?.message ?? 'Failed to open Hyperliquid stream.';
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    connecting = false;
    connectionError = null;
    if (ws) subscribeAll(ws);
    // Heartbeat: Hyperliquid supports { method: 'ping' } -> { channel: 'pong' }.
    // Keeps the socket alive during quiet spells when no large fills stream in.
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ method: 'ping' })); } catch { /* ignore */ }
      }
    }, 30000);
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg?.channel === 'trades' && Array.isArray(msg.data)) {
        handleTrades(msg.data);
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onerror = () => {
    connectionError = 'Hyperliquid stream connection error — retrying…';
  };

  ws.onclose = () => {
    connecting = false;
    ws = null;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureWhaleStream();
  }, 4000);
}

/**
 * Returns a snapshot of the most recent whale fills. Opens the live stream on
 * first call and, if the buffer is still empty (just connected), waits briefly
 * for the first fills to arrive so the UI isn't blank. Never fabricates data:
 * if the stream can't connect it reports the error in `sourceErrors`.
 */
export async function fetchWhaleTrackerData(): Promise<WhaleTrackerResponse> {
  ensureWhaleStream();

  // If we have nothing yet, give the socket a short window to deliver a batch.
  if (buffer.length === 0 && !connectionError) {
    await new Promise<void>((resolve) => {
      firstDataResolvers.push(resolve);
      setTimeout(resolve, 5000); // cap the wait
    });
  }

  return {
    events: buffer.slice(),
    sourceErrors: {
      hyperliquid: connectionError,
      chain: null,
    },
    fetchedAt: new Date().toISOString(),
  };
}
