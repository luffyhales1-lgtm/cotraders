import { CoinTicker, CandleData } from '@/types/trading';

/**
 * LIVE FOREX service.
 *
 * Binance lists no spot FX pairs, so real forex majors come from Yahoo Finance's
 * public chart endpoint (query1.finance.yahoo.com/v8/finance/chart/<sym>=X),
 * which returns genuine intraday OHLC candles for free with no API key. Yahoo
 * doesn't send permissive CORS headers, so browser calls are routed through the
 * same public CORS proxies the news service uses, with a direct attempt first.
 *
 * Nothing here is fabricated: if every route fails we return an empty result so
 * the scanner simply skips FX that cycle (never a synthetic candle / fake rate).
 */

// Internal symbol -> human pair. These are the FX majors + popular crosses.
export const FOREX_MAJORS: { symbol: string; pair: string; base: string; quote: string }[] = [
  { symbol: 'EURUSD', pair: 'EUR/USD (FX)', base: 'EUR', quote: 'USD' },
  { symbol: 'GBPUSD', pair: 'GBP/USD (FX)', base: 'GBP', quote: 'USD' },
  { symbol: 'USDJPY', pair: 'USD/JPY (FX)', base: 'USD', quote: 'JPY' },
  { symbol: 'AUDUSD', pair: 'AUD/USD (FX)', base: 'AUD', quote: 'USD' },
  { symbol: 'USDCAD', pair: 'USD/CAD (FX)', base: 'USD', quote: 'CAD' },
  { symbol: 'USDCHF', pair: 'USD/CHF (FX)', base: 'USD', quote: 'CHF' },
  { symbol: 'NZDUSD', pair: 'NZD/USD (FX)', base: 'NZD', quote: 'USD' },
  { symbol: 'EURJPY', pair: 'EUR/JPY (FX)', base: 'EUR', quote: 'JPY' },
  { symbol: 'GBPJPY', pair: 'GBP/JPY (FX)', base: 'GBP', quote: 'JPY' },
];

const FOREX_SYMBOL_SET = new Set(FOREX_MAJORS.map(f => f.symbol));

/** True if a symbol should be resolved via the forex feed, not Binance. */
export function isForexSymbol(symbol: string): boolean {
  return FOREX_SYMBOL_SET.has(symbol);
}

// Public CORS proxies (same resilient pattern as newsService/telegramService).
const CORS_PROXIES: ((u: string) => string)[] = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

async function fetchAbortable(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Map the app's interval to Yahoo's {interval, range}. Yahoo has no 4h. */
function yahooParams(interval: string): { interval: string; range: string } {
  switch (interval) {
    case '1m': return { interval: '1m', range: '1d' };
    case '5m': return { interval: '5m', range: '5d' };
    case '15m': return { interval: '15m', range: '5d' };
    case '1h': return { interval: '60m', range: '1mo' };
    case '4h': return { interval: '60m', range: '1mo' };
    case '1d': return { interval: '1d', range: '6mo' };
    default: return { interval: '15m', range: '5d' };
  }
}

/** Fetch Yahoo chart JSON for a =X FX symbol, trying direct then proxies. */
async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<any | null> {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}=X?interval=${interval}&range=${range}`;
  // 1) direct
  try {
    const res = await fetchAbortable(target, 7000);
    if (res.ok) {
      const j = await res.json();
      if (j?.chart?.result?.[0]) return j;
    }
  } catch { /* fall through */ }
  // 2) proxies
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetchAbortable(proxy(target), 7000);
      if (!res.ok) continue;
      const raw = await res.text();
      const j = JSON.parse(raw);
      if (j?.chart?.result?.[0]) return j;
    } catch { /* try next */ }
  }
  return null;
}

/** Parse a Yahoo chart JSON into the app's CandleData[] (newest last). */
function parseYahooCandles(json: any, limit: number): CandleData[] {
  try {
    const result = json.chart.result[0];
    const ts: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const opens: (number | null)[] = q.open || [];
    const highs: (number | null)[] = q.high || [];
    const lows: (number | null)[] = q.low || [];
    const closes: (number | null)[] = q.close || [];
    const vols: (number | null)[] = q.volume || [];

    const out: CandleData[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
      // Yahoo pads gaps with nulls (weekends / illiquid minutes) — skip them.
      if (o == null || h == null || l == null || c == null) continue;
      out.push({
        time: new Date(ts[i] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: o, high: h, low: l, close: c,
        volume: vols[i] ?? 0,
        takerBuyVolume: (vols[i] ?? 0) / 2,
      });
    }
    return out.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Live FX candles for a major, newest last, in the app's CandleData shape.
 * Returns [] on any failure so the signal engine skips the symbol (no fakery).
 */
export async function fetchForexKlines(symbol: string, interval = '15m', limit = 90): Promise<CandleData[]> {
  const { interval: yi, range } = yahooParams(interval);
  const json = await fetchYahooChart(symbol, yi, range);
  if (!json) return [];
  return parseYahooCandles(json, limit);
}

/**
 * A FULL YEAR of real daily FX candles for a major (Yahoo range=1y). Used by the
 * whole-website 1-year backtest so forex is measured over the same horizon as
 * crypto. Returns [] on failure so the symbol is simply skipped (never faked).
 */
export async function fetchForexDailyYear(symbol: string, limit = 370): Promise<CandleData[]> {
  const json = await fetchYahooChart(symbol, '1d', '1y');
  if (!json) return [];
  return parseYahooCandles(json, limit);
}

/**
 * Live FX tickers (last price + 24h-ish change) for the majors, so forex shows
 * in the scanner table and ticker tape alongside crypto. Uses one lightweight
 * daily-candle call per symbol; returns only the pairs that resolved live.
 */
let forexTickerCache: { data: CoinTicker[]; at: number } | null = null;
const FX_TICKER_TTL = 60 * 1000;

export async function fetchForexTickers(): Promise<CoinTicker[]> {
  if (forexTickerCache && Date.now() - forexTickerCache.at < FX_TICKER_TTL) {
    return forexTickerCache.data;
  }
  const results = await Promise.all(
    FOREX_MAJORS.map(async (m): Promise<CoinTicker | null> => {
      const json = await fetchYahooChart(m.symbol, '1d', '5d');
      if (!json) return null;
      try {
        const r = json.chart.result[0];
        const meta = r.meta || {};
        const q = r.indicators?.quote?.[0] || {};
        const closes: (number | null)[] = (q.close || []).filter((x: number | null) => x != null);
        const highs: (number | null)[] = (q.high || []).filter((x: number | null) => x != null);
        const lows: (number | null)[] = (q.low || []).filter((x: number | null) => x != null);
        const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
        const prev = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
        const change = prev ? ((price - prev) / prev) * 100 : 0;
        if (!price) return null;
        return {
          symbol: m.symbol,
          pair: m.pair,
          baseAsset: m.base,
          quoteAsset: m.quote,
          price,
          change24h: change,
          high24h: highs.length ? Math.max(...highs) : price,
          low24h: lows.length ? Math.min(...lows) : price,
          volume24h: 0,
          isFutures: false,
        };
      } catch {
        return null;
      }
    }),
  );
  const live = results.filter((x): x is CoinTicker => x !== null);
  if (live.length > 0) forexTickerCache = { data: live, at: Date.now() };
  return live;
}
