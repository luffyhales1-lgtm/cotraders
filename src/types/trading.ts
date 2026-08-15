export type SubscriptionTier = 'free' | 'vip_monthly' | 'vip_yearly';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  isAdmin: boolean;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  isExpired?: boolean;
}

export interface CoinTicker {
  symbol: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  isGold?: boolean;
  isFutures?: boolean;
}

export type SignalType = 'LONG' | 'SHORT';
export type SignalStatus = 'ACTIVE' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_TP3' | 'STOP_LOSS' | 'PENDING';
export type StrategyName = 
  | 'SMC Order Block' 
  | 'EMA 20/200 Golden Cross' 
  | 'RSI Bullish Divergence' 
  | 'MACD Trend Impulse' 
  | 'Supertrend Breakout' 
  | 'Volume Profile Rejection'
  | 'Footprint Delta & Spoofing Sweep'
  | 'ICT Liquidity Pool Grab';

export interface Signal {
  id: string;
  symbol: string;
  pair: string;
  type: SignalType;
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  leverage: string;
  winProbability: number;
  riskReward: string;
  strategy: StrategyName;
  status: SignalStatus;
  timestamp: string;
  timeframe: string;
  rationale: string;
  isVipOnly: boolean;
  isScalp?: boolean;
  // Deep Institutional Parameters
  footprintDelta?: number; // e.g., +1420 CVD (Cumulative Volume Delta)
  spoofingWall?: string; // e.g., \"Ask Wall $97,200 (Spoofing Detected)\"
  liquidityWall?: string; // e.g., \"Bid Liquidity Wall $95,800 ($14.2M)\"
  orderBlockZone?: string; // e.g., \"Bullish OB $96,100 - $96,400\"
  demandSupplyZone?: string; // e.g., \"15m Institutional Demand Zone\"
  ictPattern?: string; // e.g., \"Judas Swing & Liquidity Sweep\"\n  momentumStatus?: 'HIGH_MOMENTUM_CONTINUATION' | 'MOMENTUM_DEPLETING_SECURE_PROFIT' | 'NEUTRAL';\n}\n\nexport interface CandleData {\n  time: string;\n  open: number;\n  high: number;\n  low: number;\n  close: number;\n  volume: number;\n}\n\nexport interface OrderBookItem {\n  price: number;\n  amount: number;\n  total: number;\n}\n\nexport interface LiveTrade {\n  id: string;\n  price: number;\n  amount: number;\n  time: string;\n  type: 'buy' | 'sell';\n}\n\nexport interface MarketNews {\n  id: string;\n  title: string;\n  source: string;\n  time: string;\n  summary: string;\n  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';\n  impact: 'HIGH' | 'MEDIUM' | 'LOW';\n  isVipOnly: boolean;\n  url?: string;\n}\n\nexport interface BacktestSummary {\n  period: string;\n  totalTrades: number;\n  winningTrades: number;\n  losingTrades: number;\n  winRate: number;\n  totalPnLPercent: number;\n  totalPnLUsd: number;\n  bestTradePercent: number;\n  worstTradePercent: number;\n  timestamp: string;\n}\n