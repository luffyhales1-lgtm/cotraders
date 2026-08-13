import { CoinTicker, CandleData, OrderBookItem, LiveTrade } from '@/types/trading';

const BINANCE_REST_URL = 'https://api.binance.com/api/v3';

// Default featured coins list
export const TOP_COIN_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'NEARUSDT',
  'SUIUSDT', 'APTUSDT', 'PEPEUSDT', 'SHIBUSDT', 'FETUSDT',
  'RENDERUSDT', 'ARBUSDT', 'OPUSDT', 'MATICUSDT', 'DOTUSDT'
];

let cachedGoldPrice = 2735.40;

export async function fetchTopCryptos(): Promise<CoinTicker[]> {
  try {
    const res = await fetch(`${BINANCE_REST_URL}/ticker/24hr`);
    if (!res.ok) throw new Error('Binance fetch failed');
    const data = await res.json();
    
    // Filter and format pairs
    const filtered = data.filter((item: any) => item.symbol.endsWith('USDT'));
    
    const formatted: CoinTicker[] = filtered.slice(0, 100).map((item: any) => {
      const base = item.symbol.replace('USDT', '');
      return {
        symbol: item.symbol,
        pair: `${base}/USDT`,
        baseAsset: base,
        quoteAsset: 'USDT',
        price: parseFloat(item.lastPrice),
        change24h: parseFloat(item.priceChangePercent),
        high24h: parseFloat(item.highPrice),
        low24h: parseFloat(item.lowPrice),
        volume24h: parseFloat(item.quoteVolume),
      };
    });

    // Add Gold XAU/USD ticker
    const goldTicker: CoinTicker = {
      symbol: 'XAUUSDT',
      pair: 'XAU/USD (GOLD)',
      baseAsset: 'XAU',
      quoteAsset: 'USD',
      price: cachedGoldPrice + (Math.random() * 0.8 - 0.4),
      change24h: 0.84,
      high24h: 2748.90,
      low24h: 2712.10,
      volume24h: 184500000,
      isGold: true,
    };

    return [goldTicker, ...formatted];
  } catch (error) {
    console.warn('Falling back to mock crypto ticker feed', error);
    return getFallbackTickers();
  }
}

export async function fetchKlines(symbol: string, interval = '15m', limit = 60): Promise<CandleData[]> {
  if (symbol === 'XAUUSDT') {
    return generateGoldCandles(limit);
  }

  try {
    const res = await fetch(`${BINANCE_REST_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error('Klines fetch error');
    const raw = await res.json();
    
    return raw.map((c: any) => ({
      time: new Date(c[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));
  } catch (err) {
    return generateGoldCandles(limit);
  }
}

function generateGoldCandles(limit: number): CandleData[] {
  const candles: CandleData[] = [];
  let basePrice = 2730.00;
  const now = new Date();

  for (let i = limit; i >= 0; i--) {
    const timeStr = new Date(now.getTime() - i * 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const change = (Math.random() - 0.48) * 3.5;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(Math.random() * 5000 + 1200);

    candles.push({ time: timeStr, open, high, low, close, volume });
    basePrice = close;
  }
  return candles;
}

export function generateMockOrderBook(currentPrice: number): { bids: OrderBookItem[]; asks: OrderBookItem[] } {
  const bids: OrderBookItem[] = [];
  const asks: OrderBookItem[] = [];
  
  let bidAccum = 0;
  let askAccum = 0;

  for (let i = 1; i <= 8; i++) {
    const bidPrice = currentPrice * (1 - i * 0.0008);
    const bidAmt = +(Math.random() * 2.5 + 0.1).toFixed(3);
    bidAccum += bidAmt;
    bids.push({ price: +bidPrice.toFixed(2), amount: bidAmt, total: +bidAccum.toFixed(3) });

    const askPrice = currentPrice * (1 + i * 0.0008);
    const askAmt = +(Math.random() * 2.5 + 0.1).toFixed(3);
    askAccum += askAmt;
    asks.push({ price: +askPrice.toFixed(2), amount: askAmt, total: +askAccum.toFixed(3) });
  }

  return { bids, asks };
}

export function generateMockTrades(currentPrice: number): LiveTrade[] {
  const trades: LiveTrade[] = [];
  const now = new Date();

  for (let i = 0; i < 10; i++) {
    const isBuy = Math.random() > 0.45;
    const priceOffset = (Math.random() - 0.5) * 0.002 * currentPrice;
    trades.push({
      id: Math.random().toString(36).substring(7),
      price: +(currentPrice + priceOffset).toFixed(2),
      amount: +(Math.random() * 1.8 + 0.05).toFixed(3),
      time: new Date(now.getTime() - i * 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: isBuy ? 'buy' : 'sell'
    });
  }
  return trades;
}

function getFallbackTickers(): CoinTicker[] {
  return [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD)', baseAsset: 'XAU', quoteAsset: 'USD', price: 2738.50, change24h: 1.15, high24h: 2750.00, low24h: 2715.00, volume24h: 320000000, isGold: true },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', price: 96420.00, change24h: 3.42, high24h: 97800.00, low24h: 93200.00, volume24h: 42100000000 },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', price: 3480.20, change24h: -1.20, high24h: 3620.00, low24h: 3410.00, volume24h: 18900000000 },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', price: 218.40, change24h: 6.85, high24h: 224.00, low24h: 202.00, volume24h: 8400000000 },
    { symbol: 'BNBUSDT', pair: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT', price: 654.10, change24h: 0.92, high24h: 668.00, low24h: 642.00, volume24h: 2100000000 },
  ];
}