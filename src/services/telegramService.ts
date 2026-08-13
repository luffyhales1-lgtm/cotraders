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
}

export async function sendTelegramSignalNotification(
  botToken: string,
  chatId: string,
  signal: TelegramSignalPayload
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram Bot Token or Chat ID missing.' };
  }

  const directionEmoji = signal.type === 'LONG' ? '🚀 BUY / LONG' : '📉 SELL / SHORT';
  const text = `
🚨 <b>INSTITUTIONAL AI TRADING SIGNAL</b> 🚨

<b>Asset:</b> <code>${signal.pair}</code>
<b>Direction:</b> ${directionEmoji} (${signal.leverage})
<b>Timeframe:</b> ${signal.timeframe} | <b>Strategy:</b> ${signal.strategy}
<b>Win Probability:</b> 🔥 <b>${signal.winProbability}%</b>

🎯 <b>Entry Price:</b> <code>$${signal.entryPrice}</code>
🛑 <b>Stop Loss:</b> <code>$${signal.stopLoss}</code>

📈 <b>Target 1 (TP1):</b> <code>$${signal.target1}</code>
📈 <b>Target 2 (TP2):</b> <code>$${signal.target2}</code>
📈 <b>Target 3 (TP3):</b> <code>$${signal.target3}</code>

⚖️ <b>Risk to Reward:</b> ${signal.riskReward}
💡 <b>AI Confluence:</b> <i>${signal.rationale}</i>

⚡ <i>Broadcasted via LiveTrading AI Pro Engine</i>
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
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: 'Signal successfully broadcasted to Telegram!' };
    } else {
      return { success: false, message: data.description || 'Failed to dispatch Telegram message.' };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network error connecting to Telegram API.' };
  }
}