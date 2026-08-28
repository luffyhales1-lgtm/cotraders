// Shared risk model used by BOTH the live signal generator and the backtest
// engine, so the win rate you see was actually measured against the same SL/TP
// rules the live signal uses — not two different systems.
//
// CRITICAL RULE 1: TP1 must sit FARTHER from entry than the stop. The journal
// and the backtest both resolve a trade at first touch of TP1 (win) or SL
// (loss), so if TP1 were CLOSER than the stop, each win would pay less than
// each loss and the system would need an unrealistic >56% hit rate just to
// break even.
//
// CRITICAL RULE 2 (added because targets were landing absurdly close to entry —
// "price is 45 and it gives TP 46"): a target must also be far enough away in
// PERCENTAGE terms to be worth taking after fees and slippage. ATR-derived
// levels on a quiet 1-minute chart can be a fraction of a percent, which is not
// a real trade. Every mode therefore carries a MINIMUM TP1 distance, and the
// whole SL/TP structure is scaled up together so the reward:risk ratio is
// preserved exactly (see scaleToMinReward).

export type TradeMode = 'SCALP' | 'SWING';

export interface RiskProfile {
  mode: TradeMode;
  slAtr: number;
  tp1Atr: number;
  tp2Atr: number;
  tp3Atr: number;
  /** Minimum TP1 distance as a % of entry price. A trade tighter than this is not worth fees. */
  minTp1Pct: number;
  /** Sanity cap on TP1 distance (%) — beyond this the market is too wild to size safely. */
  maxTp1Pct: number;
  /** Bars allowed for the trade to resolve before it's discarded as unresolved. */
  maxForwardBars: number;
  /** Native chart timeframe this mode trades. */
  interval: string;
  /** Higher timeframes that must confirm the direction before a signal issues. */
  confirmTimeframes: string[];
  label: string;
}

/**
 * SCALP — fast intraday trades on the 5-minute chart.
 * 1-minute was deliberately dropped: its ATR is so small that targets landed
 * inside the spread, and its noise was a real source of losing signals.
 * TP1 is forced to at least 1.1% away, at a 1:1.50 reward:risk.
 */
export const SCALP_PROFILE: RiskProfile = {
  mode: 'SCALP',
  slAtr: 1.4,
  tp1Atr: 2.1,   // 1:1.50 reward:risk
  tp2Atr: 3.5,   // 1:2.50
  tp3Atr: 5.2,   // 1:3.71
  minTp1Pct: 1.1,
  maxTp1Pct: 8,
  maxForwardBars: 40,
  interval: '5m',
  confirmTimeframes: ['15m', '1h'],
  label: 'Scalp · 5m · TP1 ≥ 1.1%',
};

/**
 * SWING — multi-day positions on the 4-hour chart, with room to actually run.
 * Wider stop, much wider targets (TP1 at least 4% away) and a 1:2.00 base
 * reward:risk, confirmed on the daily.
 */
export const SWING_PROFILE: RiskProfile = {
  mode: 'SWING',
  slAtr: 1.6,
  tp1Atr: 3.2,   // 1:2.00 reward:risk
  tp2Atr: 5.5,   // 1:3.44
  tp3Atr: 8.0,   // 1:5.00
  minTp1Pct: 4.0,
  maxTp1Pct: 30,
  maxForwardBars: 60,
  interval: '4h',
  confirmTimeframes: ['1d'],
  label: 'Swing · 4h · TP1 ≥ 4%',
};

export function profileFor(mode: TradeMode): RiskProfile {
  return mode === 'SWING' ? SWING_PROFILE : SCALP_PROFILE;
}

/**
 * The percentage floors above are calibrated for crypto, which routinely moves
 * several percent in a session. Forex majors and the metals do not — EUR/USD
 * often ranges less than 0.6% in a whole day, so a 1.1% scalp target would
 * simply never fill and every FX signal would be (wrongly) rejected. This
 * returns the profile with floors scaled to what each asset class actually
 * does, while leaving the ATR multiples — and therefore the reward:risk — the
 * same across all assets.
 */
export function profileForAsset(mode: TradeMode, assetClass?: string): RiskProfile {
  const base = profileFor(mode);
  if (assetClass === 'FOREX') {
    return {
      ...base,
      minTp1Pct: mode === 'SWING' ? 1.0 : 0.25,
      maxTp1Pct: mode === 'SWING' ? 6 : 2,
    };
  }
  if (assetClass === 'GOLD' || assetClass === 'SILVER') {
    return {
      ...base,
      minTp1Pct: mode === 'SWING' ? 2.5 : 0.6,
      maxTp1Pct: mode === 'SWING' ? 15 : 5,
    };
  }
  return base;
}

// ---- Legacy single-profile constants -----------------------------------------
// Older callers (backtestEngine's default path, existing components) import
// these directly. They map to the SCALP profile so nothing breaks; new code
// should take a RiskProfile instead.
export const SL_ATR = SCALP_PROFILE.slAtr;
export const TP1_ATR = SCALP_PROFILE.tp1Atr;
export const TP2_ATR = SCALP_PROFILE.tp2Atr;
export const TP3_ATR = SCALP_PROFILE.tp3Atr;
export const MAX_FORWARD_BARS = SCALP_PROFILE.maxForwardBars;
export const MIN_TRADES_TO_REPORT = 5;

// ---- Signal qualification gate ("analyze, THEN trade") ----------------------
// A raw strategy trigger is NOT a trade. The gate in buildSignalFromStrategyHit()
// requires these minimums so only confirmed, with-trend, momentum-backed,
// multi-timeframe, liquid setups ever reach the journal / scanners / bot.
export const MIN_CONFLUENCE = 2;          // at least this many strategies must agree on direction
export const MIN_CONFIDENCE_TO_EMIT = 58; // composite conviction floor (0-100)
export const MIN_BACKTEST_WINRATE = 42;   // if a real win rate is known it must clear break-even (~40%) + margin
export const MIN_RR = 1.1;                // absolute reward:risk floor — never emit a trade below this
/** Every higher timeframe checked must agree; this is how many are allowed to disagree. */
export const MAX_MTF_CONFLICTS = 0;
/** Order-book imbalance must not be stacked against the trade by more than this ratio. */
export const MAX_ADVERSE_BOOK_RATIO = 1.8;
/** Minimum 24h quote volume (USDT) for a market to be considered tradable/liquid. */
export const MIN_QUOTE_VOLUME_24H = 5_000_000;

export function riskRewardLabel(tpAtr: number, slAtr: number = SL_ATR): string {
  return `1:${(tpAtr / slAtr).toFixed(2)}`;
}

export interface TradeLevels {
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  /** Distance from entry to TP1 as a % of entry. */
  tp1Pct: number;
  /** Distance from entry to the stop as a % of entry. */
  slPct: number;
  /** Reward:risk of TP1 (always >= MIN_RR when this returns non-null). */
  rr: number;
  /** True when ATR was too small and the structure was scaled up to clear the % floor. */
  widened: boolean;
  /** The effective ATR distance used after any widening. */
  atrUsed: number;
}

/**
 * Builds the SL/TP structure for a trade, enforcing both the reward:risk ratio
 * and the profile's minimum TP1 percentage.
 *
 * If the raw ATR-derived TP1 sits closer than `minTp1Pct`, every level is
 * multiplied by the SAME factor needed to reach the floor — so the stop widens
 * in lockstep and the reward:risk ratio is mathematically unchanged. Returns
 * null when the market is either too quiet to reach the floor sensibly (would
 * need more than a 4x stretch, meaning the ATR read is meaningless here) or so
 * volatile that TP1 would exceed `maxTp1Pct`. Refusing to emit is the honest
 * outcome — better no trade than a trade that can't pay for its own fees.
 */
export function scaleToMinReward(
  entryPrice: number,
  atrVal: number,
  direction: 'LONG' | 'SHORT',
  profile: RiskProfile,
  digits: number,
): TradeLevels | null {
  if (!entryPrice || !atrVal || atrVal <= 0) return null;

  const rawTp1Pct = (profile.tp1Atr * atrVal / entryPrice) * 100;
  const floor = profile.minTp1Pct;

  // Scale factor needed so TP1 clears the percentage floor. >=1 always.
  const scale = rawTp1Pct >= floor ? 1 : floor / rawTp1Pct;
  const MAX_STRETCH = 4;
  if (scale > MAX_STRETCH) return null; // market far too quiet for this mode

  const atrUsed = atrVal * scale;
  const tp1Pct = (profile.tp1Atr * atrUsed / entryPrice) * 100;
  if (tp1Pct > profile.maxTp1Pct) return null; // too volatile to size responsibly

  const dirMult = direction === 'LONG' ? 1 : -1;
  const stopLoss = +(entryPrice - dirMult * profile.slAtr * atrUsed).toFixed(digits);
  const target1 = +(entryPrice + dirMult * profile.tp1Atr * atrUsed).toFixed(digits);
  const target2 = +(entryPrice + dirMult * profile.tp2Atr * atrUsed).toFixed(digits);
  const target3 = +(entryPrice + dirMult * profile.tp3Atr * atrUsed).toFixed(digits);

  // A stop at or through entry (possible after rounding on tiny-priced assets)
  // is not a tradable structure.
  if (direction === 'LONG' && (stopLoss >= entryPrice || target1 <= entryPrice)) return null;
  if (direction === 'SHORT' && (stopLoss <= entryPrice || target1 >= entryPrice)) return null;

  const slPct = (profile.slAtr * atrUsed / entryPrice) * 100;
  const rr = +(profile.tp1Atr / profile.slAtr).toFixed(2);
  if (rr < MIN_RR) return null; // belt-and-braces: profiles are configured above this

  return {
    stopLoss,
    target1,
    target2,
    target3,
    tp1Pct: +tp1Pct.toFixed(2),
    slPct: +slPct.toFixed(2),
    rr,
    widened: scale > 1.001,
    atrUsed,
  };
}

// Conservative leverage suggestion scaled to REAL volatility (ATR% of price).
// Higher volatility -> lower suggested leverage. This is a heuristic, not a
// guarantee, and is capped well below the app's old fixed "20x-50x" claim.
export function suggestLeverage(atrPct: number): { min: number; max: number; label: string } {
  // atrPct is ATR / price, e.g. 0.008 = 0.8% average candle range
  const raw = 1.2 / (atrPct * 100); // smaller ATR% -> higher allowable leverage
  const max = Math.max(2, Math.min(20, Math.round(raw)));
  const min = Math.max(2, Math.round(max * 0.4));
  return { min, max, label: `${min}x - ${max}x (volatility-scaled)` };
}

/**
 * Position-sizing suggestion derived from REAL numbers: the actual stop
 * distance and the volatility-scaled leverage. It answers the trader's real
 * question -- "how big should this trade be?" -- using fixed-fractional risk
 * (risk a small, fixed % of the account per trade), the standard professional
 * money-management rule.
 *
 * riskPct scales gently with conviction: a higher-confidence setup earns a
 * slightly larger (but still capped) share of account risk.
 */
export function suggestPositionSize(
  slDistancePctOrAtrPct: number,
  leverageMax: number,
  confidence = 60,
  /** Pass true when the first argument is already the STOP distance as a fraction
   *  (e.g. 0.014 for 1.4%). Default false keeps the old ATR%-based behaviour. */
  isSlDistance = false,
): { riskPct: number; marginPct: number; notionalX: number; slDistancePct: number; note: string } {
  const slDistancePct = isSlDistance ? slDistancePctOrAtrPct : SL_ATR * slDistancePctOrAtrPct;
  // Risk 1.0% (low conviction) up to 2.0% (high conviction) of account per trade.
  const riskPct = +Math.min(2, Math.max(1, 1 + (confidence - 50) / 50)).toFixed(2);
  const safeSl = Math.max(slDistancePct, 0.0005);
  // Notional as a multiple of account so the SL loss equals riskPct of account.
  const notionalX = +(riskPct / 100 / safeSl).toFixed(2);
  // Margin as % of account for that notional at the suggested max leverage.
  const marginPct = +((notionalX / Math.max(1, leverageMax)) * 100).toFixed(1);
  const note =
    `Risk ${riskPct}% of account -> ~${marginPct}% as margin at ${leverageMax}x ` +
    `(~${notionalX}x account notional). Stop is ${(slDistancePct * 100).toFixed(2)}% away.`;
  return { riskPct, marginPct, notionalX, slDistancePct, note };
}
