import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';

export interface TelegramSignalPayload {
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
  backtestLabel?: string;
  momentumNote?: string;
  // enriched analysis fields
  rsiValue?: number;
  rsiDivergence?: 'bullish' | 'bearish' | null;
  atrPercent?: number;
  positionSizeNote?: string;
  confidenceScore?: number;
  confluenceCount?: number;
  assetClass?: 'CRYPTO' | 'GOLD' | 'SILVER' | 'FOREX';
  momentumStatus?: 'HIGH_MOMENTUM_CONTINUATION' | 'MOMENTUM_DEPLETING_SECURE_PROFIT' | 'NEUTRAL';
}

// Public CORS proxies used as a fallback when the browser can't reach
// api.telegram.org directly (region block / network filter / rejected CORS
// preflight). Same resilient pattern the news service uses.
const TELEGRAM_CORS_PROXIES: ((u: string) => string)[] = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

/** fetch() that aborts after `ms` so a blocked call can't hang the UI. */
async function fetchAbortable(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Encode Telegram params into a GET query string (arrays/objects → JSON). */
function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return q.toString();
}

/**
 * Resilient Telegram Bot API call. The common "Failed to fetch" comes from the
 * browser being unable to open the request at all — a POST with a JSON body
 * triggers a CORS preflight (OPTIONS) that some networks/regions drop, and
 * api.telegram.org is outright blocked on many ISPs. So we try, in order:
 *   1. Direct GET (a "simple" request — NO preflight, most likely to succeed).
 *   2. Direct POST+JSON (works where CORS is fully allowed).
 *   3. The same GET routed through public CORS proxies.
 * Returns Telegram's parsed JSON, or throws a clear, user-facing error.
 */
async function callTelegramApi(
  botToken: string,
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  const base = `https://api.telegram.org/bot${botToken}/${method}`;
  const getUrl = `${base}?${toQuery(params)}`;

  // 1) Direct GET — no preflight, so it clears the most common failure mode.
  try {
    const res = await fetchAbortable(getUrl, 12000);
    return await res.json();
  } catch { /* fall through */ }

  // 2) Direct POST + JSON — for environments where full CORS is permitted.
  try {
    const res = await fetchAbortable(base, 12000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch { /* fall through */ }

  // 3) Proxy the GET — last resort when api.telegram.org is network-blocked.
  for (const proxy of TELEGRAM_CORS_PROXIES) {
    try {
      const res = await fetchAbortable(proxy(getUrl), 12000);
      const raw = await res.text();
      try { return JSON.parse(raw); } catch { /* proxy returned non-JSON, try next */ }
    } catch { /* try next proxy */ }
  }

  throw new Error(
    'Could not reach Telegram. Your network or region may be blocking api.telegram.org — try another network/VPN, and double-check the bot token & chat ID in Bot Settings.',
  );
}

function assetBadge(assetClass?: string): string {
  switch (assetClass) {
    case 'GOLD': return '🥇 GOLD';
    case 'SILVER': return '🥈 SILVER';
    case 'FOREX': return '💱 FOREX';
    default: return '🪙 CRYPTO';
  }
}

// Turns a 0-100 conviction score into a fire-bar so it reads at a glance.
function convictionBar(score?: number): string {
  if (score == null) return '';
  const flames = Math.max(1, Math.min(5, Math.round(score / 20)));
  return '🔥'.repeat(flames) + '▫️'.repeat(5 - flames);
}

/**
 * Converts a Telegram {ok:false} response into a clear, actionable message.
 * The overwhelmingly common cause after adding a NEW bot is that the saved
 * Chat ID belonged to the OLD bot (chat IDs are per bot↔user conversation) or
 * the user never pressed Start on the new bot — Telegram then answers
 * "chat not found". We spell that out instead of a vague rejection.
 */
function explainTelegramError(data: any): string {
  const code = data?.error_code;
  const desc: string = data?.description || '';
  const d = desc.toLowerCase();

  if (d.includes('chat not found')) {
    return 'Telegram: "chat not found". Your Chat ID doesn\'t match this bot. Open Telegram, search your NEW bot, press START (send it any message), then get your fresh Chat ID from https://api.telegram.org/bot<token>/getUpdates and paste it in Bot Settings. Note: each bot has its own Chat ID.';
  }
  if (d.includes('bot was blocked') || d.includes('user is deactivated')) {
    return 'Telegram: you blocked this bot. Unblock it in Telegram and press START, then try again.';
  }
  if (d.includes('bots can\'t send messages to bots')) {
    return 'Telegram: the Chat ID points at another bot. Use YOUR personal chat ID (or a channel/group ID where the bot is an admin).';
  }
  if (code === 401 || d.includes('unauthorized')) {
    return 'Telegram: "unauthorized" — the Bot Token is wrong or was revoked. Copy the exact token from @BotFather (format 123456789:AA...) into Bot Settings.';
  }
  if (code === 400 && d.includes('not enough rights')) {
    return 'Telegram: the bot lacks permission in that channel/group. Add the bot as an admin with "Post Messages" enabled.';
  }
  if (desc) return `Telegram rejected the message: "${desc}". Verify your Bot Token and Chat ID in Bot Settings.`;
  return 'Telegram rejected the message. Make sure you pressed START on your new bot, then re-copy your Chat ID (each bot has its own) and Bot Token in Bot Settings.';
}

/**
 * Validates a bot token + chat ID WITHOUT sending a full signal. Calls getMe
 * (token check) then sends a tiny confirmation message (chat-ID check). Powers
 * the "Test Connection" button in Bot Settings so users get instant feedback.
 */
export async function testTelegramConnection(
  botToken: string,
  chatId: string,
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Enter both your Bot Token and Chat ID first.' };
  }
  // 1) Token valid?
  try {
    const me = await callTelegramApi(botToken, 'getMe', {});
    if (!me.ok) {
      return { success: false, message: explainTelegramError(me) };
    }
    const botName = me.result?.username ? `@${me.result.username}` : 'your bot';
    // 2) Can it actually deliver to this chat?
    const sent = await callTelegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text: `✅ CoTraders connected to ${botName}. Your Telegram alerts are working!`,
      parse_mode: 'HTML',
    });
    return sent.ok
      ? { success: true, message: `Connected! A test message from ${botName} was delivered to your chat.` }
      : { success: false, message: explainTelegramError(sent) };
  } catch (e: any) {
    return { success: false, message: e.message || 'Could not reach Telegram.' };
  }
}

export async function sendTelegramSignalNotification(
  botToken: string,
  chatId: string,
  signal: TelegramSignalPayload
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram Bot Token or Chat ID is missing.' };
  }

  const digits = signal.entryPrice < 10 ? 4 : 2;
  const isLong = signal.type === 'LONG';
  const price = signal.entryPrice;

  const supp1 = signal.support1 || +(price * 0.985).toFixed(digits);
  const res1 = signal.resistance1 || +(price * 1.018).toFixed(digits);

  const delta = signal.footprintDelta ?? 0;
  const slPct = price ? Math.abs(((signal.stopLoss - price) / price) * 100).toFixed(2) : '0';

  // RSI + divergence line -- exactly what the user asked for ("use rsi for
  // every trade signal by measuring market divergence").
  let rsiLine = '';
  if (signal.rsiValue != null) {
    if (signal.rsiDivergence) {
      const confirms = (signal.rsiDivergence === 'bullish' && isLong) || (signal.rsiDivergence === 'bearish' && !isLong);
      rsiLine = `📉 <b>RSI(14):</b> <code>${signal.rsiValue}</code> | Divergence: <b>${signal.rsiDivergence.toUpperCase()}</b> ${confirms ? '✅ (confirms)' : '⚠️ (caution)'}`;
    } else {
      rsiLine = `📉 <b>RSI(14):</b> <code>${signal.rsiValue}</code> | No active divergence`;
    }
  }

  const convLine = signal.confidenceScore != null
    ? `🎯 <b>Conviction:</b> <b>${signal.confidenceScore}/100</b> ${convictionBar(signal.confidenceScore)}`
    : '';

  const rrParts = signal.riskReward.split('/').map(s => s.trim());

  const text = `
${isLong ? '🚀🟢' : '🔻🔴'} <b>COTRADERS LIVE SIGNAL</b> ${isLong ? '🟢🚀' : '🔴🔻'}
━━━━━━━━━━━━━━━━━━━━
💎 <b>Pair:</b> <code>${signal.pair}</code>  ·  ${assetBadge(signal.assetClass)}
📊 <b>Action:</b> ${isLong ? '🟢 BUY / LONG' : '🔴 SELL / SHORT'}
${convLine}
⚙️ <b>Strategy:</b> <code>${signal.strategy}</code>${signal.confluenceCount && signal.confluenceCount > 1 ? ` <b>(+${signal.confluenceCount - 1} confluence)</b>` : ''}
⏱️ <b>Timeframe:</b> <code>${signal.timeframe}</code>
📈 <b>Backtest Win Rate:</b> <b>${signal.winProbability ? signal.winProbability + '%' : 'N/A'}</b>${signal.backtestLabel ? `\n<i>${signal.backtestLabel}</i>` : ''}

━━ 📋 <b>TRADE PLAN</b> ━━
🎯 <b>Entry:</b> <code>$${price}</code>
🛑 <b>Stop Loss:</b> <code>$${signal.stopLoss}</code> <i>(-${slPct}%)</i>
✅ <b>TP1:</b> <code>$${signal.target1}</code> <i>(${rrParts[0] || ''})</i>
✅ <b>TP2:</b> <code>$${signal.target2}</code>
🏁 <b>TP3 (final):</b> <code>$${signal.target3}</code>

━━ ⚖️ <b>RISK &amp; SIZING</b> ━━
🔧 <b>Leverage:</b> <code>${signal.leverage}</code>
💰 <b>Trade Size:</b> <i>${signal.positionSizeNote || 'Risk 1-2% of account per trade.'}</i>
📐 <b>R:R:</b> <code>${signal.riskReward}</code>

━━ 🔬 <b>MARKET READ</b> ━━
📊 <b>Footprint Delta (real buy-sell):</b> <code>${delta > 0 ? '+' : ''}${delta}</code>
${rsiLine}
🟢 <b>Support:</b> <code>$${supp1}</code>  ·  🔴 <b>Resistance:</b> <code>$${res1}</code>
${signal.momentumNote ? `⚡ <b>Momentum:</b> <i>${signal.momentumNote}</i>` : ''}

💡 <b>Why it fired:</b> <i>${signal.rationale}</i>
━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Backtested performance, not a guarantee. Size positions responsibly.</i>
  `.trim();

  try {
    const data = await callTelegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Run Live Scan', callback_data: 'menu_scanner' },
            { text: '📊 Immediate Backtest Report', callback_data: 'menu_backtest' }
          ]
        ]
      },
    });
    return data.ok
      ? { success: true, message: `Trade signal & S/R analysis for ${signal.pair} sent to Telegram!` }
      : { success: false, message: explainTelegramError(data) };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error connecting to Telegram API.' };
  }
}

// Send TP1/TP2/TP3/SL hit notification, driven by a REAL momentum read
// (see describeMomentum in signalEngine.ts) rather than a coin flip.
export async function sendTpHitTelegramNotification(
  botToken: string,
  chatId: string,
  pair: string,
  tpHitLevel: 'TP1' | 'TP2' | 'TP3' | 'SL',
  price: number,
  momentum: { status: 'HIGH_MOMENTUM_CONTINUATION' | 'MOMENTUM_DEPLETING_SECURE_PROFIT' | 'NEUTRAL'; note: string }
): Promise<boolean> {
  if (!botToken || !chatId) return false;

  let emoji = '🎯';
  let statusText = `<b>${tpHitLevel} HIT!</b>`;
  let guidance = '';

  if (tpHitLevel === 'SL') {
    emoji = '🛑';
    statusText = `<b>STOP LOSS TRIGGERED</b>`;
    guidance = `❌ Trade invalidated at <code>$${price}</code>. Strategy conditions no longer hold — exit if not already flat.`;
  } else if (tpHitLevel === 'TP3') {
    emoji = '🏁';
    statusText = `<b>TP3 HIT — FINAL TARGET 🎉</b>`;
    guidance = `✅ Full target reached at <code>$${price}</code>. <b>Close the remaining position — trade complete.</b>`;
  } else {
    emoji = tpHitLevel === 'TP1' ? '✅' : '🎯';
    const nextTarget = tpHitLevel === 'TP1' ? 'TP2' : 'TP3';
    const decision = momentum.status === 'HIGH_MOMENTUM_CONTINUATION'
      ? `🟢 <b>HOLD / CONTINUE</b> — market still has momentum. Keep a runner toward <b>${nextTarget}</b>, trail your SL up to protect gains.`
      : momentum.status === 'MOMENTUM_DEPLETING_SECURE_PROFIT'
        ? `🔴 <b>TAKE PROFIT NOW</b> — momentum is fading. Bank the win here (or close most of the position) and move SL to breakeven (<code>$${price}</code>).`
        : `🟡 <b>PARTIAL / YOUR CALL</b> — momentum is mixed. Take part off the table and trail SL to breakeven (<code>$${price}</code>).`;
    guidance = `${decision}\n<i>${momentum.note}</i>`;
  }

  const text = `
${emoji} <b>TRADE UPDATE — ${pair}</b> ${emoji}
━━━━━━━━━━━━━━━━━━━━
${statusText}
💵 Price: <code>$${price}</code>

${guidance}
━━━━━━━━━━━━━━━━━━━━
🤖 <i>CoTraders real-time strategy engine</i>
  `.trim();

  try {
    await callTelegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
    return true;
  } catch (e) {
    return false;
  }
}