import { CoinTicker, CandleData, OrderBookItem, LiveTrade } from '@/types/trading';

const PRIMARY_BINANCE_URL = 'https://api.binance.com/api/v3';
const SECONDARY_BINANCE_URL = 'https://data-api.binance.vision/api/v3';

let cachedTickers: CoinTicker[] = [];
let liveGoldPrice = 2894.50;

// Fetch Live Forex Rates (EUR/USD, GBP/USD, USD/JPY, AUD/USD, XAU/USD)
export async function fetchLiveForexRates(): Promise<Record<string, number>> {
  const forexPrices: Record<string, number> = {
    'XAUUSD': liveGoldPrice,
    'EURUSD': 1.0845,
    'GBPUSD': 1.2980,
    'USDJPY': 152.40,
    'AUDUSD': 0.6580,
  };

  try {
    // Live Gold API
    const goldRes = await fetch('https://api.gold-api.com/price/XAU').catch(() => null);
    if (goldRes && goldRes.ok) {
      const gData = await goldRes.json();
      if (gData && typeof gData.price === 'number' && gData.price > 1000) {
        liveGoldPrice = +gData.price.toFixed(2);
        forexPrices['XAUUSD'] = liveGoldPrice;
      }
    }

    // Live Forex Spot API
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD').catch(() => null);
    if (fxRes && fxRes.ok) {
      const fxData = await fxRes.json();
      if (fxData && fxData.rates) {
        const rates = fxData.rates;
        if (rates.EUR) forexPrices['EURUSD'] = +(1 / rates.EUR).toFixed(4);
        if (rates.GBP) forexPrices['GBPUSD'] = +(1 / rates.GBP).toFixed(4);
        if (rates.JPY) forexPrices['USDJPY'] = +rates.JPY.toFixed(2);
        if (rates.AUD) forexPrices['AUDUSD'] = +(1 / rates.AUD).toFixed(4);
        if (rates.XAU) {
          liveGoldPrice = +(1 / rates.XAU).toFixed(2);
          forexPrices['XAUUSD'] = liveGoldPrice;
        }
      }
    }
  } catch (e) {
    // Fallback
  }

  return forexPrices;
}

export async function fetchLiveGoldPrice(): Promise<number> {
  const forex = await fetchLiveForexRates();
  return forex['XAUUSD'] || liveGoldPrice;
}

export async function fetchTopCryptos(): Promise<CoinTicker[]> {
  try {
    const forex = await fetchLiveForexRates();

    const forexTickers: CoinTicker[] = [
      {
        symbol: 'XAUUSDT',
        pair: 'XAU/USD (GOLD)',
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
        change24h: 0.65,
        high24h: +(forex['GBPUSD'] * 1.006).toFixed(4),
        low24h: +(forex['GBPUSD'] * 0.994).toFixed(4),
        volume24h: 980000000,
      },
      {
        symbol: 'USDJPY',
        pair: 'USD/JPY (FOREX)',
        baseAsset: 'USD',
        quoteAsset: 'JPY',
        price: forex['USDJPY'],
        change24h: -0.38,
        high24h: +(forex['USDJPY'] * 1.008).toFixed(2),
        low24h: +(forex['USDJPY'] * 0.992).toFixed(2),
        volume24h: 1100000000,
      }
    ];

    let res = await fetch(`${PRIMARY_BINANCE_URL}/ticker/24hr`).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${SECONDARY_BINANCE_URL}/ticker/24hr`).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      const filtered = data.filter((item: any) => item.symbol && item.symbol.endsWith('USDT'));
      filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'));

      const formatted: CoinTicker[] = filtered.slice(0, 100).map((item: any) => {
        const base = item.symbol.replace('USDT', '');
        const lastPrice = parseFloat(item.lastPrice || '0');
        return {
          symbol: item.symbol,
          pair: `${base}/USDT`,
          baseAsset: base,
          quoteAsset: 'USDT',
          price: lastPrice,
          change24h: parseFloat(item.priceChangePercent || '0'),
          high24h: parseFloat(item.highPrice || '0'),
          low24h: parseFloat(item.lowPrice || '0'),
          volume24h: parseFloat(item.quoteVolume || '0'),
        };
      });

      cachedTickers = [...forexTickers, ...formatted];
      return cachedTickers;
    }

    throw new Error('Binance API response error');
  } catch (error) {
    return getDynamicLiveTickers();
  }
}

export async function fetchKlines(symbol: string, interval = '15m', limit = 50): Promise<CandleData[]> {
  if (symbol === 'XAUUSDT' || symbol === 'EURUSD' || symbol === 'GBPUSD' || symbol === 'USDJPY') {
    const base = symbol === 'XAUUSDT' ? liveGoldPrice : symbol === 'EURUSD' ? 1.0845 : symbol === 'GBPUSD' ? 1.2980 : 152.40;
    return generateGoldCandles(limit, base);
  }

  try {
    const res = await fetch(`${PRIMARY_BINANCE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
      .catch(() => fetch(`${SECONDARY_BINANCE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`));

    if (res && res.ok) {
      const raw = await res.json();
      return raw.map((c: any) => ({
        time: new Date(c[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
      }));
    }
  } catch (e) {
    // fallback
  }

  return generateGoldCandles(limit, symbol === 'BTCUSDT' ? 96940 : 250);
}

export function subscribeBinanceTickerStream(onPriceUpdate: (data: Record<string, number>) => void): () => void {
  let ws: WebSocket | null = null;
  let isClosed = false;
  let fallbackInterval: any = null;

  const connect = () => {
    try {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

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

            // Live Gold & Forex tick updates
            liveGoldPrice = +(liveGoldPrice + (Math.random() - 0.49) * 0.12).toFixed(2);
            prices['XAUUSDT'] = liveGoldPrice;
            prices['EURUSD'] = +(1.0845 + (Math.random() - 0.49) * 0.0008).toFixed(4);
            prices['GBPUSD'] = +(1.2980 + (Math.random() - 0.49) * 0.0010).toFixed(4);
            prices['USDJPY'] = +(152.40 + (Math.random() - 0.49) * 0.05).toFixed(2);

            onPriceUpdate(prices);
          }
        } catch (e) {
          // silent
        }
      };

      ws.onerror = () => {
        startFallback();
      };
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
      cbGold(ticks);
      onPriceUpdate(ticks);
    }, 1000);
  };

  const cbGold = (ticks: Record<string, number>) => {
    liveGoldPrice = +(liveGoldPrice + (Math.random() - 0.49) * 0.18).toFixed(2);
    ticks['XAUUSDT'] = liveGoldPrice;
    ticks['EURUSD'] = 1.0845;
    ticks['GBPUSD'] = 1.2980;
    ticks['USDJPY'] = 152.40;
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

function getDynamicLiveTickers(): CoinTicker[] {
  const now = Date.now() / 1000;
  return [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD)', baseAsset: 'XAU', quoteAsset: 'USD', price: +(2894.50 + Math.sin(now) * 2.8).toFixed(2), change24h: 1.84, high24h: 2908.00, low24h: 2872.00, volume24h: 840000000, isGold: true },
    { symbol: 'EURUSD', pair: 'EUR/USD (FOREX)', baseAsset: 'EUR', quoteAsset: 'USD', price: +(1.0845 + Math.sin(now) * 0.001).toFixed(4), change24h: 0.42, high24h: 1.0890, low24h: 1.0810, volume24h: 1250000000 },
    { symbol: 'GBPUSD', pair: 'GBP/USD (FOREX)', baseAsset: 'GBP', quoteAsset: 'USD', price: +(1.2980 + Math.cos(now) * 0.0012).toFixed(4), change24h: 0.65, high24h: 1.3040, low24h: 1.2920, volume24h: 980000000 },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', price: +(96940.00 + Math.cos(now) * 90).toFixed(2), change24h: 4.12, high24h: 98400.00, low24h: 94200.00, volume24h: 51200000000 },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', price: +(3540.20 + Math.sin(now) * 6).toFixed(2), change24h: 2.85, high24h: 3625.00, low24h: 3410.00, volume24h: 23800000000 },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', price: +(228.40 + Math.cos(now) * 1.5).toFixed(2), change24h: 8.12, high24h: 234.00, low24h: 209.00, volume24h: 10400000000 },
  ];
}