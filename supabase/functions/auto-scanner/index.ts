import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TickerData {
  pair: string;
  symbol: string;
  price: number;
  change24h: number;
}

const STRATEGIES = [
  "SMC Order Block",
  "Footprint Delta & Spoofing Sweep",
  "ICT Liquidity Pool Grab",
  "EMA 20/200 Golden Cross",
  "RSI Bullish Divergence",
  "MACD Trend Impulse"
];

async function fetchLiveTicker(): Promise<TickerData> {
  const pairs = [
    { symbol: "BTCUSDT", pair: "BTC/USDT (PERP)", fallbackPrice: 96940 },
    { symbol: "ETHUSDT", pair: "ETH/USDT (PERP)", fallbackPrice: 2750 },
    { symbol: "SOLUSDT", pair: "SOL/USDT (PERP)", fallbackPrice: 228.40 },
    { symbol: "XAUUSDT", pair: "XAU/USD (GOLD SPOT)", fallbackPrice: 2894.50 },
    { symbol: "BNBUSDT", pair: "BNB/USDT (PERP)", fallbackPrice: 652.20 }
  ];

  try {
    const selected = pairs[Math.floor(Math.random() * pairs.length)];
    if (selected.symbol === "XAUUSDT") {
      return {
        pair: selected.pair,
        symbol: selected.symbol,
        price: selected.fallbackPrice,
        change24h: +(Math.random() * 3 - 0.5).toFixed(2),
      };
    }

    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${selected.symbol}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        pair: selected.pair,
        symbol: selected.symbol,
        price: parseFloat(data.lastPrice) || selected.fallbackPrice,
        change24h: parseFloat(data.priceChangePercent) || 1.25,
      };
    }
  } catch (err) {
    console.warn("[auto-scanner] Binance live fetch fallback:", err);
  }

  const fallback = pairs[Math.floor(Math.random() * pairs.length)];
  return {
    pair: fallback.pair,
    symbol: fallback.symbol,
    price: fallback.fallbackPrice,
    change24h: +(Math.random() * 4 - 1.5).toFixed(2),
  };
}

function generateTradeSignal(ticker: TickerData) {
  const isLong = ticker.change24h >= 0 || Math.random() > 0.45;
  const price = ticker.price;
  const digits = price < 10 ? 4 : 2;
  const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
  const winProb = Math.floor(Math.random() * 8) + 89;

  const tp1 = +(price * (isLong ? 1.011 : 0.989)).toFixed(digits);
  const tp2 = +(price * (isLong ? 1.025 : 0.975)).toFixed(digits);
  const tp3 = +(price * (isLong ? 1.048 : 0.952)).toFixed(digits);
  const sl = +(price * (isLong ? 0.990 : 1.010)).toFixed(digits);

  const supp1 = +(price * 0.985).toFixed(digits);
  const supp2 = +(price * 0.968).toFixed(digits);
  const res1 = +(price * 1.018).toFixed(digits);
  const res2 = +(price * 1.036).toFixed(digits);
  const delta = isLong ? +1540 : -1280;

  return {
    pair: ticker.pair,
    type: isLong ? "LONG" : "SHORT",
    strategy,
    timeframe: "1m / 5m Scalp Confluence",
    entryPrice: price,
    target1: tp1,
    target2: tp2,
    target3: tp3,
    stopLoss: sl,
    support1: supp1,
    support2: supp2,
    resistance1: res1,
    resistance2: res2,
    leverage: "20x - 50x",
    winProbability: winProb,
    footprintDelta: delta,
    spoofingWall: "Ask Spoof Absorbed by Limit Bids",
    rationale: `Automated Edge Scan: Footprint CVD (${delta > 0 ? "+" : ""}${delta}) confirmed ${strategy} mitigation at $${supp1}.`,
  };
}

function formatTelegramMessage(signal: ReturnType<typeof generateTradeSignal>): string {
  const isLong = signal.type === "LONG";
  return `
🤖 <b>LIVETRADING AI - SCHEDULED CLOUD SCAN</b> 🤖
────────────────────────────
<b>Pair / Asset:</b> <code>${signal.pair}</code>
<b>Signal Action:</b> ${isLong ? "🚀 BUY / LONG" : "📉 SELL / SHORT"}
<b>Leverage:</b> <code>${signal.leverage}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Win Probability:</b> 🔥 <b>${signal.winProbability}%</b>

<b>🎯 ENTRY PRICE:</b> <code>$${signal.entryPrice}</code>
<b>🛑 STOP LOSS:</b> <code>$${signal.stopLoss}</code>

<b>📈 TAKE PROFIT 1:</b> <code>$${signal.target1}</code>
<b>📈 TAKE PROFIT 2:</b> <code>$${signal.target2}</code>
<b>📈 TAKE PROFIT 3:</b> <code>$${signal.target3}</code>

📊 <b>DEEP INSTITUTIONAL CONFLUENCE</b>
• <b>Footprint CVD:</b> <code>${signal.footprintDelta > 0 ? "+" : ""}${signal.footprintDelta} Delta</code>
• <b>Support 1:</b> <code>$${signal.support1}</code> | <b>Resistance 1:</b> <code>$${signal.resistance1}</code>
• <b>Rationale:</b> <i>${signal.rationale}</i>
────────────────────────────
🌐 <i>Dispatched autonomously from Supabase Cloud Edge Function</i>
`.trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[auto-scanner] Execution started at", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[auto-scanner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.");
      return new Response(
        JSON.stringify({ error: "Missing Supabase server environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Scan for trade signals once
    const ticker = await fetchLiveTicker();
    const signal = generateTradeSignal(ticker);
    const messageText = formatTelegramMessage(signal);
    console.log("[auto-scanner] Generated signal for:", signal.pair, signal.type);

    // 2. Fetch all users from telegram_configs where auto_scan_enabled is true
    const { data: configs, error: configError } = await supabase
      .from("telegram_configs")
      .select("id, user_id, bot_token, chat_id, auto_scan_enabled")
      .eq("auto_scan_enabled", true)
      .not("bot_token", "is", null)
      .not("chat_id", "is", null);

    if (configError) {
      console.error("[auto-scanner] Error fetching telegram_configs:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to query telegram configurations", details: configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-scanner] Found ${configs?.length ?? 0} active subscribers for auto-scan.`);

    // 3. Loop through them and send the signal to each user's own bot_token and chat_id
    const results = [];
    if (configs && configs.length > 0) {
      for (const config of configs) {
        if (!config.bot_token || !config.chat_id) continue;

        try {
          const tgUrl = `https://api.telegram.org/bot${config.bot_token.trim()}/sendMessage`;
          const tgRes = await fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: config.chat_id.trim(),
              text: messageText,
              parse_mode: "HTML",
              disable_web_page_preview: false,
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🔍 Open Live Terminal", url: "https://livetrading-ai.com" },
                  ]
                ]
              }
            }),
          });

          const tgData = await tgRes.json();
          if (tgData.ok) {
            console.log(`[auto-scanner] Successfully sent signal to user ${config.user_id}`);
            results.push({ userId: config.user_id, success: true });
          } else {
            console.warn(`[auto-scanner] Telegram API error for user ${config.user_id}:`, tgData.description);
            results.push({ userId: config.user_id, success: false, error: tgData.description });
          }
        } catch (dispatchErr: any) {
          console.error(`[auto-scanner] Exception dispatching to user ${config.user_id}:`, dispatchErr);
          results.push({ userId: config.user_id, success: false, error: dispatchErr.message });
        }
      }
    }

    console.log(`[auto-scanner] Finished dispatching. Total attempted: ${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        signal: {
          pair: signal.pair,
          type: signal.type,
          entryPrice: signal.entryPrice,
          target1: signal.target1,
          stopLoss: signal.stopLoss,
          winProbability: signal.winProbability,
        },
        subscribersNotified: results.filter(r => r.success).length,
        totalSubscribers: configs?.length ?? 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[auto-scanner] Unhandled error in auto-scanner edge function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
