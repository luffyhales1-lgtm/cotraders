import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Award, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchKlines } from '@/services/binanceApi';
import { runWalkForwardBacktest, WalkForwardResult } from '@/services/backtestEngine';

const SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'XAUUSDT', label: 'GOLD' },
  { symbol: 'XAGUSDT', label: 'SILVER' },
];
const INTERVALS = ['5m', '15m', '1h'];
const RISK_PER_TRADE = 0.01; // 1% fixed-fractional sizing for the equity curve
const START_EQUITY = 1000;

interface EquityPoint { trade: string; equity: number; }

interface DerivedStats {
  result: WalkForwardResult;
  equityCurve: EquityPoint[];
  finalEquity: number;
  profitFactor: number | null;
  maxDrawdownPct: number;
  bestStrategy: { strategy: string; winRate: number | null } | null;
}

function deriveStats(result: WalkForwardResult): DerivedStats {
  // Real equity curve: 1% fixed-fractional risk, compounding each resolved R.
  let equity = START_EQUITY;
  let peak = START_EQUITY;
  let maxDd = 0;
  const equityCurve: EquityPoint[] = [{ trade: 'T0', equity: START_EQUITY }];
  result.rSequence.forEach((r, idx) => {
    equity += equity * (r * RISK_PER_TRADE);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    maxDd = Math.max(maxDd, dd);
    equityCurve.push({ trade: `T${idx + 1}`, equity: +equity.toFixed(2) });
  });

  const grossWin = result.rSequence.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(result.rSequence.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null;

  const withRate = result.perStrategy.filter(s => s.winRate != null);
  const bestStrategy = withRate.length
    ? withRate.reduce((best, s) => ((s.winRate ?? 0) > (best.winRate ?? 0) ? s : best))
    : null;

  return {
    result,
    equityCurve,
    finalEquity: +equity.toFixed(2),
    profitFactor,
    maxDrawdownPct: +(maxDd * 100).toFixed(2),
    bestStrategy: bestStrategy ? { strategy: bestStrategy.strategy, winRate: bestStrategy.winRate } : null,
  };
}

export const StrategyBacktest: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DerivedStats | null>(null);
  const [ranAt, setRanAt] = useState<string>('');
  const mounted = useRef(true);

  const runBacktest = useCallback(async (sym: string, itv: string) => {
    setLoading(true);
    setError(null);
    try {
      const candles = await fetchKlines(sym, itv, 300);
      if (!mounted.current) return;
      if (candles.length < 80) {
        setError('Not enough historical candles returned to run a reliable backtest.');
        setStats(null);
        return;
      }
      const result = runWalkForwardBacktest(candles, 250);
      setStats(deriveStats(result));
      setRanAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      if (!mounted.current) return;
      console.error('[StrategyBacktest] failed:', e);
      setError('Could not fetch live candles for the backtest. Try again in a moment.');
      setStats(null);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    runBacktest(symbol, timeframe);
    return () => {
      mounted.current = false;
    };
  }, [symbol, timeframe, runBacktest]);

  const result = stats?.result;
  const winRate = result?.overallWinRate;
  const profitable = stats ? stats.finalEquity >= START_EQUITY : false;

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
            <Award className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Live Walk-Forward Backtesting Engine</h3>
            <p className="text-[10px] text-slate-500">
              Real simulation on live Binance candles {ranAt && `· ran ${ranAt}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1">
            {SYMBOLS.map(s => (
              <button
                key={s.symbol}
                onClick={() => setSymbol(s.symbol)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${symbol === s.symbol ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1">
            {INTERVALS.map(itv => (
              <button
                key={itv}
                onClick={() => setTimeframe(itv)}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${timeframe === itv ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {itv}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBacktest(symbol, timeframe)}
            disabled={loading}
            className="border-slate-300 text-slate-600 hover:text-slate-900 gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Running live walk-forward simulation…
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-700">{error}</p>
          <Button size="sm" onClick={() => runBacktest(symbol, timeframe)} className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : stats && result ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">WIN RATE (TP1 vs SL)</span>
              <span className="text-lg font-black text-emerald-600">
                {winRate != null ? `${winRate}%` : '—'}
              </span>
              <span className="text-[9px] text-slate-400 block">{result.totalTrades} trades</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">PROFIT FACTOR</span>
              <span className="text-lg font-black text-indigo-700">{stats.profitFactor ?? '—'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">MAX DRAWDOWN</span>
              <span className="text-lg font-black text-amber-600">-{stats.maxDrawdownPct}%</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans block">AVG R-MULTIPLE</span>
              <span className="text-lg font-black text-cyan-600">
                {result.avgRMultiple != null ? `${result.avgRMultiple}R` : '—'}
              </span>
            </div>
          </div>

          {result.totalTrades < 5 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Only {result.totalTrades} trades triggered in this window — not enough for a statistically reliable read. Try a longer timeframe or a more active pair.
            </div>
          ) : null}

          {/* REAL equity curve reconstructed from the trade R-sequence */}
          <div className="h-56 w-full pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700">
                Simulated Equity ($1,000 start · 1% risk/trade)
              </span>
              <Badge className={profitable ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}>
                ${stats.finalEquity.toLocaleString()} final
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityCurve} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2740" />
                <XAxis dataKey="trade" stroke="#6b7aa6" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#6b7aa6" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1220', borderColor: '#1e2740', color: '#e2e8f0', borderRadius: 12 }} />
                <Area type="monotone" dataKey="equity" stroke={profitable ? '#059669' : '#e11d48'} fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Per-strategy real breakdown */}
          {result.perStrategy.length > 0 && (
            <div className="mt-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                Per-strategy results (this pair / timeframe)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.perStrategy.slice(0, 8).map(s => (
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
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                Walk-forward simulation: each strategy is re-evaluated causally bar-by-bar on real Binance candles; when it triggers, the trade is run forward against actual price to see if TP1 or SL hit first. Win rates below the minimum sample size are shown as “n/a” rather than guessed.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
