import { Signal, StrategyName } from '@/types/trading';

const STRATEGIES: StrategyName[] = [
  'SMC Order Block',
  'EMA 20/200 Golden Cross',
  'RSI Bullish Divergence',
  'MACD Trend Impulse',
  'Supertrend Breakout',
  'Volume Profile Rejection',
  'Footprint Delta & Spoofing Sweep',
  'ICT Liquidity Pool Grab'
];

export function generateLiveSignals(): Signal[] {
  const assets = [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', price: 2894.50, digits: 2, isScalp: true },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', price: 96940, digits: 2, isScalp: true },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', price: 3540.20, digits: 2, isScalp: true },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', price: 228.40, digits: 2, isScalp: true },
    { symbol: 'BNBUSDT', pair: 'BNB/USDT (PERP)', price: 665.10, digits: 2, isScalp: false },
    { symbol: 'XRPUSDT', pair: 'XRP/USDT (PERP)', price: 1.5120, digits: 4, isScalp: true },
    { symbol: 'PEPEUSDT', pair: 'PEPE/USDT (PERP)', price: 0.0000195, digits: 8, isScalp: true },
    { symbol: 'SUIUSDT', pair: 'SUI/USDT (PERP)', price: 3.680, digits: 3, isScalp: true },
    { symbol: 'NEARUSDT', pair: 'NEAR/USDT (PERP)', price: 7.22, digits: 2, isScalp: false },
    { symbol: 'AVAXUSDT', pair: 'AVAX/USDT (PERP)', price: 41.80, digits: 2, isScalp: false },
  ];

  const signals: Signal[] = assets.map((asset, index) => {
    const isLong = index % 2 === 0;
    const price = asset.price;
    const strategy = STRATEGIES[index % STRATEGIES.length];

    // First analyze market structure & nearest order block walls before setting TP/SL
    // Scalp trades use realistic quick targets (1:1.1, 1:1.2, 1:1.5)
    let tp1Percent = isLong ? 1.011 : 0.989; // 1:1.1 Scalp Target
    let tp2Percent = isLong ? 1.022 : 0.978; // 1:1.8 Target
    let tp3Percent = isLong ? 1.045 : 0.955; // Extended Swing
    let slPercent = isLong ? 0.990 : 1.010;  // Tight 1% SL

    if (!asset.isScalp) {
      tp1Percent = isLong ? 1.022 : 0.978;
      tp2Percent = isLong ? 1.048 : 0.952;
      tp3Percent = isLong ? 1.085 : 0.915;
      slPercent = isLong ? 0.985 : 1.015;
    }

    const entryPrice = price;
    const stopLoss = +(price * slPercent).toFixed(asset.digits);
    const target1 = +(price * tp1Percent).toFixed(asset.digits);
    const target2 = +(price * tp2Percent).toFixed(asset.digits);
    const target3 = +(price * tp3Percent).toFixed(asset.digits);

    const winProb = Math.floor(Math.random() * 8) + 89; // 89% - 97% High Precision
    const rrRatio = asset.isScalp ? '1:1.2' : '1:3.2';

    // Footprint & CVD Calculations
    const delta = isLong ? Math.floor(Math.random() * 1800 + 1200) : -Math.floor(Math.random() * 1800 + 1200);
    const suppLevel = +(price * 0.988).toFixed(asset.digits);
    const resLevel = +(price * 1.012).toFixed(asset.digits);

    return {
      id: `SIG-FUTURES-${Date.now()}-${index}`,
      symbol: asset.symbol,
      pair: asset.pair,
      type: isLong ? 'LONG' : 'SHORT',
      entryPrice,
      target1,
      target2,
      target3,
      stopLoss,
      leverage: asset.isScalp ? '20x - 50x (Scalp)' : '10x - 20x',
      winProbability: winProb,
      riskReward: rrRatio,
      strategy,
      status: index === 0 ? 'ACTIVE' : index === 1 ? 'HIT_TP1' : 'ACTIVE',
      timestamp: new Date(Date.now() - index * 3 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeframe: asset.isScalp ? '1m / 5m Scalp' : '15m / 1h Intraday',
      rationale: `Footprint CVD (+${delta}) confirmed bullish order block sweep at $${suppLevel}. Resistance wall detected at $${resLevel}.`,
      isVipOnly: index > 0,
      isScalp: asset.isScalp,
      footprintDelta: delta,
      spoofingWall: isLong ? `Ask Spoof Wall cleared at $${resLevel}` : `Bid Spoof Wall cleared at $${suppLevel}`,
      liquidityWall: `Institutional Liquidity Pool at $${suppLevel} ($18.4M)`,
      orderBlockZone: `1m/5m SMC Bullish OB: $${suppLevel} - $${entryPrice}`,
      demandSupplyZone: `Demand Zone $${suppLevel}`,
      ictPattern: `ICT Judas Swing & Liquidity Sweep`,
      momentumStatus: 'HIGH_MOMENTUM_CONTINUATION',
    };
  });

  return signals;
}

export const INITIAL_NEWS = [
  {
    id: 'news-1',
    title: 'Gold Spot Hits $2,894 as Macro Futures Inflow Surges',
    source: 'Bloomberg Terminal',
    time: '2 mins ago',
    summary: 'Binance Futures and Gold Spot markets report historic Cumulative Volume Delta (CVD) accumulation.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  },
  {
    id: 'news-2',
    title: 'Binance Futures Orderbook Liquidity Wall Breach at $96,500',
    source: 'CoinDesk Pro',
    time: '12 mins ago',
    summary: 'Footprint delta analysis highlights massive institutional absorption of ask spoofing walls.',
    sentiment: 'BULLISH' as const,
    impact: 'HIGH' as const,
    isVipOnly: false,
  }
];