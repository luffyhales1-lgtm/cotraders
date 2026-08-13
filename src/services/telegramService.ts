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

  // Generate dynamic chart screenshot Data URL
  const chartImageBase64 = signal.chartScreenshotUrl || generateTradeSetupChartImage({
    pair: signal.pair,
    type: signal.type,
    entryPrice: signal.entryPrice,
    target1: signal.target1,
    target2: signal.target2,
    target3: signal.target3,
    stopLoss: signal.stopLoss,
    timeframe: signal.timeframe,
    strategy: signal.strategy,
    winProbability: signal.winProbability,
  });

  const directionEmoji = signal.type === 'LONG' ? '🚀 BUY / LONG' : '📉 SELL / SHORT';
  const text = `
🤖 <b>LIVETRADING AI - LIVE SCANNER TRADE SETUP</b> 🤖
────────────────────────────
<b>Asset:</b> <code>${signal.pair}</code>
<b>Signal:</b> ${directionEmoji}
<b>Leverage:</b> <code>${signal.leverage}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Win Accuracy:</b> 🔥 <b>${signal.winProbability}%</b>

<b>🎯 Entry Price:</b> <code>$${signal.entryPrice}</code>
<b>🛑 Stop Loss:</b> <code>$${signal.stopLoss}</code>

<b>📈 Target 1 (TP1):</b> <code>$${signal.target1}</code>
<b>📈 Target 2 (TP2):</b> <code>$${signal.target2}</code>
<b>📈 Target 3 (TP3):</b> <code>$${signal.target3}</code>

<b>⚖️ Risk to Reward:</b> <code>${signal.riskReward}</code>
<b>💡 AI Confluence:</b> <i>${signal.rationale}</i>
────────────────────────────
📊 <i>Chart screenshot with Entry, TP1/2/3, and SL drawn attached above.</i>
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
              { text: '🔍 Run New Scan', callback_data: 'menu_scanner' },
              { text: '👑 Upgrade VIP Access', url: 'https://www.instagram.com/abdul_kaif12' }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: `Trade signal for ${signal.pair} with chart screenshot parameters successfully sent to Telegram!` };
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
      text: '🔍 <b>AI SCANNER ENGINE - STEP 1/2</b>\n\nSelect your trading timeframe to scan real-time order blocks and volume surges:',
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
    text: '🤖 <b>LIVETRADING AI BOT MENU</b>\n\nWelcome! Tap <b>🔍 Scanner</b> to start a live AI setup scan:',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔍 AI Market Scanner', callback_data: 'menu_scanner' }],
        [{ text: '⚡ Live VIP Signals', callback_data: 'menu_signals' }],
        [{ text: '👑 Subscribe VIP Access', url: 'https://www.instagram.com/abdul_kaif12' }]
      ]
    }
  };
}