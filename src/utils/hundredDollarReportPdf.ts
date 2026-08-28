// Dependency-free PDF: builds a self-contained, print-styled HTML document that
// the browser turns into a PDF via its own "Save as PDF" print target. No
// jsPDF/html2canvas needed (neither is installed), and nothing is uploaded.

import { HundredDollarReport } from '@/services/hundredDollarBacktest';
import { JournalStats, PaperTrade } from '@/services/paperTradingService';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const pct = (v: number | null) => (v == null ? 'n/a' : `${v}%`);
const usd = (v: number | null) => (v == null ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`);

export function buildHundredDollarReportHtml(
  r: HundredDollarReport,
  journal: { stats: JournalStats; trades: PaperTrade[] },
): string {
  const kpi = (label: string, value: string, sub = '') => `
    <div class="kpi">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-value">${esc(value)}</span>
      ${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ''}
    </div>`;

  const strategyRows = r.perStrategy.map(s => `
    <tr>
      <td>${esc(s.strategy)}</td>
      <td class="num">${s.trades}</td>
      <td class="num">${s.wins}</td>
      <td class="num">${esc(pct(s.winRate))}</td>
      <td class="num ${s.pnlUsd >= 0 ? 'pos' : 'neg'}">${esc(usd(s.pnlUsd))}</td>
    </tr>`).join('');

  const symbolRows = r.perSymbol.map(s => `
    <tr>
      <td>${esc(s.pair)}</td>
      <td>${esc(s.assetClass)}</td>
      <td class="num">${s.trades}</td>
      <td class="num">${esc(pct(s.winRate))}</td>
      <td class="num ${s.pnlUsd >= 0 ? 'pos' : 'neg'}">${esc(usd(s.pnlUsd))}</td>
    </tr>`).join('');

  const tradeRows = r.trades.map((t, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td>${esc(t.pair)}</td>
      <td>${esc(t.direction)}</td>
      <td>${esc(t.strategy)}</td>
      <td class="num">${esc(t.entryPrice)}</td>
      <td class="num">${esc(t.stopLoss)}</td>
      <td class="num">${esc(t.target1)}</td>
      <td class="num">1:${esc(t.rr)}</td>
      <td class="${t.outcome === 'WIN' ? 'pos' : 'neg'}">${esc(t.outcome)}</td>
      <td class="num ${t.pnlUsd >= 0 ? 'pos' : 'neg'}">${esc(usd(t.pnlUsd))}</td>
      <td class="num">${esc(usd(t.balanceAfter))}</td>
    </tr>`).join('');

  const closed = journal.trades.filter(t => t.status !== 'OPEN');
  const journalRows = closed.slice(0, 200).map(t => `
    <tr>
      <td>${esc(new Date(t.openedAt).toLocaleString())}</td>
      <td>${esc(t.pair)}</td>
      <td>${esc(t.type)}</td>
      <td>${esc(t.strategy)}</td>
      <td>${esc(t.timeframe)}</td>
      <td>${esc(t.status)}</td>
      <td class="num">${t.realizedR != null ? `${t.realizedR}R` : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>COTRADERS · $100 One-Month Backtest &amp; Signal Audit</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         color: #0f172a; margin: 0; padding: 28px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 26px 0 8px; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 18px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; }
  .kpi { flex: 1 1 150px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
  .kpi-label { display: block; font-size: 9px; letter-spacing: .08em; color: #64748b; text-transform: uppercase; }
  .kpi-value { display: block; font-size: 19px; font-weight: 800; margin-top: 2px; }
  .kpi-sub { display: block; font-size: 9px; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; background: #f8fafc; color: #475569; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pos { color: #047857; font-weight: 700; }
  .neg { color: #be123c; font-weight: 700; }
  .note { font-size: 9.5px; color: #64748b; line-height: 1.6; margin-top: 14px;
          border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .print-btn { position: fixed; top: 14px; right: 14px; padding: 9px 16px; border-radius: 8px;
               background: #4f46e5; color: #fff; border: 0; font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head>
<body>
<button class="print-btn" onclick="window.print()">Save as PDF</button>

<h1>$100 One-Month Backtest &amp; Signal Audit</h1>
<div class="sub">
  ${esc(r.periodLabel)} · ${r.symbolsCovered} of ${r.symbolsRequested} markets covered ·
  risking ${r.riskPerTradePct}% of the running balance per trade · generated ${esc(r.generatedAtLabel)}
</div>

<h2>The $100 account</h2>
<div class="kpis">
  ${kpi('Start', `$${r.startEquity.toFixed(2)}`)}
  ${kpi('Finish', `$${r.endEquity.toFixed(2)}`, `${r.returnPct >= 0 ? '+' : ''}${r.returnPct}%`)}
  ${kpi('Trades taken', String(r.totalTrades), `${r.candidateCount} qualified setups found`)}
  ${kpi('Win rate', pct(r.winRate), `${r.wins}W / ${r.losses}L`)}
  ${kpi('Profit factor', r.profitFactor != null ? String(r.profitFactor) : 'n/a')}
  ${kpi('Avg R', r.avgRMultiple != null ? `${r.avgRMultiple}R` : 'n/a')}
  ${kpi('Max drawdown', `${r.maxDrawdownPct}%`)}
  ${kpi('Streaks', `${r.longestWinStreak}W / ${r.longestLossStreak}L`, 'longest run')}
</div>

<h2>Per-strategy result</h2>
<table><thead><tr>
  <th>Strategy</th><th class="num">Trades</th><th class="num">Wins</th><th class="num">Win rate</th><th class="num">P&amp;L</th>
</tr></thead><tbody>${strategyRows || '<tr><td colspan="5">No trades.</td></tr>'}</tbody></table>

<h2>Per-market result</h2>
<table><thead><tr>
  <th>Market</th><th>Class</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">P&amp;L</th>
</tr></thead><tbody>${symbolRows || '<tr><td colspan="5">No trades.</td></tr>'}</tbody></table>

<h2>Every trade the $100 account took</h2>
<table><thead><tr>
  <th class="num">#</th><th>Market</th><th>Dir</th><th>Strategy</th>
  <th class="num">Entry</th><th class="num">Stop</th><th class="num">TP1</th><th class="num">R:R</th>
  <th>Result</th><th class="num">P&amp;L</th><th class="num">Balance</th>
</tr></thead><tbody>${tradeRows || '<tr><td colspan="11">No trades.</td></tr>'}</tbody></table>

<h2>Audit of the signals this website actually issued</h2>
<div class="kpis">
  ${kpi('Signals journalled', String(journal.stats.total), `${journal.stats.open} still open`)}
  ${kpi('Closed win rate', pct(journal.stats.winRate), `${journal.stats.wins}W / ${journal.stats.losses}L`)}
  ${kpi('Total R', `${journal.stats.totalR}R`)}
  ${kpi('Avg R', journal.stats.avgR != null ? `${journal.stats.avgR}R` : 'n/a')}
  ${kpi('Best / worst', `${journal.stats.bestR ?? '—'}R / ${journal.stats.worstR ?? '—'}R`)}
</div>
<table><thead><tr>
  <th>Opened</th><th>Market</th><th>Dir</th><th>Strategy</th><th>Timeframe</th><th>Outcome</th><th class="num">R</th>
</tr></thead><tbody>${journalRows || '<tr><td colspan="7">No closed signals recorded on this device yet.</td></tr>'}</tbody></table>

<div class="note">
  <strong>Method.</strong> Every market is walked forward bar-by-bar on real 1-hour candles using only data
  available at that bar. A setup is only taken when it clears the SAME gate the live signal engine uses:
  a majority of the 21 strategies must agree on direction, at least two must confluence, the EMA50/EMA200
  regime must not oppose the trade, RSI/MACD must support it, and the SL/TP structure must clear both the
  minimum reward:risk and the minimum target distance in percent — so a target that would land inside the
  spread is refused rather than traded. Entry is the next bar's open (no look-ahead); the trade then runs
  against the actual candles until TP1 or the stop is touched, and a bar touching both counts as the loss.
  Trades that never resolve inside the horizon are excluded, not scored. The account holds ONE position at
  a time, which is why fewer trades were taken than were found. Win rates on samples below the reporting
  minimum are shown as “n/a” instead of being guessed. Backtested performance is not a guarantee of future
  results.
</div>
</body></html>`;
}
