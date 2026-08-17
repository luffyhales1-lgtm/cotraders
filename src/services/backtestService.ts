import { BacktestSummary } from '@/types/trading';
import { fetchKlines } from '@/services/binanceApi';
import { runWalkForwardBacktest } from '@/services/backtestEngine';

/**
 * Runs the REAL walk-forward backtest against live-fetched historical
 * candles for a basket of symbols and rolls it into one summary. Every
 * number here comes from actually simulating trades against real candles --
 * no Math.random().
 */
export async function generateLiveBacktestSummary(
  periodLabel = '1-Hour Window',
  symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  interval = '5m',
): Promise<BacktestSummary> {
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let rSum = 0;
  let bestR = -Infinity;
  let worstR = Infinity;

  for (const symbol of symbols) {
    try {
      const candles = await fetchKlines(symbol, interval, 250);
      if (candles.length < 80) continue;
      const result = runWalkForwardBacktest(candles, 200);
      totalTrades += result.totalTrades;
      totalWins += result.totalWins;
      totalLosses += result.totalLosses;
      if (result.avgRMultiple !== null) {
        rSum += result.avgRMultiple * result.totalTrades;
        bestR = Math.max(bestR, result.avgRMultiple);
        worstR = Math.min(worstR, result.avgRMultiple);
      }
    } catch (e) {
      console.error(`[generateLiveBacktestSummary] ${symbol} failed:`, e);
    }
  }

  const winRate = totalTrades > 0 ? +((totalWins / totalTrades) * 100).toFixed(1) : 0;
  const avgR = totalTrades > 0 ? rSum / totalTrades : 0;

  return {
    period: periodLabel,
    totalTrades,
    winningTrades: totalWins,
    losingTrades: totalLosses,
    winRate,
    totalPnLPercent: +avgR.toFixed(2),
    totalPnLUsd: 0, // left at 0 deliberately -- no account size is known here, so a dollar figure would be fabricated
    bestTradePercent: bestR === -Infinity ? 0 : +bestR.toFixed(2),
    worstTradePercent: worstR === Infinity ? 0 : +worstR.toFixed(2),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export async function sendBacktestReportToTelegram(
  botToken: string,
  chatId: string,
  summary: BacktestSummary
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram Bot Token or Chat ID is missing.' };
  }

  const hasData = summary.totalTrades > 0;

  const text = `
📊 <b>BACKTEST PERFORMANCE REPORT</b> 📊
────────────────────────────
<b>Window:</b> <code>${summary.period} (${summary.timestamp})</code>
<b>Simulated Trades:</b> <code>${summary.totalTrades}</code>

${hasData ? `<b>✅ Wins:</b> <code>${summary.winningTrades}</code>
<b>❌ Losses:</b> <code>${summary.losingTrades}</code>
<b>🎯 Win Rate:</b> <b>${summary.winRate}%</b>

<b>📈 Avg R-Multiple:</b> <code>${summary.totalPnLPercent}R</code>
<b>🚀 Best Strategy Avg R:</b> <code>${summary.bestTradePercent}R</code>
<b>🛡️ Worst Strategy Avg R:</b> <code>${summary.worstTradePercent}R</code>` :
`⚠️ Not enough triggered trades in this window to report a statistically meaningful result yet.`}
────────────────────────────
🤖 <i>Real walk-forward simulation against historical Binance candles. R-multiple reflects risk-adjusted return, not USD, since account size isn't known here.</i>
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
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⚡ Run Instant Scan', callback_data: 'menu_scanner' },
              { text: '👑 Subscribe VIP Access', url: 'https://www.instagram.com/abdul_kaif12' }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    return data.ok ? { success: true, message: 'Backtest report sent to Telegram!' } : { success: false, message: data.description };
  } catch (err: any) {
    return { success: false, message: err.message || 'Telegram connection error' };
  }
}