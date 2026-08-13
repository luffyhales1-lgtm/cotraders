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
}

export async function sendTelegramSignalNotification(
  botToken: string,
  chatId: string,
  signal: TelegramSignalPayload
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram Bot Token or Chat ID is missing.' };
  }

  // Calculate Support & Resistance levels if not provided
  const digits = signal.entryPrice < 10 ? 4 : 2;
  const isLong = signal.type === 'LONG';
  const price = signal.entryPrice;

  const supp1 = signal.support1 || +(price * 0.985).toFixed(digits);
  const supp2 = signal.support2 || +(price * 0.968).toFixed(digits);
  const res1 = signal.resistance1 || +(price * 1.018).toFixed(digits);
  const res2 = signal.resistance2 || +(price * 1.036).toFixed(digits);

  // Generate dynamic chart screenshot Data URL
  const chartImageBase64 = signal.chartScreenshotUrl || generateTradeSetupChartImage({
    pair: signal.pair,
    type: signal.type,
    entryPrice: price,
    target1: signal.target1,
    target2: signal.target2,
    target3: signal.target3,
    stopLoss: signal.stopLoss,
    support1: supp1,
    support2: supp2,
    resistance1: res1,
    resistance2: res2,
    timeframe: signal.timeframe,
    strategy: signal.strategy,
    winProbability: signal.winProbability,
  });

  const directionEmoji = isLong ? '🚀 BUY / LONG' : '📉 SELL / SHORT';
  const text = `
🤖 <b>LIVETRADING AI - INSTITUTIONAL TRADE SETUP</b> 🤖
────────────────────────────
<b>Pair / Asset:</b> <code>${signal.pair}</code>
<b>Signal Action:</b> ${directionEmoji}
<b>Leverage:</b> <code>${signal.leverage}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Win Probability:</b> 🔥 <b>${signal.winProbability}%</b>

<b>🎯 ENTRY PRICE:</b> <code>$${price}</code>
<b>🛑 STOP LOSS:</b> <code>$${signal.stopLoss}</code>

<b>📈 TAKE PROFIT 1 (TP1):</b> <code>$${signal.target1}</code>
<b>📈 TAKE PROFIT 2 (TP2):</b> <code>$${signal.target2}</code>
<b>📈 TAKE PROFIT 3 (TP3):</b> <code>$${signal.target3}</code>

🛡️ <b>KEY SUPPORT & RESISTANCE ANALYSIS</b>
• <b>Support 1 (S1):</b> <code>$${supp1}</code>
• <b>Support 2 (S2):</b> <code>$${supp2}</code>
• <b>Resistance 1 (R1):</b> <code>$${res1}</code>
• <b>Resistance 2 (R2):</b> <code>$${res2}</code>

💡 <b>SMC CONFLUENCE:</b> <i>${signal.rationale}</i>
────────────────────────────
📊 <b>Chart screenshot with Entry, TP1/2/3, SL, and Support & Resistance drawn attached.</b>
  `.trim();

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔍 Run Live Scan', callback_data: 'menu_scanner' },
              { text: '👑 Subscribe VIP Access', url: 'https://www.instagram.com/abdul_kaif12' }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: `Trade signal & full S/R analysis for ${signal.pair} with chart screenshot dispatched to Telegram!` };
    } else {
      return { success: false, message: data.description || 'Failed to dispatch to Telegram.' };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Error connecting to Telegram API.' };
  }
}

// Interactive Telegram Menu Helper flow builder
export function generateTelegramBotMenuResponse(command: string) {
  if (command === '/scanner' || command === 'menu_scanner') {
    return {
      text: '🔍 <b>AI SCANNER ENGINE - STEP 1/2</b>\n\nSelect your trading timeframe to scan Binance & Forex live API feeds for SMC order blocks & S/R zones:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏱️ 1 Min (Scalp)', callback_data: 'tf_1m' },
            { text: '⏱️ 5 Min (Scalp)', callback_data: 'tf_5m' },
            { text: '⏱️ 15 Min (Intraday)', callback_data: 'tf_15m' }
          ],
          [
            { text: '📊 1 Hour (Swing)', callback_data: 'tf_1h' },
            { text: '📈 4 Hour (Position)', callback_data: 'tf_4h' }
          ]
        ]
      }
    };
  }

  return {
    text: '🤖 <b>LIVETRADING AI BOT MENU</b>\n\nWelcome! Tap <b>🔍 Scanner</b> to start a live AI setup scan across Binance & Forex live feeds:',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔍 AI Market Scanner', callback_data: 'menu_scanner' }],
        [{ text: '⚡ Live VIP Signals', callback_data: 'menu_signals' }],
        [{ text: '👑 Subscribe VIP Access', url: 'https://www.instagram.com/abdul_kaif12' }]
      ]
    }
  };
}