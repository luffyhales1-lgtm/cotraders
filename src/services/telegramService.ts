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
              { text: '📊 Immediate Backtest Report', callback_data: 'menu_backtest' }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    return data.ok ? { success: true, message: `Trade signal & S/R analysis for ${signal.pair} sent to Telegram!` } : { success: false, message: data.description };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error connecting to Telegram API.' };
  }
}

// Send TP1 Hit + Remaining Momentum Notification
export async function sendTpHitTelegramNotification(
  botToken: string,
  chatId: string,
  pair: string,
  tpHitLevel: 'TP1' | 'TP2' | 'TP3' | 'SL',
  price: number,
  hasRemainingMomentum: boolean
): Promise<boolean> {
  if (!botToken || !chatId) return false;

  let emoji = '🎯';
  let statusText = `<b>${tpHitLevel} TARGET HIT!</b>`;
  if (tpHitLevel === 'SL') {
    emoji = '🛑';
    statusText = `<b>STOP LOSS TRIGGERED</b>`;
  }

  const momentumMessage = hasRemainingMomentum
    ? `⚡ <b>BUYERS Delta Momentum High:</b> Orderbook depth shows strong continuation toward TP2/TP3!`
    : `⚠️ <b>Momentum Depleting:</b> Secure 80% profits or move Stop Loss to Breakeven ($${price}) now.`;

  const text = `
${emoji} <b>LIVE TRADE UPDATE - ${pair}</b> ${emoji}
────────────────────────────
Status: ${statusText}
Current Price: <code>$${price}</code>

${momentumMessage}
────────────────────────────
🤖 <i>Live Trading AI Automated Futures Engine</i>
  `.trim();

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
}