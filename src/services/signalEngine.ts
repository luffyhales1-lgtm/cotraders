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
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD)', price: 2885.50, digits: 2 },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT', price: 96850, digits: 2 },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT', price: 3520.40, digits: 2 },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT', price: 224.80, digits: 2 },
    { symbol: 'BNBUSDT', pair: 'BNB/USDT', price: 662.30, digits: 2 },
    { symbol: 'XRPUSDT', pair: 'XRP/USDT', price: 1.4850, digits: 4 },
    { symbol: 'PEPEUSDT', pair: 'PEPE/USDT', price: 0.0000192, digits: 8 },
    { symbol: 'SUIUSDT', pair: 'SUI/USDT', price: 3.620, digits: 3 },
    { symbol: 'NEARUSDT', pair: 'NEAR/USDT', price: 7.15, digits: 2 },
    { symbol: 'AVAXUSDT', pair: 'AVAX/USDT', price: 41.20, digits: 2 },
    { symbol: 'DOGEUSDT', pair: 'DOGE/USDT', price: 0.412, digits: 4 },
    { symbol: 'LINKUSDT', pair: 'LINK/USDT', price: 19.80, digits: 2 }
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

    const winProb = Math.floor(Math.random() * 12) + 84; // 84% - 96%
    const isVipOnly = index > 0; // free users get 1 sample trade, rest VIP

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
      timestamp: new Date(Date.now() - index * 5 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeframe: index % 3 === 0 ? '5m' : index % 3 === 1 ? '15m' : '1h',
      rationale: `Institutional ${strategy} confluence detected on ${asset.pair} with high liquidity order block sweep.`,
      isVipOnly,
    };
  });

  return signals;
}

export const INITIAL_NEWS = [
  {
    id: 'news-1',
    title: 'Gold Breaks All-Time Highs at $2,885 as Macro Volatility Surges',
    source: 'Bloomberg Terminal',
    time: '5 mins ago',
    summary: 'Central bank commentary and institutional hedging fuel historic capital inflow into XAU/USD and Bitcoin spot ETFs.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  },
  {
    id: 'news-2',
    title: 'Binance Spot Volatility Engine Reports $48B Volume Surge',
    source: 'CoinDesk Pro',
    time: '18 mins ago',
    summary: 'Crypto market capitalisation breaches key resistance level as liquidity indicators flash strong momentum.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  },
  {
    id: 'news-3',
    title: 'XAU/USD Smart Money Order Block Analysis: Target $2,920 Level',
    source: 'LiveTrading AI Desk',
    time: '45 mins ago',
    summary: 'Institutional rejection at $2,865 confirms continuation pattern. Full target parameters broadcasted in VIP Telegram.',
    sentiment: 'BULLISH' as const,
    impact: 'MEDIUM' as const,
    isVipOnly: true,
  },
  {
    id: 'news-4',
    title: 'Derivatives Expiry Impact Report for BTC & ETH Traders',
    source: 'CoinTelegraph',
    time: '1 hour ago',
    summary: 'Derivatives open interest spikes to historic levels ahead of Friday settlement hours.',
    sentiment: 'NEUTRAL' as const,
    impact: 'HIGH' as const,
    isVipOnly: true,
  }
];