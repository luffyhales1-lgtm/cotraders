import { CandleData, StrategyResult } from '@/types/trading';
import {
  ema, rsi, stochRsi, macd, atr, bollinger, vwap, volumeDelta,
  findSwingPoints, detectRsiDivergence, findFairValueGaps, fibLevels,
} from './indicators';

/**
 * Every function below evaluates ONE strategy against real OHLCV candles.
 * `triggered` is only true when the actual computed condition is met on the
 * latest closed candle — nothing here is randomized.
 */

function last<T>(arr: T[]): T { return arr[arr.length - 1]; }

export function evaluateAllStrategies(candles: CandleData[]): StrategyResult[] {
  if (candles.length < 60) return []; // not enough real data to evaluate safely

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const i = candles.length - 1;

  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = closes.length >= 200 ? ema(closes, 200) : ema(closes, Math.min(50, closes.length - 1));
  const rsi14 = rsi(closes, 14);
  const stoch = stochRsi(closes, 14);
  const macdRes = macd(closes);
  const atr14 = atr(candles, 14);
  const bb = bollinger(closes, 20, 2);
  const vwapLine = vwap(candles);
  const delta = volumeDelta(candles);
  const swings = findSwingPoints(candles, 3);
  const fvgs = findFairValueGaps(candles);
  const divergence = detectRsiDivergence(candles, rsi14);

  const results: StrategyResult[] = [];
  const push = (r: StrategyResult) => results.push(r);

  // 1. Triple EMA Pullback (TREND)
  {
    const trendUp = ema8[i] > ema21[i] && ema21[i] > ema50[i];
    const trendDown = ema8[i] < ema21[i] && ema21[i] < ema50[i];
    const pulledToMid = Math.abs(closes[i] - ema21[i]) / closes[i] < 0.004;
    push({
      name: 'Triple EMA Pullback', category: 'TREND',
      triggered: pulledToMid && (trendUp || trendDown),
      direction: pulledToMid ? (trendUp ? 'LONG' : trendDown ? 'SHORT' : null) : null,
      reason: `EMA8/21/50 stack ${trendUp ? 'bullish' : trendDown ? 'bearish' : 'flat'}, price pulled back to EMA21 ($${ema21[i].toFixed(2)})`,
    });
  }

  // 2. Hyper Scalper (TREND) - fast EMA cross + RSI momentum
  {
    const crossUp = ema8[i - 1] <= ema21[i - 1] && ema8[i] > ema21[i];
    const crossDown = ema8[i - 1] >= ema21[i - 1] && ema8[i] < ema21[i];
    const rsiMomentum = rsi14[i] > 52 && rsi14[i] < 75;
    const rsiMomentumDown = rsi14[i] < 48 && rsi14[i] > 25;
    push({
      name: 'Hyper Scalper', category: 'TREND',
      triggered: (crossUp && rsiMomentum) || (crossDown && rsiMomentumDown),
      direction: crossUp && rsiMomentum ? 'LONG' : crossDown && rsiMomentumDown ? 'SHORT' : null,
      reason: `EMA8/21 ${crossUp ? 'bullish' : 'bearish'} cross with RSI(14) at ${rsi14[i]?.toFixed(1)}`,
    });
  }

  // 3. VWAP Bounce (TREND)
  {
    const distPct = (closes[i] - vwapLine[i]) / vwapLine[i];
    const bounceLong = closes[i - 1] < vwapLine[i - 1] && closes[i] > vwapLine[i] && distPct < 0.003;
    const bounceShort = closes[i - 1] > vwapLine[i - 1] && closes[i] < vwapLine[i] && distPct > -0.003;
    push({
      name: 'VWAP Bounce', category: 'TREND',
      triggered: bounceLong || bounceShort,
      direction: bounceLong ? 'LONG' : bounceShort ? 'SHORT' : null,
      reason: `Price reclaimed session VWAP ($${vwapLine[i].toFixed(2)}) from ${bounceLong ? 'below' : 'above'}`,
    });
  }

  // 4. BB Squeeze Breakout (BREAKOUT)
  {
    const widthNow = bb.width[i];
    const widthPrev = bb.width.slice(Math.max(0, i - 20), i).filter(v => !isNaN(v));
    const avgWidth = widthPrev.length ? widthPrev.reduce((a, b) => a + b, 0) / widthPrev.length : NaN;
    const wasSqueezed = !isNaN(avgWidth) && widthNow < avgWidth * 0.7;
    const breakUp = closes[i] > bb.upper[i];
    const breakDown = closes[i] < bb.lower[i];
    push({
      name: 'BB Squeeze Breakout', category: 'BREAKOUT',
      triggered: wasSqueezed && (breakUp || breakDown),
      direction: breakUp ? 'LONG' : breakDown ? 'SHORT' : null,
      reason: `Bollinger width contracted then price broke ${breakUp ? 'above upper band' : 'below lower band'}`,
    });
  }

  // 5. ICT Rejection Block (ICT/SMC)
  {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.close, c.open);
    const lowerWick = Math.min(c.close, c.open) - c.low;
    const bullishRejection = lowerWick > body * 2 && delta[i] > 0;
    const bearishRejection = upperWick > body * 2 && delta[i] < 0;
    push({
      name: 'ICT Rejection Block', category: 'ICT/SMC',
      triggered: bullishRejection || bearishRejection,
      direction: bullishRejection ? 'LONG' : bearishRejection ? 'SHORT' : null,
      reason: `Long ${bullishRejection ? 'lower' : 'upper'} wick rejection with taker-buy delta ${delta[i] > 0 ? '+' : ''}${delta[i].toFixed(2)}`,
    });
  }

  // 6. Liquidity Sweep (ICT/SMC)
  {
    const recentHighs = swings.filter(s => s.type === 'high' && s.index < i).slice(-1)[0];
    const recentLows = swings.filter(s => s.type === 'low' && s.index < i).slice(-1)[0];
    const sweptHigh = recentHighs && candles[i].high > recentHighs.price && closes[i] < recentHighs.price;
    const sweptLow = recentLows && candles[i].low < recentLows.price && closes[i] > recentLows.price;
    push({
      name: 'Liquidity Sweep', category: 'ICT/SMC',
      triggered: Boolean(sweptHigh || sweptLow),
      direction: sweptLow ? 'LONG' : sweptHigh ? 'SHORT' : null,
      reason: sweptLow ? `Swept liquidity below prior swing low ($${recentLows!.price.toFixed(2)}) and reclaimed` :
        sweptHigh ? `Swept liquidity above prior swing high ($${recentHighs!.price.toFixed(2)}) and rejected` : 'No sweep',
    });
  }

  // 7. Fair Value Gap (ICT/SMC)
  {
    const recentGap = fvgs.filter(g => g.index >= i - 3).slice(-1)[0];
    const filling = recentGap && closes[i] >= recentGap.bottom && closes[i] <= recentGap.top;
    push({
      name: 'Fair Value Gap (FVG)', category: 'ICT/SMC',
      triggered: Boolean(filling),
      direction: recentGap?.type === 'bullish' ? 'LONG' : recentGap?.type === 'bearish' ? 'SHORT' : null,
      reason: recentGap ? `Price trading inside ${recentGap.type} FVG $${recentGap.bottom.toFixed(2)}-$${recentGap.top.toFixed(2)}` : 'No active FVG',
    });
  }

  // 8. Market Structure Shift (ICT/SMC)
  {
    const highsOnly = swings.filter(s => s.type === 'high').slice(-3);
    const lowsOnly = swings.filter(s => s.type === 'low').slice(-3);
    const bosUp = lowsOnly.length >= 2 && lowsOnly[lowsOnly.length - 1].price > lowsOnly[lowsOnly.length - 2].price
      && highsOnly.length && closes[i] > highsOnly[highsOnly.length - 1].price;
    const bosDown = highsOnly.length >= 2 && highsOnly[highsOnly.length - 1].price < highsOnly[highsOnly.length - 2].price
      && lowsOnly.length && closes[i] < lowsOnly[lowsOnly.length - 1].price;
    push({
      name: 'Market Structure Shift', category: 'ICT/SMC',
      triggered: Boolean(bosUp || bosDown),
      direction: bosUp ? 'LONG' : bosDown ? 'SHORT' : null,
      reason: bosUp ? 'Higher low formed and price broke prior structure high' : bosDown ? 'Lower high formed and price broke prior structure low' : 'No shift',
    });
  }

  // 9. Order Block + StochRSI (ICT/SMC)
  {
    const lastLow = swings.filter(s => s.type === 'low' && s.index < i).slice(-1)[0];
    const lastHigh = swings.filter(s => s.type === 'high' && s.index < i).slice(-1)[0];
    const nearDemandOB = lastLow && Math.abs(closes[i] - lastLow.price) / closes[i] < 0.006;
    const nearSupplyOB = lastHigh && Math.abs(closes[i] - lastHigh.price) / closes[i] < 0.006;
    const oversold = stoch[i] < 20;
    const overbought = stoch[i] > 80;
    push({
      name: 'Order Block + StochRSI', category: 'ICT/SMC',
      triggered: Boolean((nearDemandOB && oversold) || (nearSupplyOB && overbought)),
      direction: nearDemandOB && oversold ? 'LONG' : nearSupplyOB && overbought ? 'SHORT' : null,
      reason: `StochRSI ${stoch[i]?.toFixed(1)} at prior order block zone`,
    });
  }

  // 10. RSI Divergence (REVERSAL)
  push({
    name: 'RSI Divergence', category: 'REVERSAL',
    triggered: divergence !== null,
    direction: divergence === 'bullish' ? 'LONG' : divergence === 'bearish' ? 'SHORT' : null,
    reason: divergence ? `${divergence === 'bullish' ? 'Bullish' : 'Bearish'} RSI divergence between last two swing points` : 'No divergence',
  });

  // 11. MACD Cross + Histogram (TREND)
  {
    const crossUp = macdRes.macd[i - 1] <= macdRes.signal[i - 1] && macdRes.macd[i] > macdRes.signal[i];
    const crossDown = macdRes.macd[i - 1] >= macdRes.signal[i - 1] && macdRes.macd[i] < macdRes.signal[i];
    const histGrowing = Math.abs(macdRes.histogram[i]) > Math.abs(macdRes.histogram[i - 1]);
    push({
      name: 'MACD Cross + Histogram', category: 'TREND',
      triggered: (crossUp || crossDown) && histGrowing,
      direction: crossUp ? 'LONG' : crossDown ? 'SHORT' : null,
      reason: `MACD ${crossUp ? 'bullish' : 'bearish'} signal cross, histogram expanding (${macdRes.histogram[i].toFixed(4)})`,
    });
  }

  // 12. Mean Reversion (BB) (REVERSAL)
  {
    const touchedLower = candles[i].low <= bb.lower[i] && closes[i] > bb.lower[i];
    const touchedUpper = candles[i].high >= bb.upper[i] && closes[i] < bb.upper[i];
    push({
      name: 'Mean Reversion (BB)', category: 'REVERSAL',
      triggered: touchedLower || touchedUpper,
      direction: touchedLower ? 'LONG' : touchedUpper ? 'SHORT' : null,
      reason: `Wick tagged ${touchedLower ? 'lower' : 'upper'} Bollinger band and closed back inside`,
    });
  }

  // 13. Golden/Death Cross (TREND)
  {
    const crossUp = ema50[i - 1] <= ema200[i - 1] && ema50[i] > ema200[i];
    const crossDown = ema50[i - 1] >= ema200[i - 1] && ema50[i] < ema200[i];
    push({
      name: 'Golden/Death Cross', category: 'TREND',
      triggered: crossUp || crossDown,
      direction: crossUp ? 'LONG' : crossDown ? 'SHORT' : null,
      reason: `EMA50/EMA200 ${crossUp ? 'golden' : 'death'} cross`,
    });
  }

  // 14. Pin Bar / Hammer (REVERSAL)
  {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low || 1e-9;
    const lowerWick = Math.min(c.close, c.open) - c.low;
    const upperWick = c.high - Math.max(c.close, c.open);
    const hammer = lowerWick / range > 0.6 && body / range < 0.3;
    const shootingStar = upperWick / range > 0.6 && body / range < 0.3;
    push({
      name: 'Pin Bar / Hammer', category: 'REVERSAL',
      triggered: hammer || shootingStar,
      direction: hammer ? 'LONG' : shootingStar ? 'SHORT' : null,
      reason: hammer ? 'Hammer candle: long lower wick, small body' : shootingStar ? 'Shooting star: long upper wick, small body' : 'No pattern',
    });
  }

  // 15. Range Breakout (BREAKOUT)
  {
    const window = candles.slice(Math.max(0, i - 20), i);
    const rangeHigh = Math.max(...window.map(c => c.high));
    const rangeLow = Math.min(...window.map(c => c.low));
    const rangePct = (rangeHigh - rangeLow) / rangeLow;
    const isTightRange = rangePct < 0.03;
    const breakUp = closes[i] > rangeHigh;
    const breakDown = closes[i] < rangeLow;
    push({
      name: 'Range Breakout', category: 'BREAKOUT',
      triggered: isTightRange && (breakUp || breakDown),
      direction: breakUp ? 'LONG' : breakDown ? 'SHORT' : null,
      reason: `20-candle range ($${rangeLow.toFixed(2)}-$${rangeHigh.toFixed(2)}) broken to the ${breakUp ? 'upside' : 'downside'}`,
    });
  }

  // 16. Supply/Demand Zone (ICT/SMC)
  {
    const window = candles.slice(Math.max(0, i - 30), i - 3);
    if (window.length > 5) {
      const consolHigh = Math.max(...window.map(c => c.high));
      const consolLow = Math.min(...window.map(c => c.low));
      const consolTight = (consolHigh - consolLow) / consolLow < 0.015;
      const impulseUp = closes[i] > consolHigh * 1.01;
      const impulseDown = closes[i] < consolLow * 0.99;
      push({
        name: 'Supply/Demand Zone', category: 'ICT/SMC',
        triggered: consolTight && (impulseUp || impulseDown),
        direction: impulseUp ? 'LONG' : impulseDown ? 'SHORT' : null,
        reason: `Impulsive move out of tight consolidation zone $${consolLow.toFixed(2)}-$${consolHigh.toFixed(2)}`,
      });
    } else {
      push({ name: 'Supply/Demand Zone', category: 'ICT/SMC', triggered: false, direction: null, reason: 'Insufficient data' });
    }
  }

  // 17. Fibonacci Golden Zone (ICT/SMC)
  {
    const lastSwingHigh = swings.filter(s => s.type === 'high').slice(-1)[0];
    const lastSwingLow = swings.filter(s => s.type === 'low').slice(-1)[0];
    if (lastSwingHigh && lastSwingLow) {
      const uptrend = lastSwingHigh.index > lastSwingLow.index;
      const fib = fibLevels(Math.max(lastSwingHigh.price, lastSwingLow.price), Math.min(lastSwingHigh.price, lastSwingLow.price));
      const inGoldenZone = closes[i] <= fib.l618 && closes[i] >= fib.l65 * 0.995 && closes[i] <= fib.l618 * 1.005;
      const inZone = closes[i] <= fib.l5 && closes[i] >= fib.l65;
      push({
        name: 'Fibonacci Golden Zone', category: 'ICT/SMC',
        triggered: inZone,
        direction: inZone ? (uptrend ? 'LONG' : 'SHORT') : null,
        reason: `Price retraced into 0.5-0.65 fib zone of last swing ($${fib.l5.toFixed(2)}-$${fib.l65.toFixed(2)})`,
      });
    } else {
      push({ name: 'Fibonacci Golden Zone', category: 'ICT/SMC', triggered: false, direction: null, reason: 'No clear swing' });
    }
  }

  // 18. Wyckoff Spring/Upthrust (REVERSAL)
  {
    const window = candles.slice(Math.max(0, i - 15), i);
    const rangeLow = Math.min(...window.map(c => c.low));
    const rangeHigh = Math.max(...window.map(c => c.high));
    const spring = candles[i].low < rangeLow && closes[i] > rangeLow && delta[i] > 0;
    const upthrust = candles[i].high > rangeHigh && closes[i] < rangeHigh && delta[i] < 0;
    push({
      name: 'Wyckoff Spring/Upthrust', category: 'REVERSAL',
      triggered: spring || upthrust,
      direction: spring ? 'LONG' : upthrust ? 'SHORT' : null,
      reason: spring ? 'Spring: swept range low then reclaimed on positive delta' : upthrust ? 'Upthrust: swept range high then rejected on negative delta' : 'No pattern',
    });
  }

  // 19. Squeeze Momentum (BREAKOUT) — BB inside Keltner-like ATR channel
  {
    const kcUpper = ema21[i] + 1.5 * atr14[i];
    const kcLower = ema21[i] - 1.5 * atr14[i];
    const squeezeOn = bb.upper[i] < kcUpper && bb.lower[i] > kcLower;
    const wasSqueezeOn = bb.upper[i - 1] < (ema21[i - 1] + 1.5 * atr14[i - 1]) && bb.lower[i - 1] > (ema21[i - 1] - 1.5 * atr14[i - 1]);
    const justFired = wasSqueezeOn && !squeezeOn;
    const dir = macdRes.histogram[i] > 0 ? 'LONG' : 'SHORT';
    push({
      name: 'Squeeze Momentum (TTM)', category: 'BREAKOUT',
      triggered: justFired,
      direction: justFired ? dir : null,
      reason: `Bollinger/Keltner squeeze just released, momentum histogram ${macdRes.histogram[i] > 0 ? 'positive' : 'negative'}`,
    });
  }

  // 20. Quasimodo (QM) (ICT/SMC) — simplified: HH-HL-LH-break-of-HL structure
  {
    const recent = swings.slice(-4);
    if (recent.length === 4) {
      const [a, b, c, d] = recent;
      const qmBullish = a.type === 'low' && b.type === 'high' && c.type === 'low' && d.type === 'high'
        && c.price < a.price && closes[i] > b.price;
      const qmBearish = a.type === 'high' && b.type === 'low' && c.type === 'high' && d.type === 'low'
        && c.price > a.price && closes[i] < b.price;
      push({
        name: 'Quasimodo (QM)', category: 'ICT/SMC',
        triggered: qmBullish || qmBearish,
        direction: qmBullish ? 'LONG' : qmBearish ? 'SHORT' : null,
        reason: qmBullish ? 'QM bullish structure: failed low then break above prior high' : qmBearish ? 'QM bearish structure: failed high then break below prior low' : 'No QM pattern',
      });
    } else {
      push({ name: 'Quasimodo (QM)', category: 'ICT/SMC', triggered: false, direction: null, reason: 'Insufficient swing history' });
    }
  }

  // 21. Darvas Box (BREAKOUT)
  {
    const window = candles.slice(Math.max(0, i - 10), i);
    const boxHigh = Math.max(...window.map(c => c.high));
    const boxLow = Math.min(...window.map(c => c.low));
    const breakUp = closes[i] > boxHigh && closes[i - 1] <= boxHigh;
    const breakDown = closes[i] < boxLow && closes[i - 1] >= boxLow;
    push({
      name: 'Darvas Box', category: 'BREAKOUT',
      triggered: breakUp || breakDown,
      direction: breakUp ? 'LONG' : breakDown ? 'SHORT' : null,
      reason: `Price broke ${breakUp ? 'above' : 'below'} 10-candle Darvas box ($${boxLow.toFixed(2)}-$${boxHigh.toFixed(2)})`,
    });
  }

  return results;
}

export { ema, rsi, stochRsi, macd, atr, bollinger, vwap, volumeDelta };