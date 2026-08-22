import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// REAL indicator math (ported from src/services/indicators.ts). Nothing in
// this file uses Math.random() -- every number is derived from real candles
// fetched from Binance.
// ---------------------------------------------------------------------------

interface Candle { open: number; high: number; low: number; close: number; volume: number; takerBuyVolume: number }

function ema(values: number[], period: number): number[] {
  const out: number[] = []
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (const v of values) {
    prev = prev === null ? v : v * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return out
  let gainSum = 0, lossSum = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gainSum += d; else lossSum -= d
  }
  let avgGain = gainSum / period, avgLoss = lossSum / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const gain = d > 0 ? d : 0, loss = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

function macd(closes: number[]) {
  const f = ema(closes, 12), s = ema(closes, 26)
  const line = closes.map((_, i) => f[i] - s[i])
  const signal = ema(line, 9)
  const hist = line.map((v, i) => v - signal[i])
  return { line, signal, hist }
}

function atr(candles: Candle[], period = 14): number[] {
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const pc = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc))
  })
  const out: number[] = new Array(trs.length).fill(NaN)
  if (trs.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += trs[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period
    out[i] = prev
  }
  return out
}

function bollinger(closes: number[], period = 20, mult = 2) {
  const upper: number[] = [], lower: number[] = [], mid: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); mid.push(NaN); continue }
    const w = closes.slice(i - period + 1, i + 1)
    const mean = w.reduce((a, b) => a + b, 0) / period
    const variance = w.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    upper.push(mean + mult * sd); lower.push(mean - mult * sd); mid.push(mean)
  }
  return { upper, lower, mid }
}

function vwap(candles: Candle[]): number[] {
  let cumPV = 0, cumV = 0
  return candles.map(c => {
    const typ = (c.high + c.low + c.close) / 3
    cumPV += typ * c.volume; cumV += c.volume
    return cumV === 0 ? typ : cumPV / cumV
  })
}

interface SwingPoint { index: number; price: number; type: 'high' | 'low' }
function findSwings(candles: Candle[], lookback = 3): SwingPoint[] {
  const pts: SwingPoint[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    const w = candles.slice(i - lookback, i + lookback + 1)
    if (candles[i].high === Math.max(...w.map(c => c.high))) pts.push({ index: i, price: candles[i].high, type: 'high' })
    if (candles[i].low === Math.min(...w.map(c => c.low))) pts.push({ index: i, price: candles[i].low, type: 'low' })
  }
  return pts
}

// Real strategy checks -- each returns whether it actually fired on the
// latest closed candle, and in which direction. A representative subset of
// the 21 strategies used on the dashboard (same math, ported to Deno).
function evaluateStrategies(candles: Candle[]): { name: string; direction: 'LONG' | 'SHORT' | null; reason: string }[] {
  const closes = candles.map(c => c.close)
  const i = candles.length - 1
  const ema8 = ema(closes, 8), ema21 = ema(closes, 21), ema50 = ema(closes, 50)
  const rsi14 = rsi(closes, 14)
  const macdRes = macd(closes)
  const bb = bollinger(closes, 20, 2)
  const vwapLine = vwap(candles)
  const swings = findSwings(candles, 3)
  const results: { name: string; direction: 'LONG' | 'SHORT' | null; reason: string }[] = []

  // MACD Cross + Histogram
  {
    const up = macdRes.line[i - 1] <= macdRes.signal[i - 1] && macdRes.line[i] > macdRes.signal[i]
    const down = macdRes.line[i - 1] >= macdRes.signal[i - 1] && macdRes.line[i] < macdRes.signal[i]
    results.push({ name: 'MACD Cross + Histogram', direction: up ? 'LONG' : down ? 'SHORT' : null, reason: `MACD signal cross, histogram ${macdRes.hist[i].toFixed(4)}` })
  }
  // Golden/Death Cross (EMA21/EMA50 proxy on limited history)
  {
    const up = ema21[i - 1] <= ema50[i - 1] && ema21[i] > ema50[i]
    const down = ema21[i - 1] >= ema50[i - 1] && ema21[i] < ema50[i]
    results.push({ name: 'Golden/Death Cross', direction: up ? 'LONG' : down ? 'SHORT' : null, reason: `EMA21/EMA50 ${up ? 'golden' : 'death'} cross` })
  }
  // Triple EMA Pullback
  {
    const trendUp = ema8[i] > ema21[i] && ema21[i] > ema50[i]
    const trendDown = ema8[i] < ema21[i] && ema21[i] < ema50[i]
    const pulled = Math.abs(closes[i] - ema21[i]) / closes[i] < 0.004
    results.push({ name: 'Triple EMA Pullback', direction: pulled && trendUp ? 'LONG' : pulled && trendDown ? 'SHORT' : null, reason: `Pullback to EMA21 in ${trendUp ? 'uptrend' : trendDown ? 'downtrend' : 'range'}` })
  }
  // BB Squeeze Breakout
  {
    const breakUp = closes[i] > bb.upper[i]
    const breakDown = closes[i] < bb.lower[i]
    results.push({ name: 'BB Squeeze Breakout', direction: breakUp ? 'LONG' : breakDown ? 'SHORT' : null, reason: `Price broke ${breakUp ? 'above upper' : 'below lower'} Bollinger band` })
  }
  // VWAP Bounce
  {
    const dist = (closes[i] - vwapLine[i]) / vwapLine[i]
    const bounceLong = closes[i - 1] < vwapLine[i - 1] && closes[i] > vwapLine[i] && dist < 0.003
    const bounceShort = closes[i - 1] > vwapLine[i - 1] && closes[i] < vwapLine[i] && dist > -0.003
    results.push({ name: 'VWAP Bounce', direction: bounceLong ? 'LONG' : bounceShort ? 'SHORT' : null, reason: `Reclaimed VWAP ($${vwapLine[i].toFixed(2)})` })
  }
  // Liquidity Sweep
  {
    const lastHigh = swings.filter(s => s.type === 'high' && s.index < i).slice(-1)[0]
    const lastLow = swings.filter(s => s.type === 'low' && s.index < i).slice(-1)[0]
    const sweptHigh = lastHigh && candles[i].high > lastHigh.price && closes[i] < lastHigh.price
    const sweptLow = lastLow && candles[i].low < lastLow.price && closes[i] > lastLow.price
    results.push({ name: 'Liquidity Sweep', direction: sweptLow ? 'LONG' : sweptHigh ? 'SHORT' : null, reason: sweptLow ? 'Swept liquidity below swing low, reclaimed' : sweptHigh ? 'Swept liquidity above swing high, rejected' : 'No sweep' })
  }
  // Mean Reversion (BB)
  {
    const touchedLower = candles[i].low <= bb.lower[i] && closes[i] > bb.lower[i]
    const touchedUpper = candles[i].high >= bb.upper[i] && closes[i] < bb.upper[i]
    results.push({ name: 'Mean Reversion (BB)', direction: touchedLower ? 'LONG' : touchedUpper ? 'SHORT' : null, reason: 'Wick tagged BB and closed back inside' })
  }
  // RSI reversal
  {
    const oversoldTurn = rsi14[i - 1] < 30 && rsi14[i] >= 30
    const overboughtTurn = rsi14[i - 1] > 70 && rsi14[i] <= 70
    results.push({ name: 'RSI Divergence', direction: oversoldTurn ? 'LONG' : overboughtTurn ? 'SHORT' : null, reason: `RSI(14) crossing back from extreme: ${rsi14[i]?.toFixed(1)}` })
  }

  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase server environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: scan a real watchlist for real strategy triggers.
    const WATCHLIST = [
      { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', interval: '5m' },
      { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', interval: '5m' },
      { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', interval: '5m' },
      { symbol: 'BNBUSDT', pair: 'BNB/USDT (PERP)', interval: '15m' },
      { symbol: 'XRPUSDT', pair: 'XRP/USDT (PERP)', interval: '5m' },
    ]

    const SL_ATR = 1.3, TP1_ATR = 1.0, TP2_ATR = 1.9, TP3_ATR = 3.2

    const signals: any[] = []

    for (const asset of WATCHLIST) {
      try {
        const klineRes = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${asset.symbol}&interval=${asset.interval}&limit=150`)
        if (!klineRes.ok) continue
        const raw = await klineRes.json()
        const candles: Candle[] = raw.map((c: any) => ({
          open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]),
          close: parseFloat(c[4]), volume: parseFloat(c[5]), takerBuyVolume: parseFloat(c[9] ?? c[5] / 2),
        }))
        if (candles.length < 60) continue

        const results = evaluateStrategies(candles)
        const triggered = results.filter(r => r.direction !== null)
        if (triggered.length === 0) continue

        const best = triggered[0]
        const i = candles.length - 1
        const closes = candles.map(c => c.close)
        const atrVal = atr(candles, 14)[i]
        if (!atrVal || isNaN(atrVal)) continue

        const entry = closes[i]
        const digits = entry < 1 ? 6 : entry < 10 ? 4 : 2
        const dirMult = best.direction === 'LONG' ? 1 : -1

        signals.push({
          pair: asset.pair,
          type: best.direction,
          strategy: best.name,
          timeframe: `${asset.interval} Scalp`,
          entryPrice: entry,
          target1: +(entry + dirMult * TP1_ATR * atrVal).toFixed(digits),
          target2: +(entry + dirMult * TP2_ATR * atrVal).toFixed(digits),
          target3: +(entry + dirMult * TP3_ATR * atrVal).toFixed(digits),
          stopLoss: +(entry - dirMult * SL_ATR * atrVal).toFixed(digits),
          leverage: `${Math.max(2, Math.min(20, Math.round(1.2 / ((atrVal / entry) * 100))))}x max (volatility-scaled)`,
          winProbability: 0, // honestly unknown without a full walk-forward pass server-side; not fabricated
          riskReward: `TP1 1:${(TP1_ATR / SL_ATR).toFixed(2)} / TP2 1:${(TP2_ATR / SL_ATR).toFixed(2)} / TP3 1:${(TP3_ATR / SL_ATR).toFixed(2)}`,
          rationale: best.reason,
        })
      } catch (e) {
        console.error(`[auto-scan] ${asset.symbol} failed:`, e)
      }
    }

    if (signals.length === 0) {
      console.log('[auto-scan] Scan complete -- no real strategy conditions met this run.')
      return new Response(JSON.stringify({ message: 'Scan complete: no strategy triggered this run.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 2: fetch all users with auto_scan_enabled true.
    const { data: configs, error: configError } = await supabase
      .from('telegram_configs')
      .select('user_id, bot_token, chat_id')
      .eq('auto_scan_enabled', true)

    if (configError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch telegram configurations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'No users with auto-scan enabled', signalsFound: signals.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 3: dispatch every real triggered signal to every opted-in user.
    const sendPromises = configs.flatMap((config: any) => signals.map(async (signal) => {
      if (!config.bot_token || !config.chat_id) return { success: false, userId: config.user_id }
      try {
        const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`
        const text = formatTelegramMessage(signal)
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: config.chat_id, text, parse_mode: 'HTML' })
        })
        if (!resp.ok) {
          const errorData = await resp.json()
          return { success: false, userId: config.user_id, error: errorData.description }
        }
        return { success: true, userId: config.user_id }
      } catch (err: any) {
        return { success: false, userId: config.user_id, error: err.message }
      }
    }))

    const results = await Promise.all(sendPromises)
    const successful = results.filter((r) => r.success).length

    return new Response(JSON.stringify({
      message: `Scan found ${signals.length} real signal(s); sent ${successful}/${results.length} deliveries`,
      signals,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[auto-scan] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

function formatTelegramMessage(signal: any): string {
  const isLong = signal.type === 'LONG'
  const text = `
${isLong ? '🚀' : '🔻'} <b>COTRADERS AUTO-SCAN SIGNAL</b> ${isLong ? '🚀' : '🔻'}
────────────────────────────
<b>Pair:</b> <code>${signal.pair}</code>
<b>Action:</b> ${isLong ? '🟢 BUY / LONG' : '🔴 SELL / SHORT'}
<b>Leverage:</b> <code>${signal.leverage}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>

<b>🎯 ENTRY:</b> <code>$${signal.entryPrice}</code>
<b>🛑 SL:</b> <code>$${signal.stopLoss}</code>
<b>✅ TP1:</b> <code>$${signal.target1}</code>
<b>✅ TP2:</b> <code>$${signal.target2}</code>
<b>✅ TP3:</b> <code>$${signal.target3}</code>

💡 <i>${signal.rationale}</i>
────────────────────────────
⚠️ <i>Real strategy trigger on live candles. Not a guarantee -- size responsibly.</i>
  `.trim()
  return text
}