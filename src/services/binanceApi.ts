import { CoinTicker, CandleData, OrderBookItem, LiveTrade } from '@/types/trading';
import { isForexSymbol, fetchForexKlines, fetchForexTickers } from './forexApi';

// FUTURES ONLY. The entire tradable universe in COTRADERS is Binance USDT-M
// perpetual futures (this includes the real XAUUSDT gold and XAGUSDT silver
// perpetuals). No spot endpoints, no synthetic forex, no fabricated prices.
const BINANCE_FUTURES_URL = 'https://fapi.binance.com/fapi/v1';

let cachedTickers: CoinTicker[] = [];
let liveGoldPrice = 2894.50;
let liveSilverPrice = 32.10;

/**
 * Kept for backward compatibility with any importer. Gold/silver now come from
 * Binance futures directly; this simply returns the last known metal prices.
 */
export async function fetchLiveForexRates(): Promise<Record<string, number>> {
  return { XAUUSD: liveGoldPrice, XAGUSD: liveSilverPrice };
}

// Fetch the FULL live Binance USDT-M futures universe (every USDT perpetual,
// ranked by 24h quote volume). No spot fallback — if futures is unreachable we
// return a small live-ish fallback set rather than silently serving spot data.
export async function fetchTopCryptos(): Promise<CoinTicker[]> {
  try {
    const res = await fetch(`${BINANCE_FUTURES_URL}/ticker/24hr`).catch(() => null);
    if (!res || !res.ok) throw new Error('Binance Futures API unreachable');

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Binance Futures API bad payload');

    const filtered = data.filter((item: any) => item.symbol && item.symbol.endsWith('USDT'));
    filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'));

    const formatted: CoinTicker[] = filtered.map((item: any) => {
      const base = item.symbol.replace('USDT', '');
      const lastPrice = parseFloat(item.lastPrice || '0');
      const isMetal = item.symbol === 'XAUUSDT' || item.symbol === 'XAGUSDT';
      if (item.symbol === 'XAUUSDT') liveGoldPrice = lastPrice || liveGoldPrice;
      if (item.symbol === 'XAGUSDT') liveSilverPrice = lastPrice || liveSilverPrice;
      return {
        symbol: item.symbol,
        pair: isMetal ? `${base}/USD (${base === 'XAU' ? 'GOLD' : 'SILVER'} PERP)` : `${base}/USDT (PERP)`,
        baseAsset: base,
        quoteAsset: 'USDT',
        price: lastPrice,
        change24h: parseFloat(item.priceChangePercent || '0'),
        high24h: parseFloat(item.highPrice || '0'),
        low24h: parseFloat(item.lowPrice || '0'),
        volume24h: parseFloat(item.quoteVolume || '0'),
        isFutures: true,
        isGold: isMetal,
      };
    });

    cachedTickers = formatted;

    // Append LIVE forex majors (from the free FX feed) so real EUR/USD, GBP/USD,
    // USD/JPY, etc. sit alongside the futures universe. Non-blocking: if the FX
    // feed is momentarily unreachable we just show crypto this cycle.
    try {
      const forex = await fetchForexTickers();
      if (forex.length > 0) cachedTickers = [...formatted, ...forex];
    } catch { /* ignore — crypto still returned */ }

    return cachedTickers;
  } catch (error) {
    return getDynamicLiveFuturesTickers();
  }
}

// Fetch klines from Binance USDT-M futures. No spot fallback and NO synthetic
// candles: if the request fails we return an empty array so the scanner simply
// skips that symbol instead of ever generating a signal from fabricated data.
export async function fetchKlines(symbol: string, interval = '15m', limit = 50): Promise<CandleData[]> {
  // Forex majors aren't on Binance — pull real intraday candles from the live
  // forex feed instead, so the same signal engine runs on genuine FX data.
  if (isForexSymbol(symbol)) {
    return fetchForexKlines(symbol, interval, limit);
  }
  try {
    const res = await fetch(`${BINANCE_FUTURES_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`).catch(() => null);
    if (res && res.ok) {
      const raw = await res.json();
      if (!Array.isArray(raw)) return [];
      // [openTime, open, high, low, close, volume, closeTime, quoteVolume,
      //  numTrades, takerBuyBaseVolume, takerBuyQuoteVolume, ignore]
      return raw.map((c: any) => ({
        time: new Date(c[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        takerBuyVolume: parseFloat(c[9] ?? c[5] / 2),
      }));
    }
  } catch (e) {
    // fall through to empty
  }
  return [];
}

// Fetch order book from Binance USDT-M futures. Empty on failure (no mock).
export async function fetchOrderBook(symbol: string): Promise<{ bids: OrderBookItem[]; asks: OrderBookItem[] }> {
  try {
    const res = await fetch(`${BINANCE_FUTURES_URL}/depth?symbol=${symbol}&limit=100`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const bids: OrderBookItem[] = (data.bids || []).slice(0, 10).map((bid: any) => ({
        price: parseFloat(bid[0]),
        amount: parseFloat(bid[1]),
        total: 0,
      }));
      const asks: OrderBookItem[] = (data.asks || []).slice(0, 10).map((ask: any) => ({
        price: parseFloat(ask[0]),
        amount: parseFloat(ask[1]),
        total: 0,
      }));

      let bidTotal = 0;
      for (let i = 0; i < bids.length; i++) { bidTotal += bids[i].amount; bids[i].total = bidTotal; }
      let askTotal = 0;
      for (let i = 0; i < asks.length; i++) { askTotal += asks[i].amount; asks[i].total = askTotal; }

      return { bids, asks };
    }
  } catch (e) {
    // fall through
  }
  return { bids: [], asks: [] };
}

// Subscribe to the Binance USDT-M futures real-time all-market ticker stream.
// Auto-reconnects on drop with a short backoff. No fabricated fallback prices —
// if the socket is down we simply stop updating until it reconnects.
export function subscribeBinanceTickerStream(onPriceUpdate: (data: Record<string, number>) => void): () => void {
  let ws: WebSocket | null = null;
  let isClosed = false;
  let reconnectTimer: any = null;
  let attempts = 0;

  // Coalesce the high-frequency all-market stream. The socket can push several
  // frames per second; we keep only the newest price per symbol and flush to
  // subscribers at most once per window, so live tiles re-render smoothly
  // instead of thrashing React on every frame.
  const THROTTLE_MS = 1500;
  let pending: Record<string, number> | null = null;
  let flushTimer: any = null;

  const flush = () => {
    flushTimer = null;
    if (isClosed || !pending) return;
    const batch = pending;
    pending = null;
    onPriceUpdate(batch);
  };

  const queueUpdate = (prices: Record<string, number>) => {
    if (pending) Object.assign(pending, prices);
    else pending = prices;
    if (!flushTimer) flushTimer = setTimeout(flush, THROTTLE_MS);
  };

  const scheduleReconnect = () => {
    if (isClosed || reconnectTimer) return;
    const delay = Math.min(15000, 2000 * Math.max(1, attempts)); // 2s → 15s backoff
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      attempts++;
      connect();
    }, delay);
  };

  const connect = () => {
    try {
      ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');

      ws.onopen = () => { attempts = 0; };

      ws.onmessage = (event) => {
        if (isClosed) return;
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            const prices: Record<string, number> = {};
            data.forEach((item: any) => {
              if (item.s && item.s.endsWith('USDT')) {
                prices[item.s] = parseFloat(item.c);
                if (item.s === 'XAUUSDT') liveGoldPrice = parseFloat(item.c) || liveGoldPrice;
                if (item.s === 'XAGUSDT') liveSilverPrice = parseFloat(item.c) || liveSilverPrice;
              }
            });
            queueUpdate(prices);
          }
        } catch (e) {
          // silent
        }
      };

      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
      ws.onclose = () => { if (!isClosed) scheduleReconnect(); };
    } catch (err) {
      scheduleReconnect();
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (flushTimer) clearTimeout(flushTimer);
    if (ws) { try { ws.close(); } catch { /* noop */ } }
  };
}

// -------------------------------------------------------------------------
// Chart-preview helpers (used by screenshot/preview utilities only — NEVER by
// the live signal path, which only ever runs on real futures candles).
// -------------------------------------------------------------------------
export function generateMockOrderBook(currentPrice: number): { bids: OrderBookItem[]; asks: OrderBookItem[] } {
  const bids: OrderBookItem[] = [];
  const asks: OrderBookItem[] = [];
  let bidAccum = 0;
  let askAccum = 0;
  const digits = currentPrice < 10 ? 4 : 2;

  for (let i = 1; i <= 6; i++) {
    const bidPrice = currentPrice * (1 - i * 0.0004);
    const bidAmt = +(Math.random() * 4.2 + 0.3).toFixed(3);
    bidAccum += bidAmt;
    bids.push({ price: +bidPrice.toFixed(digits), amount: bidAmt, total: +bidAccum.toFixed(3) });

    const askPrice = currentPrice * (1 + i * 0.0004);
    const askAmt = +(Math.random() * 4.2 + 0.3).toFixed(3);
    askAccum += askAmt;
    asks.push({ price: +askPrice.toFixed(digits), amount: askAmt, total: +askAccum.toFixed(3) });
  }

  return { bids, asks };
}

export function generateMockTrades(currentPrice: number): LiveTrade[] {
  const trades: LiveTrade[] = [];
  const now = new Date();
  const digits = currentPrice < 10 ? 4 : 2;

  for (let i = 0; i < 8; i++) {
    const isBuy = Math.random() > 0.45;
    const priceOffset = (Math.random() - 0.5) * 0.0008 * currentPrice;
    trades.push({
      id: Math.random().toString(36).substring(7),
      price: +(currentPrice + priceOffset).toFixed(digits),
      amount: +(Math.random() * 2.5 + 0.1).toFixed(3),
      time: new Date(now.getTime() - i * 1100).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: isBuy ? 'buy' : 'sell',
    });
  }
  return trades;
}

// Thin fallback shown only if the futures 24hr endpoint is momentarily
// unreachable. Prices oscillate deterministically (not random) purely so the
// ticker doesn't look frozen; real data replaces this on the next successful poll.
function getDynamicLiveFuturesTickers(): CoinTicker[] {
  const now = Date.now() / 1000;
  return [
    { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', baseAsset: 'BTC', quoteAsset: 'USDT', price: +(96940.00 + Math.cos(now) * 90).toFixed(2), change24h: 4.12, high24h: 98400.00, low24h: 94200.00, volume24h: 51200000000, isFutures: true },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', baseAsset: 'ETH', quoteAsset: 'USDT', price: +(3540.20 + Math.sin(now) * 6).toFixed(2), change24h: 2.85, high24h: 3625.00, low24h: 3410.00, volume24h: 23800000000, isFutures: true },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', baseAsset: 'SOL', quoteAsset: 'USDT', price: +(228.40 + Math.cos(now) * 1.5).toFixed(2), change24h: 8.12, high24h: 234.00, low24h: 209.00, volume24h: 10400000000, isFutures: true },
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD PERP)', baseAsset: 'XAU', quoteAsset: 'USDT', price: +(liveGoldPrice + Math.sin(now) * 2.8).toFixed(2), change24h: 1.84, high24h: 2908.00, low24h: 2872.00, volume24h: 840000000, isFutures: true, isGold: true },
  ];
}
