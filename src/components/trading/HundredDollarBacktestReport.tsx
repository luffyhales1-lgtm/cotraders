import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Wallet, Loader2, Play, Download, AlertTriangle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  runHundredDollarBacktest,
  HundredDollarReport as HundredReportData,
  HundredProgress,
  START_EQUITY,
} from '@/services/hundredDollarBacktest';
import { getPaperTrades, computeJournalStats, PaperTrade, JournalStats } from '@/services/paperTradingService';
import { buildHundredDollarReportHtml } from '@/utils/hundredDollarReportPdf';
import { toast } from 'sonner';

const pctLabel = (v: number | null) => (v == null ? 'n/a' : `${v}%`);
const usd = (v: number | null | undefined) =>
  v == null ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

export const HundredDollarBacktestReport: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<HundredProgress | null>(null);
  const [report, setReport] = useState<HundredReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<{ stats: JournalStats; trades: PaperTrade[] } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const trades = getPaperTrades();
    setJournal({ stats: computeJournalStats(trades), trades });
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    setProgress({ done: 0, total: 0, currentLabel: 'Building the market universe…' });
    try {
      const r = await runHundredDollarBacktest(p => { if (mounted.current) setProgress(p); });
      if (!mounted.current) return;
      if (r.symbolsCovered === 0) {
        setError('No market data could be fetched right now (network or region block). Try again in a moment.');
      } else {
        setReport(r);
        const trades = getPaperTrades();
        setJournal({ stats: computeJournalStats(trades), trades });
        toast.success(`$100 → $${r.endEquity.toFixed(2)} over ${r.totalTrades} trades`);
      }
    } catch (e) {
      if (!mounted.current) return;
      console.error('[HundredDollarBacktestReport] failed:', e);
      setError('The $100 backtest could not complete. Please try again.');
    } finally {
      if (mounted.current) setRunning(false);
    }
  }, []);

  const downloadPdf = useCallback(() => {
    if (!report) return;
    const j = journal ?? { stats: computeJournalStats([]), trades: [] };
    const html = buildHundredDollarReportHtml(report, j);
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Enable pop-ups to download the PDF report.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }, [report, journal]);

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const profitable = report ? report.endEquity >= START_EQUITY : false;
  const closedJournal = useMemo(
    () => (journal?.trades ?? []).filter(t => t.status !== 'OPEN').slice().sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)),
    [journal],
  );

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">$100 · One-Month Backtest &amp; Signal Audit</h3>
            <p className="text-[10px] text-slate-500">
              Takes a real $100 account through the last 30 days using the SAME gate the live signals use
              {report && ` · ran ${report.generatedAtLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-bold">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Running…' : 'Run $100 Backtest'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadPdf}
            disabled={!report || running}
            className="border-indigo-500/50 text-indigo-600 hover:bg-indigo-500/10 gap-1.5 font-bold"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Journal audit is available immediately, with or without a backtest run. */}
      {journal && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1.5 mb-2">
            <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Audit of signals this website actually issued
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            <div><span className="text-[9px] text-slate-500 font-sans block">JOURNALLED</span><span className="font-black text-slate-800">{journal.stats.total}</span></div>
            <div><span className="text-[9px] text-slate-500 font-sans block">STILL OPEN</span><span className="font-black text-slate-800">{journal.stats.open}</span></div>
            <div><span className="text-[9px] text-slate-500 font-sans block">CLOSED WIN RATE</span><span className="font-black text-emerald-600">{pctLabel(journal.stats.winRate)}</span></div>
            <div><span className="text-[9px] text-slate-500 font-sans block">TOTAL R</span><span className={`font-black ${journal.stats.totalR >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{journal.stats.totalR}R</span></div>
            <div><span className="text-[9px] text-slate-500 font-sans block">AVG R</span><span className="font-black text-cyan-600">{journal.stats.avgR != null ? `${journal.stats.avgR}R` : 'n/a'}</span></div>
          </div>
          {closedJournal.length === 0 && (
            <p className="text-[10px] text-slate-400 mt-2">
              No closed signals recorded on this device yet — open paper trades from any signal card and they
              will be audited here.
            </p>
          )}
        </div>
      )}

      {running ? (
        <div className="py-10">
          <div className="flex items-center justify-center gap-3 text-slate-600 text-sm mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Simulating {progress?.currentLabel || '…'}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            {progress ? `${progress.done}/${progress.total} markets · ${pct}%` : ''}
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-700">{error}</p>
          <Button size="sm" onClick={run} className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white">Retry</Button>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">$100 BECAME</span>
              <span className={`text-lg font-black ${profitable ? 'text-emerald-600' : 'text-rose-600'}`}>${report.endEquity.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block">{report.returnPct >= 0 ? '+' : ''}{report.returnPct}% in 30 days</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">WIN RATE</span>
              <span className="text-lg font-black text-indigo-700">{pctLabel(report.winRate)}</span>
              <span className="text-[9px] text-slate-400 block">{report.wins}W / {report.losses}L</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">PROFIT FACTOR</span>
              <span className="text-lg font-black text-cyan-600">{report.profitFactor ?? 'n/a'}</span>
              <span className="text-[9px] text-slate-400 block">avg {report.avgRMultiple != null ? `${report.avgRMultiple}R` : 'n/a'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">MAX DRAWDOWN</span>
              <span className="text-lg font-black text-rose-600">{report.maxDrawdownPct}%</span>
              <span className="text-[9px] text-slate-400 block">streak {report.longestWinStreak}W/{report.longestLossStreak}L</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              {report.totalTrades} trades taken of {report.candidateCount} qualified setups
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              {report.symbolsCovered}/{report.symbolsRequested} markets · {report.periodLabel}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              Risk {report.riskPerTradePct}% of balance · one position at a time
            </Badge>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.equityCurve} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHundredEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="i" stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: 12 }} />
                <ReferenceLine y={START_EQUITY} stroke="#94a3b8" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="equity" stroke={profitable ? '#059669' : '#e11d48'} fillOpacity={1} fill="url(#colorHundredEquity)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">Per-strategy P&amp;L</span>
              <div className="space-y-1.5">
                {report.perStrategy.slice(0, 10).map(s => (
                  <div key={s.strategy} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                    <span className="font-bold text-slate-800 truncate">{s.strategy}</span>
                    <span className="font-mono shrink-0 text-slate-500">
                      {pctLabel(s.winRate)} · {s.trades}t ·{' '}
                      <span className={s.pnlUsd >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{usd(s.pnlUsd)}</span>
                    </span>
                  </div>
                ))}
                {report.perStrategy.length === 0 && <p className="text-[11px] text-slate-400">No qualifying trades in this window.</p>}
              </div>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">Per-market P&amp;L</span>
              <div className="space-y-1.5">
                {report.perSymbol.slice(0, 10).map(s => (
                  <div key={s.symbol} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                    <span className="font-bold text-slate-800 truncate">{s.pair}</span>
                    <span className="font-mono shrink-0 text-slate-500">
                      {pctLabel(s.winRate)} · {s.trades}t ·{' '}
                      <span className={s.pnlUsd >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{usd(s.pnlUsd)}</span>
                    </span>
                  </div>
                ))}
                {report.perSymbol.length === 0 && <p className="text-[11px] text-slate-400">No qualifying trades in this window.</p>}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
              Every trade the $100 account took ({report.trades.length})
            </span>
            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">#</th>
                    <th className="text-left font-bold px-3 py-2">Market</th>
                    <th className="text-left font-bold px-3 py-2">Dir</th>
                    <th className="text-left font-bold px-3 py-2">Strategy</th>
                    <th className="text-right font-bold px-3 py-2">Entry</th>
                    <th className="text-right font-bold px-3 py-2">TP1 %</th>
                    <th className="text-right font-bold px-3 py-2">R:R</th>
                    <th className="text-left font-bold px-3 py-2">Result</th>
                    <th className="text-right font-bold px-3 py-2">P&amp;L</th>
                    <th className="text-right font-bold px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trades.map((t, idx) => (
                    <tr key={`${t.symbol}-${t.entryBar}-${idx}`} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-bold text-slate-800">{t.pair}</td>
                      <td className={`px-3 py-1.5 font-bold ${t.direction === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.direction}</td>
                      <td className="px-3 py-1.5 text-slate-600 truncate max-w-[160px]">{t.strategy}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{t.entryPrice}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{t.tp1Pct}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-cyan-600">1:{t.rr}</td>
                      <td className={`px-3 py-1.5 font-bold ${t.outcome === 'WIN' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.outcome}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${t.pnlUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{usd(t.pnlUsd)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-800 font-bold">{usd(t.balanceAfter)}</td>
                    </tr>
                  ))}
                  {report.trades.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                      No setup cleared the full gate in this window — refusing to trade is the honest outcome.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Walk-forward on real 1-hour candles with no look-ahead: entry is the next bar's open, and the trade
              runs against actual price until TP1 or the stop is touched (a bar touching both counts as the loss).
              Only setups that clear the live gate — majority direction, ≥2 strategy confluence, EMA regime,
              RSI/MACD support, and the minimum reward:risk plus minimum target distance in percent — are taken.
              Unresolved trades are excluded rather than scored, and win rates on small samples show as “n/a”.
              Backtested performance is not a guarantee of future results.
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-sm text-slate-500">
          Click <span className="font-bold text-emerald-600">Run $100 Backtest</span> to walk a real $100 account
          through the last 30 days across the whole crypto-futures + forex universe, using the exact rules the
          live signals follow — then download the full trade-by-trade report as a PDF.
        </div>
      )}
    </div>
  );
};
