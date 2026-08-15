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
  spoofingWall?: string; // e.g., "Ask Wall $97,200 (Spoofing Detected)"
  liquidityWall?: string; // e.g., "Bid Liquidity Wall $95,800 ($14.2M)"
  orderBlockZone?: string; // e.g., "Bullish OB $96,100 - $96,400"
  demandSupplyZone?: string; // e.g., "15m Institutional Demand Zone"
  ictPattern?: string; // e.g., "Judas Swing & Liquidity Sweep"
  momentumStatus?: 'HIGH_MOMENTUM_CONTINUATION' | 'MOMENTUM_DEPLETING_SECURE_PROFIT' | 'NEUTRAL';
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookItem {
  price: number;
  amount: number;
  total: number;
}

export interface LiveTrade {
  id: string;
  price: number;
  amount: number;
  time: string;
  type: 'buy' | 'sell';
}

export interface MarketNews {
  id: string;
  title: string;
  source: string;
  time: string;
  summary: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  isVipOnly: boolean;
  url?: string;
}

export interface BacktestSummary {
  period: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnLPercent: number;
  totalPnLUsd: number;
  bestTradePercent: number;
  worstTradePercent: number;
  timestamp: string;
}