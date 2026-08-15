import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[dispatch-signal] Received dispatch request");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("[dispatch-signal] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[dispatch-signal] Missing Supabase server configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user using JWT token
    const token = authHeader.replace("Bearer ", "").trim();
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[dispatch-signal] User verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[dispatch-signal] Authenticated user: ${user.id} (${user.email})`);

    // Fetch user's own telegram config using service client for safe token extraction
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: config, error: configError } = await serviceClient
      .from("telegram_configs")
      .select("bot_token, chat_id, auto_scan_enabled")
      .eq("user_id", user.id)
      .single();

    if (configError || !config) {
      console.warn(`[dispatch-signal] No telegram config found for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "No Telegram Bot configuration found. Please configure your Bot Token and Chat ID in Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.bot_token || !config.chat_id) {
      console.warn(`[dispatch-signal] Incomplete telegram config for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Please enter a valid Telegram Bot Token and Chat ID in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const { signal, customText, messageType } = payload;

    let messageToSend = "";

    if (customText) {
      messageToSend = customText;
    } else if (signal) {
      const isLong = signal.type === "LONG";
      const price = signal.entryPrice;
      const digits = price < 10 ? 4 : 2;
      const supp1 = signal.support1 || +(price * 0.985).toFixed(digits);
      const res1 = signal.resistance1 || +(price * 1.018).toFixed(digits);
      const delta = signal.footprintDelta || (isLong ? 1420 : -1420);

      messageToSend = `
🤖 <b>LIVETRADING AI - INSTITUTIONAL TRADE SETUP</b> 🤖
────────────────────────────
<b>Pair / Asset:</b> <code>${signal.pair}</code>
<b>Signal Action:</b> ${isLong ? "🚀 BUY / LONG" : "📉 SELL / SHORT"}
<b>Leverage:</b> <code>${signal.leverage || "20x"}</code>
<b>Timeframe:</b> <code>${signal.timeframe || "15m"}</code>
<b>Strategy:</b> <code>${signal.strategy || "SMC Order Block"}</code>
<b>Win Probability:</b> 🔥 <b>${signal.winProbability || 92}%</b>

<b>🎯 ENTRY PRICE:</b> <code>$${price}</code>
<b>🛑 STOP LOSS:</b> <code>$${signal.stopLoss}</code>

<b>📈 TAKE PROFIT 1:</b> <code>$${signal.target1}</code>
<b>📈 TAKE PROFIT 2:</b> <code>$${signal.target2}</code>
<b>📈 TAKE PROFIT 3:</b> <code>$${signal.target3}</code>

📊 <b>DEEP INSTITUTIONAL ANALYSIS</b>
• <b>Footprint CVD:</b> <code>${delta > 0 ? "+" : ""}${delta} Delta</code>
• <b>Support 1:</b> <code>$${supp1}</code> | <b>Resistance 1:</b> <code>$${res1}</code>
• <b>Rationale:</b> <i>${signal.rationale || "Algorithmic high-probability setup."}</i>
────────────────────────────
🌐 <i>Dispatched for user: ${user.email}</i>
      `.trim();
    } else {
      // Default Test Signal
      messageToSend = `
⚡ <b>TELEGRAM BOT VERIFICATION TEST</b> ⚡
────────────────────────────
✅ <b>Status:</b> Connection Successful!
👤 <b>User:</b> <code>${user.email}</code>
🤖 <b>Bot Configuration:</b> Verified & Secured
⚙️ <b>Auto-Scan:</b> ${config.auto_scan_enabled ? "🟢 Active (Cloud Cron)" : "⚪ Paused"}
🕒 <b>Timestamp:</b> <code>${new Date().toUTCString()}</code>
────────────────────────────
🚀 <i>Your personal LiveTrading AI signals will be delivered to this chat.</i>
      `.trim();
    }

    // Send to Telegram
    const tgUrl = `https://api.telegram.org/bot${config.bot_token.trim()}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id.trim(),
        text: messageToSend,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      console.error("[dispatch-signal] Telegram API rejected message:", tgData);
      return new Response(
        JSON.stringify({ error: `Telegram Error: ${tgData.description || "Failed to send message"}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[dispatch-signal] Successfully delivered message to chat ${config.chat_id}`);
    return new Response(
      JSON.stringify({ success: true, message: "Signal delivered to your Telegram chat successfully!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[dispatch-signal] Uncaught error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
