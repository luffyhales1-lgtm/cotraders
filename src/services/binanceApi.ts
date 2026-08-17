import { CoinTicker, CandleData, OrderBookItem, LiveTrade } from '@/types/trading';

const BINANCE_FUTURES_URL = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT_URL = 'https://api.binance.com/api/v3';

let cachedTickers: CoinTicker[] = [];
let liveGoldPrice = 2894.50;
let liveSilverPrice = 32.10;

// Fetch Live Forex & Metals Spot API
export async function fetchLiveForexRates(): Promise<Record<string, number>> {
  const forexPrices: Record<string, number> = {
    'XAUUSD': liveGoldPrice,
    'XAGUSD': liveSilverPrice,
    'EURUSD': 1.0845,
    'GBPUSD': 1.2980,
    'USDJPY': 152.40,
  };

  try {
    const goldRes = await fetch('https://api.gold-api.com/price/XAU').catch(() => null);
    if (goldRes && goldRes.ok) {
      const gData = await goldRes.json();
      if (gData && typeof gData.price === 'number' && gData.price > 1000) {
        liveGoldPrice = +gData.price.toFixed(2);
        forexPrices['XAUUSD'] = liveGoldPrice;
      }
    }

    // Silver spot -- same provider, XAG ticker. If this endpoint ever goes
    // down or 404s, we silently fall back to the last known/default price
    // rather than breaking the whole scan cycle.
    const silverRes = await fetch('https://api.gold-api.com/price/XAG').catch(() => null);
    if (silverRes && silverRes.ok) {
      const sData = await silverRes.json();
      if (sData && typeof sData.price === 'number' && sData.price > 5) {
        liveSilverPrice = +sData.price.toFixed(3);
        forexPrices['XAGUSD'] = liveSilverPrice;
      }
    }

    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD').catch(() => null);
    if (fxRes && fxRes.ok) {
      const fxData = await fxRes.json();
      if (fxData && fxData.rates) {
        if (fxData.rates.EUR) forexPrices['EURUSD'] = +(1 / fxData.rates.EUR).toFixed(4);
        if (fxData.rates.GBP) forexPrices['GBPUSD'] = +(1 / fxData.rates.GBP).toFixed(4);
        if (fxData.rates.JPY) forexPrices['USDJPY'] = +fxData.rates.JPY.toFixed(2);
        if (fxData.rates.XAU) {
          liveGoldPrice = +(1 / fxData.rates.XAU).toFixed(2);
          forexPrices['XAUUSD'] = liveGoldPrice;
        }
        if (fxData.rates.XAG) {
          liveSilverPrice = +(1 / fxData.rates.XAG).toFixed(3);
          forexPrices['XAGUSD'] = liveSilverPrice;
        }
      }
    }
  } catch (e) {
    // fallback
  }

  return forexPrices;
}

// Fetch Binance Futures Live Tickers
export async function fetchTopCryptos(): Promise<CoinTicker[]> {
  try {
    const forex = await fetchLiveForexRates();

    const forexTickers: CoinTicker[] = [
      {
        symbol: 'XAUUSDT',
        pair: 'XAU/USD (GOLD SPOT)',
        baseAsset: 'XAU',
        quoteAsset: 'USD',
        price: forex['XAUUSD'],
        change24h: 1.84,
        high24h: +(forex['XAUUSD'] + 14.20).toFixed(2),
        low24h: +(forex['XAUUSD'] - 16.80).toFixed(2),
        volume24h: 840000000,
        isGold: true,
      },
      {
        symbol: 'XAGUSDT',
        pair: 'XAG/USD (SILVER SPOT)',
        baseAsset: 'XAG',
        quoteAsset: 'USD',
        price: forex['XAGUSD'],
        change24h: 1.12,
        high24h: +(forex['XAGUSD'] + 0.45).toFixed(3),
        low24h: +(forex['XAGUSD'] - 0.55).toFixed(3),
        volume24h: 210000000,
        isGold: true,
      },
      {
        symbol: 'EURUSD',
        pair: 'EUR/USD (FOREX)',
        baseAsset: 'EUR',
        quoteAsset: 'USD',
        price: forex['EURUSD'],
        change24h: 0.42,
        high24h: +(forex['EURUSD'] * 1.005).toFixed(4),
        low24h: +(forex['EURUSD'] * 0.995).toFixed(4),
        volume24h: 1250000000,
      },
      {
        symbol: 'GBPUSD',
        pair: 'GBP/USD (FOREX)',
        baseAsset: 'GBP',
        quoteAsset: 'USD',
        price: forex['GBPUSD'],
        change24h: 0.28,
        high24h: +(forex['GBPUSD'] * 1.004).toFixed(4),
        low24h: +(forex['GBPUSD'] * 0.996).toFixed(4),
        volume24h: 980000000,
      },
      {
        symbol: 'USDJPY',
        pair: 'USD/JPY (FOREX)',
        baseAsset: 'USD',
        quoteAsset: 'JPY',
        price: forex['USDJPY'],
        change24h: -0.15,
        high24h: +(forex['USDJPY'] * 1.003).toFixed(2),
        low24h: +(forex['USDJPY'] * 0.997).toFixed(2),
        volume24h: 1100000000,
      }
    ];

    // Binance Futures 24hr Ticker Live Endpoint
    let res = await fetch(`${BINANCE_FUTURES_URL}/ticker/24hr`).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${BINANCE_SPOT_URL}/ticker/24hr`).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      const filtered = data.filter((item: any) => item.symbol && item.symbol.endsWith('USDT'));
      filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'));

      // Binance Futures lists roughly 400-500 USDT-margined perpetuals total --
      // that's the real maximum available (there's no way to reach "2000" on
      // this exchange). We return all of them here instead of an arbitrary
      // top-100 cap, so the scanner page can search/filter the full list.
      const formatted: CoinTicker[] = filtered.map((item: any) => {
        const base = item.symbol.replace('USDT', '');
        const lastPrice = parseFloat(item.lastPrice || '0');
        return {
          symbol: item.symbol,
          pair: `${base}/USDT (PERP)`,
          baseAsset: base,
          quoteAsset: 'USDT',
          price: lastPrice,
          change24h: parseFloat(item.priceChangePercent || '0'),
          high24h: parseFloat(item.highPrice || '0'),
          low24h: parseFloat(item.lowPrice || '0'),
          volume24h: parseFloat(item.quoteVolume || '0'),
          isFutures: true,
        };
      });

      cachedTickers = [...forexTickers, ...formatted];
      return cachedTickers;
    }

    throw new Error('Binance Futures API Error');
  } catch (error) {
    return getDynamicLiveFuturesTickers();
  }
}

// Symbols with no real OHLC feed wired in (Binance only lists crypto pairs).
// Candles for these are a synthetic random-walk seeded off the live spot
// price above -- NOT real historical data. Strategy signals fired on these
// symbols are illustrative only, not backtested against real history.
const SYNTHETIC_SYMBOLS: Record<string, number> = {
  XAUUSDT: 0, // resolved to liveGoldPrice at call time
  XAGUSDT: 0, // resolved to liveSilverPrice at call time
  EURUSD: 1.0845,
  GBPUSD: 1.2980,
  USDJPY: 152.40,
};

// Fetch Klines from Binance Futures API
export async function fetchKlines(symbol: string, interval = '15m', limit = 50): Promise<CandleData[]> {
  if (symbol in SYNTHETIC_SYMBOLS) {
    const base = symbol === 'XAUUSDT' ? liveGoldPrice
      : symbol === 'XAGUSDT' ? liveSilverPrice
      : SYNTHETIC_SYMBOLS[symbol];
    return generateGoldCandles(limit, base);
  }

  try {
    const res = await fetch(`${BINANCE_FUTURES_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
      .catch(() => fetch(`${BINANCE_SPOT_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`));

    if (res && res.ok) {
      const raw = await res.json();
      // Binance kline array: [openTime, open, high, low, close, volume, closeTime,
      // quoteVolume, numTrades, takerBuyBaseVolume, takerBuyQuoteVolume, ignore]
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
    // fallback
  }

  return generateGoldCandles(limit, symbol === 'BTCUSDT' ? 96940 : 250);
}

// Fetch Order Book from Binance Futures API
export async function fetchOrderBook(symbol: string): Promise<{ bids: OrderBookItem[]; asks: OrderBookItem[] }> {
  if (symbol in SYNTHETIC_SYMBOLS) {
    const base = symbol === 'XAUUSDT' ? liveGoldPrice
      : symbol === 'XAGUSDT' ? liveSilverPrice
      : SYNTHETIC_SYMBOLS[symbol];
    return generateMockOrderBook(base);
  }

  try {
    const res = await fetch(`${BINANCE_FUTURES_URL}/depth?symbol=${symbol}&limit=100`)
      .catch(() => fetch(`${BINANCE_SPOT_URL}/depth?symbol=${symbol}&limit=100`));

    if (res && res.ok) {
      const data = await res.json();
      
      const bids: OrderBookItem[] = data.bids.slice(0, 10).map((bid: any) => ({
        price: parseFloat(bid[0]),
        amount: parseFloat(bid[1]),
        total: 0 // Will be calculated below
      }));
      
      const asks: OrderBookItem[] = data.asks.slice(0, 10).map((ask: any) => ({
        price: parseFloat(ask[0]),
        amount: parseFloat(ask[1]),
        total: 0 // Will be calculated below
      }));
      
      // Calculate cumulative totals
      let bidTotal = 0;
      for (let i = 0; i < bids.length; i++) {
        bidTotal += bids[i].amount;
        bids[i].total = bidTotal;
      }
      
      let askTotal = 0;
      for (let i = 0; i < asks.length; i++) {
        askTotal += asks[i].amount;
        asks[i].total = askTotal;
      }
      
      return { bids, asks };
    }
  } catch (e) {
    // fallback to mock data
    const basePrice = symbol === 'XAUUSDT' ? liveGoldPrice : 1.0845;
    return generateMockOrderBook(basePrice);
  }

  // Fallback
  const basePrice = symbol === 'XAUUSDT' ? liveGoldPrice : 1.0845;
  return generateMockOrderBook(basePrice);
}

// Subscribe to Binance Futures Real-Time WebSocket Stream
export function subscribeBinanceTickerStream(onPriceUpdate: (data: Record<string, number>) => void): () => void {
  let ws: WebSocket | null = null;
  let isClosed = false;
  let fallbackInterval: any = null;

  const connect = () => {
    try {
      // Binance Futures Real-Time WebSocket Stream
      ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');

      ws.onmessage = (event) => {
        if (isClosed) return;
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            const prices: Record<string, number> = {};
            data.forEach((item: any) => {
              if (item.s && item.s.endsWith('USDT')) {
                prices[item.s] = parseFloat(item.c);
              }
            });

            // Live metals/forex tick jitter (synthetic -- no real feed for these)
            liveGoldPrice = +(liveGoldPrice + (Math.random() - 0.49) * 0.12).toFixed(2);
            liveSilverPrice = +(liveSilverPrice + (Math.random() - 0.49) * 0.02).toFixed(3);
            prices['XAUUSDT'] = liveGoldPrice;
            prices['XAGUSDT'] = liveSilverPrice;
            prices['EURUSD'] = +(1.0845 + (Math.random() - 0.49) * 0.0008).toFixed(4);
            prices['GBPUSD'] = +(1.2980 + (Math.random() - 0.49) * 0.0009).toFixed(4);
            prices['USDJPY'] = +(152.40 + (Math.random() - 0.49) * 0.08).toFixed(2);

            onPriceUpdate(prices);
          }
        } catch (e) {
          // silent
        }
      };

      ws.onerror = () => startFallback();
    } catch (err) {
      startFallback();
    }
  };

  const startFallback = () => {
    if (fallbackInterval) return;
    fallbackInterval = setInterval(() => {
      if (isClosed) return;
      const ticks: Record<string, number> = {};
      cachedTickers.forEach(t => {
        const delta = (Math.random() - 0.49) * 0.0012 * t.price;
        t.price = +(t.price + delta).toFixed(t.price < 1 ? 4 : 2);
        ticks[t.symbol] = t.price;
      });
      ticks['XAUUSDT'] = liveGoldPrice;
      onPriceUpdate(ticks);
    }, 1000);
  };

  connect();

  return () => {
    isClosed = true;
    if (ws) ws.close();
    if (fallbackInterval) clearInterval(fallbackInterval);
  };
}

function generateGoldCandles(limit: number, startPrice: number): CandleData[] {
  const candles: CandleData[] = [];
  let basePrice = startPrice;
  const now = new Date();

  for (let i = limit; i >= 0; i--) {
    const timeStr = new Date(now.getTime() - i * 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const change = (Math.random() - 0.48) * (startPrice < 10 ? 0.0015 : 3.5);
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * (startPrice < 10 ? 0.0008 : 2.1);
    const low = Math.min(open, close) - Math.random() * (startPrice < 10 ? 0.0008 : 2.1);
    const volume = Math.floor(Math.random() * 6000 + 2500);

    const digits = startPrice < 10 ? 4 : 2;
    candles.push({ time: timeStr, open: +open.toFixed(digits), high: +high.toFixed(digits), low: +low.toFixed(digits), close: +close.toFixed(digits), volume });
    basePrice = close;
  }
  return candles;
}

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
      type: isBuy ? 'buy' : 'sell'
    });
  }
  return trades;
}

function getDynamicLiveFuturesTickers(): CoinTicker[] {
  const now = Date.now() / 1000;
  return [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', baseAsset: 'XAU', quoteAsset: 'USD', price: +(2894.50 + Math.sin(now) * 2.8).toFixed(2), change24h: 1.84, high24h: 2908.00, low24h: 2872.00, volume24h: 840000000, isGold: true },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', baseAsset: 'BTC', quoteAsset: 'USDT', price: +(96940.00 + Math.cos(now) * 90).toFixed(2), change24h: 4.12, high24h: 98400.00, low24h: 94200.00, volume24h: 51200000000, isFutures: true },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', baseAsset: 'ETH', quoteAsset: 'USDT', price: +(3540.20 + Math.sin(now) * 6).toFixed(2), change24h: 2.85, high24h: 3625.00, low24h: 3410.00, volume24h: 23800000000, isFutures: true },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', baseAsset: 'SOL', quoteAsset: 'USDT', price: +(228.40 + Math.cos(now) * 1.5).toFixed(2), change24h: 8.12, high24h: 234.00, low24h: 209.00, volume24h: 10400000000, isFutures: true },
  ];
}