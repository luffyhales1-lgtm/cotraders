// Shared ATR multiples used by BOTH the live signal generator and the
// backtest engine, so the win rate you see was actually measured against
// the same SL/TP rules the live signal uses — not two different systems.
export const SL_ATR = 1.3;
export const TP1_ATR = 1.0;
export const TP2_ATR = 1.9;
export const TP3_ATR = 3.2;
export const MAX_FORWARD_BARS = 30;
export const MIN_TRADES_TO_REPORT = 5;

export function riskRewardLabel(tpAtr: number): string {
  return `1:${(tpAtr / SL_ATR).toFixed(2)}`;
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
 * Position-sizing suggestion derived from REAL numbers: the SL distance
 * (SL_ATR * ATR%) and the volatility-scaled leverage. It answers the trader's
 * actual question -- "how big should this trade be?" -- using fixed-fractional
 * risk (risk a small, fixed % of the account per trade), which is the standard
 * professional money-management rule. Nothing here is invented: given how far
 * the stop is, the math tells you what margin/notional keeps the loss capped.
 *
 * riskPct scales gently with conviction: a higher-confidence setup earns a
 * slightly larger (but still capped) share of account risk.
 */
export function suggestPositionSize(
  atrPct: number,
  leverageMax: number,
  confidence = 60,
): { riskPct: number; marginPct: number; notionalX: number; slDistancePct: number; note: string } {
  const slDistancePct = SL_ATR * atrPct;                 // e.g. 1.3 * 0.008 = 0.0104 (1.04%)
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