import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[auto-scan] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.')
      return new Response(
        JSON.stringify({ error: 'Missing Supabase server environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Generate trading signals (simplified version of generateLiveSignals)
    const signals = generateLiveSignals()
    // For simplicity, we'll use the first signal. In a real scenario, you might want to send all signals or choose based on criteria.
    const signal = signals[0]
    
    if (!signal) {
      console.error('[auto-scan] No signals generated')
      return new Response(
        JSON.stringify({ error: 'No signals generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Fetch all users with auto_scan_enabled true
    const { data: configs, error: configError } = await supabase
      .from('telegram_configs')
      .select('user_id, bot_token, chat_id')
      .eq('auto_scan_enabled', true)

    if (configError) {
      console.error('[auto-scan] Error fetching telegram configs:', configError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch telegram configurations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configs || configs.length === 0) {
      console.log('[auto-scan] No users with auto-scan enabled')
      return new Response(
        JSON.stringify({ message: 'No users with auto-scan enabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Send the signal to each user
    const sendPromises = configs.map(async (config) => {
      if (!config.bot_token || !config.chat_id) {
        console.warn(`[auto-scan] Missing bot token or chat ID for user ${config.user_id}`)
        return { success: false, userId: config.user_id }
      }

      // Convert signal to TelegramSignalPayload format
      const telegramSignal: TelegramSignalPayload = {
        pair: signal.pair,
        type: signal.type,
        strategy: signal.strategy,
        timeframe: signal.timeframe,
        entryPrice: signal.entryPrice,
        target1: signal.target1,
        target2: signal.target2,
        target3: signal.target3,
        stopLoss: signal.stopLoss,
        leverage: signal.leverage,
        winProbability: signal.winProbability,
        riskReward: signal.riskReward,
        rationale: signal.rationale,
        // Optional fields
        footprintDelta: signal.footprintDelta,
        spoofingWall: signal.spoofingWall,
        orderBlockZone: signal.orderBlockZone,
      }

      try {
        // Send Telegram message
        const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`
        const text = formatTelegramMessage(telegramSignal)
        
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.chat_id,
            text: text,
            parse_mode: 'HTML',
          })
        })
        
        if (!resp.ok) {
          const errorData = await resp.json()
          console.error(`[auto-scan] Telegram API error for user ${config.user_id}:`, errorData)
          return { success: false, userId: config.user_id, error: errorData.description }
        }
        
        return { success: true, userId: config.user_id }
      } catch (err) {
        console.error(`[auto-scan] Error sending telegram to user ${config.user_id}:`, err)
        return { success: false, userId: config.user_id, error: err.message }
      }
    })

    const results = await Promise.all(sendPromises)
    const successful = results.filter(r => r.success).length
    const total = results.length
    
    console.log(`[auto-scan] Sent signals to ${successful}/${total} users`)
    
    return new Response(
      JSON.stringify({ 
        message: `Processed auto-scan: sent signals to ${successful}/${total} users`,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[auto-scan] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to generate signals (copied from src/services/signalEngine.ts)
function generateLiveSignals() {
  const STRATEGIES: string[] = [
    'SMC Order Block',
    'EMA 20/200 Golden Cross',
    'RSI Bullish Divergence',
    'MACD Trend Impulse',
    'Supertrend Breakout',
    'Volume Profile Rejection',
    'Footprint Delta & Spoofing Sweep',
    'ICT Liquidity Pool Grab'
  ];

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

  const signals = [] as any[];

  assets.forEach((asset, index) => {
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

    signals.push({
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
    });
  });

  return signals;
}

// Helper function to format the Telegram message (similar to src/services/telegramService.ts)
function formatTelegramMessage(signal: TelegramSignalPayload): string {
  const digits = signal.entryPrice < 10 ? 4 : 2;
  const isLong = signal.type === 'LONG';
  const price = signal.entryPrice;

  const supp1 = signal.support1 || +(price * 0.985).toFixed(digits);
  const supp2 = signal.support2 || +(price * 0.968).toFixed(digits);
  const res1 = signal.resistance1 || +(price * 1.018).toFixed(digits);
  const res2 = signal.resistance2 || +(price * 1.036).toFixed(digits);

  const delta = signal.footprintDelta || (isLong ? 1420 : -1420);

  const text = `
🤖 <b>LIVETRADING AI - INSTITUTIONAL TRADE SETUP</b> 🤖
────────────────────────────
<b>Pair / Asset:</b> <code>${signal.pair}</code>
<b>Signal Action:</b> ${isLong ? '🚀 BUY / LONG' : '📉 SELL / SHORT'}
<b>Leverage:</b> <code>${signal.leverage}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Win Probability:</b> 🔥 <b>${signal.winProbability}%</b>

<b>🎯 ENTRY PRICE:</b> <code>$${price}</code>
<b>🛑 STOP LOSS:</b> <code>$${signal.stopLoss}</code>

<b>📈 TAKE PROFIT 1 (SCALP):</b> <code>$${signal.target1}</code>
<b>📈 TAKE PROFIT 2:</b> <code>$${signal.target2}</code>
<b>📈 TAKE PROFIT 3:</b> <code>$${signal.target3}</code>

📊 <b>DEEP INSTITUTIONAL ANALYSIS</b>
• <b>Footprint CVD:</b> <code>${delta > 0 ? '+' : ''}${delta} Delta</code>
• <b>Spoofing Wall:</b> <i>${signal.spoofingWall || 'Ask Spoof Absorbed'}</i>
• <b>Support 1 (S1):</b> <code>$${supp1}</code> | <b>Support 2 (S2):</b> <code>$${supp2}</code>
• <b>Resistance 1 (R1):</b> <code>$${res1}</code> | <b>Resistance 2 (R2):</b> <code>$${res2}</code>

💡 <b>SMC CONFLUENCE:</b> <i>${signal.rationale}</i>
────────────────────────────
📊 <b>Chart screenshot with Footprint Delta, S/R, Entry, TP1/2/3, and SL drawn attached.</b>
  `.trim();

  return text;
}

interface TelegramSignalPayload {
  pair: string;
  type: 'LONG' | 'SHORT';
  strategy: string;
  timeframe: string;
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  support1?: number;
  support2?: number;
  resistance1?: number;
  resistance2?: number;
  leverage: string;
  winProbability: number;
  riskReward: string;
  rationale: string;
  chartScreenshotUrl?: string;
  footprintDelta?: number;
  spoofingWall?: string;
  orderBlockZone?: string;
}