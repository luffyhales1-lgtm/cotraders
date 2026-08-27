import React, { useState, useCallback, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Globe, Loader2, Play, Download, AlertTriangle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  runFullWebsiteBacktest,
  FullBacktestReport as FullBacktestReportData,
  BacktestProgress,
} from '@/services/fullBacktestService';
import { buildFullBacktestReportHtml } from '@/utils/backtestReportPdf';
import { toast } from 'sonner';

const START_EQUITY = 1000;
const RISK_PER_TRADE = 0.01;

interface EquityPoint { i: number; equity: number; }

function buildEquityCurve(rSequence: number[]): { curve: EquityPoint[]; finalEquity: number } {
  let equity = START_EQUITY;
  const curve: EquityPoint[] = [{ i: 0, equity: START_EQUITY }];
  rSequence.forEach((r, idx) => {
    equity += equity * (r * RISK_PER_TRADE);
    curve.push({ i: idx + 1, equity: +equity.toFixed(2) });
  });
  return { curve, finalEquity: +equity.toFixed(2) };
}

export const FullBacktestReport: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [report, setReport] = useState<FullBacktestReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    setProgress({ done: 0, total: 0, currentLabel: 'Building universe…' });
    try {
      const r = await runFullWebsiteBacktest((p) => {
        if (mounted.current) setProgress(p);
      });
      if (!mounted.current) return;
      if (r.symbolsCovered === 0) {
        setError('No market data could be fetched right now (network or region block). Try again in a moment.');
        setReport(null);
      } else {
        setReport(r);
        toast.success(`1-year backtest complete · ${r.symbolsCovered} markets · ${r.totalTrades} trades`);
      }
    } catch (e) {
      if (!mounted.current) return;
      console.error('[FullBacktestReport] failed:', e);
      setError('The full backtest could not complete. Please try again.');
    } finally {
      if (mounted.current) setRunning(false);
    }
  }, []);

  const downloadPdf = useCallback(() => {
    if (!report) return;
    const html = buildFullBacktestReportHtml(report);
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Enable pop-ups to download the PDF report.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Give the browser a tick to lay out, then open the print/Save-as-PDF dialog.
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }, [report]);

  const equity = report ? buildEquityCurve(report.rSequence) : null;
  const profitable = equity ? equity.finalEquity >= START_EQUITY : false;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-100 border border-cyan-200 flex items-center justify-center">
            <Globe className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Whole-Website 1-Year Backtest</h3>
            <p className="text-[10px] text-slate-500">
              Every strategy across all crypto futures + forex majors · 1yr of real daily candles
              {report && ` · ran ${report.generatedAtLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={run}
            disabled={running}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 font-bold"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Running…' : 'Run 1-Year Backtest'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadPdf}
            disabled={!report || running}
            className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 gap-1.5 font-bold"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {running ? (
        <div className="py-10">
          <div className="flex items-center justify-center gap-3 text-slate-600 text-sm mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            Backtesting {progress?.currentLabel || '…'}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            {progress ? `${progress.done}/${progress.total} markets · ${pct}%` : ''}
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-700">{error}</p>
          <Button size="sm" onClick={run} className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white">Retry</Button>
        </div>
      ) : report && equity ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">OVERALL WIN RATE</span>
              <span className="text-lg font-black text-emerald-600">
                {report.overallWinRate != null ? `${report.overallWinRate}%` : '—'}
              </span>
              <span className="text-[9px] text-slate-400 block">{report.totalTrades} trades</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">PROFIT FACTOR</span>
              <span className="text-lg font-black text-indigo-700">{report.profitFactor ?? '—'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">AVG R-MULTIPLE</span>
              <span className="text-lg font-black text-cyan-600">
                {report.avgRMultiple != null ? `${report.avgRMultiple}R` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">MARKETS COVERED</span>
              <span className="text-lg font-black text-slate-800">{report.symbolsCovered}</span>
              <span className="text-[9px] text-slate-400 block">of {report.symbolsRequested} requested</span>
            </div>
          </div>

          {report.bestStrategy && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <Trophy className="h-3 w-3" /> Best strategy: {report.bestStrategy.strategy} ({report.bestStrategy.winRate}%)
              </Badge>
              {report.bestSymbol && (
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  Best market: {report.bestSymbol.label} ({report.bestSymbol.winRate}%)
                </Badge>
              )}
            </div>
          )}

          {/* Combined equity curve across the whole universe */}
          <div className="h-56 w-full pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700">
                Combined Equity ($1,000 start · 1% risk/trade · all markets)
              </span>
              <Badge className={profitable ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}>
                ${equity.finalEquity.toLocaleString()} final
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equity.curve} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFullEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="i" stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: 12 }} />
                <Area type="monotone" dataKey="equity" stroke={profitable ? '#059669' : '#e11d48'} fillOpacity={1} fill="url(#colorFullEquity)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Per-strategy aggregate */}
          <div className="mt-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
              Per-strategy results (aggregated across every market)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {report.perStrategy.slice(0, 12).map(s => (
                <div key={s.strategy} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                  <span className="font-bold text-slate-800 truncate">{s.strategy}</span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {s.winRate != null ? (
                      <span className={s.winRate >= 55 ? 'text-emerald-600' : 'text-slate-700'}>{s.winRate}%</span>
                    ) : (
                      <span className="text-slate-400">n/a</span>
                    )}
                    {' · '}{s.trades}t
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-symbol table */}
          <div className="mt-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
              Per-market results ({report.perSymbol.length} markets)
            </span>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">Market</th>
                    <th className="text-left font-bold px-3 py-2">Class</th>
                    <th className="text-right font-bold px-3 py-2">Trades</th>
                    <th className="text-right font-bold px-3 py-2">Win rate</th>
                    <th className="text-right font-bold px-3 py-2">Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perSymbol.map(s => (
                    <tr key={s.symbol} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-bold text-slate-800">{s.label}</td>
                      <td className="px-3 py-1.5 text-slate-500">{s.assetClass}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{s.result.totalTrades}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {s.result.overallWinRate != null
                          ? <span className={s.result.overallWinRate >= 55 ? 'text-emerald-600' : 'text-slate-700'}>{s.result.overallWinRate}%</span>
                          : <span className="text-slate-400">n/a</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-cyan-600">
                        {s.result.avgRMultiple != null ? `${s.result.avgRMultiple}R` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Genuine walk-forward simulation on ~1 year of real daily candles per market. Each strategy is
              re-evaluated causally bar-by-bar; when it triggers, the trade runs forward against actual price to
              see whether TP1 or SL hit first. Win rates below the minimum sample size show as “n/a” rather than
              being guessed. Backtested performance is not a guarantee of future results.
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-sm text-slate-500">
          Click <span className="font-bold text-indigo-600">Run 1-Year Backtest</span> to simulate every strategy
          across the entire crypto-futures + forex universe on a full year of real daily candles, then download the
          full report as a PDF.
        </div>
      )}
    </div>
  );
};
