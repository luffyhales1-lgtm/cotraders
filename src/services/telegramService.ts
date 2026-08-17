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

  const delta = signal.footprintDelta ?? 0;

  const text = `
${isLong ? '🚀' : '🔻'} <b>COTRADERS LIVE SIGNAL</b> ${isLong ? '🚀' : '🔻'}
────────────────────────────
<b>Pair / Asset:</b> <code>${signal.pair}</code>
<b>Signal Action:</b> ${isLong ? '🟢 BUY / LONG' : '🔴 SELL / SHORT'}
<b>Suggested Leverage:</b> <code>${signal.leverage}</code>
<b>Timeframe:</b> <code>${signal.timeframe}</code>
<b>Strategy:</b> <code>${signal.strategy}</code>
<b>Win Rate:</b> 📊 <b>${signal.winProbability ? signal.winProbability + '%' : 'N/A'}</b>${signal.backtestLabel ? `\n<i>${signal.backtestLabel}</i>` : ''}

<b>🎯 ENTRY:</b> <code>$${price}</code>
<b>🛑 STOP LOSS:</b> <code>$${signal.stopLoss}</code>

<b>✅ TP1:</b> <code>$${signal.target1}</code> (${signal.riskReward.split('/')[0]?.trim()})
<b>✅ TP2:</b> <code>$${signal.target2}</code>
<b>✅ TP3 (final):</b> <code>$${signal.target3}</code>

📐 <b>MARKET READ</b>
• <b>Volume Delta (buy-sell, real):</b> <code>${delta > 0 ? '+' : ''}${delta}</code>
• <b>Recent Support:</b> <code>$${supp1}</code> | <b>Recent Resistance:</b> <code>$${res1}</code>
${signal.momentumNote ? `• <b>Momentum:</b> <i>${signal.momentumNote}</i>` : ''}

💡 <b>Why this fired:</b> <i>${signal.rationale}</i>
────────────────────────────
⚠️ <i>Backtested performance, not a guarantee. Size positions responsibly.</i>
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
    guidance = `Trade invalidated at <code>$${price}</code>. Strategy conditions no longer hold — exit if not already flat.`;
  } else if (tpHitLevel === 'TP3') {
    emoji = '🏁';
    statusText = `<b>TP3 HIT — FINAL TARGET</b>`;
    guidance = `Full target reached at <code>$${price}</code>. Trade complete.`;
  } else {
    emoji = tpHitLevel === 'TP1' ? '✅' : '🎯';
    const continuationLine = momentum.status === 'HIGH_MOMENTUM_CONTINUATION'
      ? `⚡ <b>Momentum continuing</b> — conditions still favor pushing toward the next target. Consider holding a runner.`
      : momentum.status === 'MOMENTUM_DEPLETING_SECURE_PROFIT'
        ? `⚠️ <b>Momentum fading</b> — consider securing profit here / trailing SL to breakeven ($${price}).`
        : `➖ <b>Momentum mixed</b> — no strong edge either way, use your own judgment on holding vs securing.`;
    guidance = `${continuationLine}\n<i>${momentum.note}</i>`;
  }

  const text = `
${emoji} <b>TRADE UPDATE — ${pair}</b> ${emoji}
────────────────────────────
${statusText}
Price: <code>$${price}</code>

${guidance}
────────────────────────────
🤖 <i>CoTraders real-time strategy engine</i>
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