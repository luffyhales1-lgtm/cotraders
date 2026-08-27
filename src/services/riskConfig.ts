// Shared ATR multiples used by BOTH the live signal generator and the
// backtest engine, so the win rate you see was actually measured against
// the same SL/TP rules the live signal uses — not two different systems.
//
// CRITICAL: TP1 must sit FARTHER from entry than the stop. The journal and the
// backtest both resolve a trade at first touch of TP1 (win) or SL (loss), so if
// TP1 were CLOSER than the stop, each win would pay less than each loss and the
// system would need an unrealistic >56% hit rate just to break even — that was
// the root cause of the paper journal running negative. With TP1 at 1.5x the
// risk, break-even is ~40%, a bar the gated with-trend signals actually clear.
export const SL_ATR = 1.4;
export const TP1_ATR = 2.1;   // primary target — 1:1.50 reward:risk
export const TP2_ATR = 3.5;   // runner         — 1:2.50
export const TP3_ATR = 5.2;   // extended       — 1:3.71
export const MAX_FORWARD_BARS = 40; // give the wider TP1 room to resolve before a trade is discarded as "unresolved"
export const MIN_TRADES_TO_REPORT = 5;

// ---- Signal qualification gate ("analyze, THEN trade") ----------------------
// A raw strategy trigger is NOT a trade. buildSignalFromStrategyHit() requires
// these minimums so only confirmed, with-trend, momentum-backed, multi-strategy
// setups ever reach the journal / scanners / bot. Tuned to keep the paper
// journal in positive expectancy instead of bleeding on low-quality fires.
export const MIN_CONFLUENCE = 2;          // at least this many strategies must agree on direction
export const MIN_CONFIDENCE_TO_EMIT = 58; // composite conviction floor (0-100)
export const MIN_BACKTEST_WINRATE = 42;   // if a real win rate is known it must clear break-even (~40%) + margin

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