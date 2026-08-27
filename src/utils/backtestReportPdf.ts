import { FullBacktestReport } from '@/services/fullBacktestService';

/**
 * Builds a fully self-contained, print-ready HTML document for the whole-website
 * 1-year backtest report. Opened in a new window and sent to the browser's print
 * dialog (Save as PDF) — no external PDF library needed, so it works everywhere.
 */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtWinRate(v: number | null): string {
  return v != null ? `${v}%` : 'n/a';
}

export function buildFullBacktestReportHtml(r: FullBacktestReport): string {
  const stratRows = r.perStrategy.map(s => `
      <tr>
        <td class="l">${esc(s.strategy)}</td>
        <td class="r">${s.trades}</td>
        <td class="r">${s.wins}</td>
        <td class="r">${s.losses}</td>
        <td class="r ${s.winRate != null && s.winRate >= 55 ? 'good' : ''}">${fmtWinRate(s.winRate)}</td>
      </tr>`).join('');

  const symbolRows = r.perSymbol.map(s => `
      <tr>
        <td class="l">${esc(s.label)}</td>
        <td class="l muted">${esc(s.assetClass)}</td>
        <td class="r">${s.result.totalTrades}</td>
        <td class="r ${s.result.overallWinRate != null && s.result.overallWinRate >= 55 ? 'good' : ''}">${fmtWinRate(s.result.overallWinRate)}</td>
        <td class="r">${s.result.avgRMultiple != null ? s.result.avgRMultiple + 'R' : '—'}</td>
      </tr>`).join('');

  const kpi = (label: string, value: string, sub = '') => `
      <div class="kpi">
        <div class="kpi-l">${esc(label)}</div>
        <div class="kpi-v">${esc(value)}</div>
        ${sub ? `<div class="kpi-s">${esc(sub)}</div>` : ''}
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CoTraders — 1-Year Whole-Website Backtest</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; background: #ffffff; }
  h1 { font-size: 22px; margin: 0 0 2px; color: #4338ca; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin: 26px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 4px; }
  .brand { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #4338ca; padding-bottom: 12px; margin-bottom: 8px; }
  .brand .tag { font-size: 11px; color: #0891b2; font-weight: 700; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; background: #f8fafc; }
  .kpi-l { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .kpi-v { font-size: 22px; font-weight: 800; color: #4338ca; margin-top: 2px; }
  .kpi-s { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .highlights { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .pill { font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 999px; }
  .pill.g { background: #d1fae5; color: #047857; }
  .pill.i { background: #e0e7ff; color: #4338ca; }
  .pill.r { background: #ffe4e6; color: #be123c; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f1f5f9; color: #475569; font-weight: 700; padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  td.l { font-weight: 600; }
  td.muted { color: #94a3b8; }
  td.good { color: #059669; font-weight: 700; }
  .note { font-size: 10px; color: #94a3b8; line-height: 1.6; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #4338ca; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Save as PDF</button>

  <div class="brand">
    <div>
      <h1>CoTraders — 1-Year Whole-Website Backtest</h1>
      <p class="sub">${esc(r.lookbackLabel)} · Generated ${esc(r.generatedAtLabel)}</p>
    </div>
    <div class="tag">REAL WALK-FORWARD · NO FABRICATED DATA</div>
  </div>

  <p class="sub">${r.symbolsCovered} of ${r.symbolsRequested} markets returned enough live history to simulate. ${r.totalTrades} total trades resolved.</p>

  <div class="kpis">
    ${kpi('Overall win rate', fmtWinRate(r.overallWinRate), `${r.totalTrades} trades`)}
    ${kpi('Profit factor', r.profitFactor != null ? String(r.profitFactor) : '—')}
    ${kpi('Avg R-multiple', r.avgRMultiple != null ? `${r.avgRMultiple}R` : '—')}
    ${kpi('Markets covered', String(r.symbolsCovered), `of ${r.symbolsRequested}`)}
  </div>

  <div class="highlights">
    ${r.bestStrategy ? `<span class="pill g">Best strategy: ${esc(r.bestStrategy.strategy)} (${r.bestStrategy.winRate}%)</span>` : ''}
    ${r.worstStrategy ? `<span class="pill r">Weakest strategy: ${esc(r.worstStrategy.strategy)} (${r.worstStrategy.winRate}%)</span>` : ''}
    ${r.bestSymbol ? `<span class="pill i">Best market: ${esc(r.bestSymbol.label)} (${r.bestSymbol.winRate}%)</span>` : ''}
  </div>

  <h2>Per-strategy results (aggregated across every market)</h2>
  <table>
    <thead><tr><th class="l">Strategy</th><th class="r">Trades</th><th class="r">Wins</th><th class="r">Losses</th><th class="r">Win rate</th></tr></thead>
    <tbody>${stratRows || '<tr><td colspan="5" class="muted">No resolved trades.</td></tr>'}</tbody>
  </table>

  <h2>Per-market results</h2>
  <table>
    <thead><tr><th class="l">Market</th><th class="l">Class</th><th class="r">Trades</th><th class="r">Win rate</th><th class="r">Avg R</th></tr></thead>
    <tbody>${symbolRows || '<tr><td colspan="5" class="muted">No markets resolved.</td></tr>'}</tbody>
  </table>

  <p class="note">
    Methodology: a genuine walk-forward simulation on approximately one year of real daily candles per market
    (Binance USDT-M futures for crypto/metals, live forex majors from a free feed). Each strategy is re-evaluated
    causally bar-by-bar using only data available up to that bar; when it triggers, the trade is run forward against
    the actual subsequent price to determine whether the first take-profit or the stop-loss was hit first. Win rates
    below the minimum honest sample size are reported as "n/a" rather than estimated. Backtested performance is not a
    guarantee of future results — size positions responsibly.
  </p>
</body>
</html>`;
}
