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
export type TradeMode = 'SCALP' | 'SWING';

/** One strategy's read during the deep analysis pass, kept for the audit trail. */
export interface StrategyRead {
  name: string;
  category: string;
  triggered: boolean;
  direction: 'LONG' | 'SHORT' | null;
  reason: string;
}

/** A single higher-timeframe confirmation check. */
export interface TimeframeCheck {
  timeframe: string;
  trend: 'UP' | 'DOWN' | 'FLAT';
  rsi: number | null;
  agrees: boolean;
  note: string;
}

/** Live order-book / volume liquidity read taken at signal time. */
export interface LiquidityCheck {
  bidDepth: number;          // summed size on the top bid levels
  askDepth: number;          // summed size on the top ask levels
  imbalance: number;         // bidDepth / askDepth (>1 = buyers stacked)
  spreadPct: number | null;  // best ask - best bid, as % of price
  quoteVolume24h: number | null;
  wall: string | null;       // largest resting wall found, if any
  passed: boolean;
  note: string;
}

/** One line of the qualification gate, so the verdict is fully auditable. */
export interface GateCheck {
  label: string;
  passed: boolean;
  detail: string;
}

/**
 * The complete, human-readable audit trail behind a signal. This is what the
 * Analysis Video section narrates frame by frame, and it is built from the SAME
 * live data the signal was generated from — never from stored/old market data.
 */
export interface SignalAnalysis {
  symbol: string;
  pair: string;
  mode: TradeMode;
  baseTimeframe: string;
  takenAt: string;              // ISO timestamp of the analysis
  direction: 'LONG' | 'SHORT' | null;
  strategyReads: StrategyRead[];      // ALL 21 strategies, triggered or not
  triggeredCount: number;
  agreeingStrategies: string[];
  timeframeChecks: TimeframeCheck[];  // multi-timeframe verification
  liquidity: LiquidityCheck | null;
  gateChecks: GateCheck[];
  verdict: 'TRADE' | 'REJECTED';
  rejectionReason?: string;
  rsi: number | null;
  macdHistogram: number | null;
  atrPercent: number | null;
  volumeDelta: number | null;
  trendNote: string;
  candles?: CandleData[];             // base-timeframe candles used (for the video chart)
}

export type SignalStatus = 'ACTIVE' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_TP3' | 'STOP_LOSS' | 'PENDING';
export type StrategyName =
  | 'Triple EMA Pullback'
  | 'Hyper Scalper'
  | 'VWAP Bounce'
  | 'BB Squeeze Breakout'
  | 'ICT Rejection Block'
  | 'Liquidity Sweep'
  | 'Fair Value Gap (FVG)'
  | 'Market Structure Shift'
  | 'Order Block + StochRSI'
  | 'RSI Divergence'
  | 'MACD Cross + Histogram'
  | 'Mean Reversion (BB)'
  | 'Golden/Death Cross'
  | 'Pin Bar / Hammer'
  | 'Range Breakout'
  | 'Supply/Demand Zone'
  | 'Fibonacci Golden Zone'
  | 'Wyckoff Spring/Upthrust'
  | 'Squeeze Momentum (TTM)'
  | 'Quasimodo (QM)'
  | 'Darvas Box';

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
  // Honest metadata from the real walk-forward backtest -- may be null/low
  // sample size, and that is reported truthfully rather than hidden.
  backtestSampleSize?: number;
  backtestLabel?: string;
  momentumNote?: string;
  // Enriched analysis fields (populated by the signal engine for every signal)
  rsiValue?: number;                       // current RSI(14) reading
  rsiDivergence?: 'bullish' | 'bearish' | null; // measured divergence vs price
  atrPercent?: number;                     // ATR as % of price (volatility)
  supportLevel?: number;                   // nearest structural support
  resistanceLevel?: number;                // nearest structural resistance
  positionSizeNote?: string;               // e.g. "Risk 1.5% acct -> ~7.5% margin @ 5x"
  riskPerTradePct?: number;                // suggested % of account to risk
  confidenceScore?: number;                // 0-100 composite conviction score
  confluenceCount?: number;                // how many strategies agreed
  assetClass?: 'CRYPTO' | 'GOLD' | 'SILVER' | 'FOREX';
  // ---- Trade-mode & audit-trail fields -------------------------------------
  mode?: TradeMode;                        // SCALP (5m) or SWING (4h)
  tp1DistancePct?: number;                 // how far TP1 sits from entry, in %
  slDistancePct?: number;                  // how far the stop sits from entry, in %
  rrRatio?: number;                        // numeric reward:risk of TP1 (>= 1.1 enforced)
  levelsWidened?: boolean;                 // true when ATR was too tight and levels were scaled up
  mtfNote?: string;                        // multi-timeframe confirmation summary
  liquidityNote?: string;                  // live order-book / volume read
  analysis?: SignalAnalysis;               // full auditable breakdown (drives the Analysis Video)
}

// Whole-market breadth snapshot produced by analyzeMarketOverview() and shown
// on the dashboard "Analyze Whole Market" panel.
export interface MarketOverview {
  scannedCount: number;
  signalCount: number;
  longCount: number;
  shortCount: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  biasStrengthPct: number;      // 0-100, how lopsided long vs short is
  avgRsi: number | null;
  avgConfidence: number | null;
  topStrategies: { name: string; count: number }[];
  strongest: Signal[];          // highest-confidence fresh signals
  btcTrend?: string;
  timestamp: string;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume?: number; // real Binance kline field, used for volume-delta approximation
}

export type StrategyCategory = 'TREND' | 'REVERSAL' | 'BREAKOUT' | 'ICT/SMC';

export interface StrategyResult {
  name: string;
  category: StrategyCategory;
  triggered: boolean;
  direction: 'LONG' | 'SHORT' | null;
  reason: string;
  // Historical backtested win rate for this strategy on this symbol/timeframe,
  // computed by walking forward over real candles — not invented.
  backtestWinRate?: number;
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
  imageUrl?: string;     // article thumbnail (from the live feed)
  publishedOn?: number;  // unix ms — used to sort + render live relative time
  categories?: string[]; // e.g. ['BTC','Trading','Regulation']
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
