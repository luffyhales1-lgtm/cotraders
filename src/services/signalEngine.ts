import { Signal, StrategyName } from '@/types/trading';

const STRATEGIES: StrategyName[] = [
  'SMC Order Block',
  'EMA 20/200 Golden Cross',
  'RSI Bullish Divergence',
  'MACD Trend Impulse',
  'Supertrend Breakout',
  'Volume Profile Rejection'
];

export function generateLiveSignals(): Signal[] {
  const assets = [
    { symbol: 'BTCUSDT', pair: 'BTC/USDT', price: 96420, digits: 2 },
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD)', price: 2738.50, digits: 2 },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT', price: 3480.20, digits: 2 },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT', price: 218.40, digits: 2 },
    { symbol: 'BNBUSDT', pair: 'BNB/USDT', price: 654.10, digits: 2 },
    { symbol: 'XRPUSDT', pair: 'XRP/USDT', price: 1.42, digits: 4 },
    { symbol: 'PEPEUSDT', pair: 'PEPE/USDT', price: 0.0000185, digits: 8 },
    { symbol: 'SUIUSDT', pair: 'SUI/USDT', price: 3.45, digits: 3 },
    { symbol: 'NEARUSDT', pair: 'NEAR/USDT', price: 6.82, digits: 2 },
    { symbol: 'AVAXUSDT', pair: 'AVAX/USDT', price: 38.90, digits: 2 },
    { symbol: 'DOGEUSDT', pair: 'DOGE/USDT', price: 0.385, digits: 4 },
    { symbol: 'LINKUSDT', pair: 'LINK/USDT', price: 18.20, digits: 2 }
  ];

  const signals: Signal[] = assets.map((asset, index) => {
    const isLong = index % 2 === 0;
    const price = asset.price;
    const strategy = STRATEGIES[index % STRATEGIES.length];

    const slPercent = isLong ? 0.985 : 1.015;
    const tp1Percent = isLong ? 1.02 : 0.98;
    const tp2Percent = isLong ? 1.045 : 0.955;
    const tp3Percent = isLong ? 1.08 : 0.92;

    const entryPrice = price;
    const stopLoss = +(price * slPercent).toFixed(asset.digits);
    const target1 = +(price * tp1Percent).toFixed(asset.digits);
    const target2 = +(price * tp2Percent).toFixed(asset.digits);
    const target3 = +(price * tp3Percent).toFixed(asset.digits);

    const winProb = Math.floor(Math.random() * 14) + 82; // 82% - 95%
    const isVipOnly = index > 1; // standard free gets first 2, rest VIP

    const statusList = ['ACTIVE', 'HIT_TP1', 'ACTIVE', 'ACTIVE', 'HIT_TP2'];
    const status = statusList[index % statusList.length] as any;

    return {
      id: `SIG-${Date.now()}-${index}`,
      symbol: asset.symbol,
      pair: asset.pair,
      type: isLong ? 'LONG' : 'SHORT',
      entryPrice,
      target1,
      target2,
      target3,
      stopLoss,
      leverage: isLong ? '10x - 20x' : '5x - 10x',
      winProbability: winProb,
      riskReward: isLong ? '1:3.2' : '1:2.8',
      strategy,
      status,
      timestamp: new Date(Date.now() - index * 7 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeframe: index % 3 === 0 ? '15m' : index % 3 === 1 ? '1h' : '4h',
      rationale: `Strong ${strategy} detected on the ${asset.pair} timeframe with institutional volume confluence and clear liquidity grab above order block.`,
      isVipOnly,
    };
  });

  return signals;
}

export const INITIAL_NEWS = [
  {
    id: 'news-1',
    title: 'Fed Signals Rate Cut Flexibility as Gold and Crypto Surge to Multi-Month Highs',
    source: 'Bloomberg Markets',
    time: '12 mins ago',
    summary: 'Central bank commentary fuels institutional risk-on liquidity flow into XAU/USD and Bitcoin spot ETFs.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  },
  {
    id: 'news-2',
    title: 'Binance Spot Trading Volume Jumps 42% Following Institutional Inflows',
    source: 'CoinDesk',
    time: '34 mins ago',
    summary: 'Crypto market capitalisation breaches key resistance level as liquidity indicators flash strong momentum.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  },
  {
    id: 'news-3',
    title: 'XAU/USD Smart Money Liquidity Analysis: Target $2,780 Resistance Zone',
    source: 'LiveTrading AI Desk',
    time: '1 hour ago',
    summary: 'Order block rejection at $2,720 confirms continuation pattern. Key levels mapped out in VIP AI Scanner.',
    sentiment: 'BULLISH' as const,
    impact: 'MEDIUM' as const,
    isVipOnly: true,
  },
  {
    id: 'news-4',
    title: 'Options Expiry Volatility Warning for Ethereum & Solana Traders',
    source: 'CoinTelegraph',
    time: '2 hours ago',
    summary: 'Derivatives open interest spikes to historic levels ahead of Friday settlement hours.',
    sentiment: 'NEUTRAL' as const,
    impact: 'HIGH' as const,
    isVipOnly: true,
  }
];