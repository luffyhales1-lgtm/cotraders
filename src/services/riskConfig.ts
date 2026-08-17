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