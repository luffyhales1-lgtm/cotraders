import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { MobileNav } from '@/components/layout/MobileNav';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookMarked,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
  Loader2,
  Eraser,
  BarChart3,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  getPaperTrades,
  updateOpenTrades,
  deletePaperTrade,
  clearClosedTrades,
  computeJournalStats,
  PaperTrade,
  JournalStats,
} from '@/services/paperTradingService';

const JournalPage: React.FC = () => {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const recompute = useCallback((list: PaperTrade[]) => {
    setTrades(list);
    setStats(computeJournalStats(list));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const updated = await updateOpenTrades();
      recompute(updated);
    } finally {
      setRefreshing(false);
    }
  }, [recompute]);

  useEffect(() => {
    recompute(getPaperTrades());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: string) => {
    deletePaperTrade(id);
    recompute(getPaperTrades());
  };

  const handleClearClosed = () => {
    clearClosedTrades();
    recompute(getPaperTrades());
  };

  // Cumulative-R equity curve from closed trades in resolution order.
  const closedOrdered = trades
    .filter(t => t.status !== 'OPEN')
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
  let cum = 0;
  const equityCurve = [{ label: 'Start', r: 0 }, ...closedOrdered.map((t, i) => {
    cum += t.realizedR ?? 0;
    return { label: `#${i + 1}`, r: +cum.toFixed(2) };
  })];
  const profitable = cum >= 0;

  const statusBadge = (t: PaperTrade) => {
    if (t.status === 'WIN') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">WIN +{t.realizedR}R</Badge>;
    if (t.status === 'LOSS') return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">LOSS {t.realizedR}R</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">OPEN{t.mfeTag ? ` · hit ${t.mfeTag}` : ''}</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <BookMarked className="h-7 w-7 text-emerald-600" />
              Paper Trading Journal
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track signals risk-free. Outcomes are resolved against real Binance candles (TP1 vs SL, first touch) — no simulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={refresh} disabled={refreshing} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 text-xs font-bold">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Outcomes
            </Button>
            <Button onClick={handleClearClosed} variant="outline" className="border-slate-200 text-slate-600 gap-1.5 text-xs font-bold">
              <Eraser className="h-3.5 w-3.5" /> Clear Closed
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="scene-3d grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 font-mono">
            <div className="p-4 rounded-2xl glass-panel card-3d">
              <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Win Rate</span>
              <span className="text-2xl font-black text-emerald-600">{stats.winRate != null ? `${stats.winRate}%` : '—'}</span>
              <span className="text-[9px] text-slate-500 block">{stats.wins}W / {stats.losses}L</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel card-3d">
              <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Total R</span>
              <span className={`text-2xl font-black ${stats.totalR >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {stats.totalR >= 0 ? '+' : ''}{stats.totalR}R
              </span>
            </div>
            <div className="p-4 rounded-2xl glass-panel card-3d">
              <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Avg R / Trade</span>
              <span className="text-2xl font-black text-cyan-600">{stats.avgR != null ? `${stats.avgR}R` : '—'}</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel card-3d">
              <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Open</span>
              <span className="text-2xl font-black text-amber-600">{stats.open}</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel card-3d">
              <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Best / Worst</span>
              <span className="text-sm font-black text-slate-900">
                <span className="text-emerald-600">{stats.bestR != null ? `+${stats.bestR}` : '—'}</span>
                {' / '}
                <span className="text-rose-600">{stats.worstR != null ? stats.worstR : '—'}</span>
              </span>
            </div>
          </div>
        )}

        {/* Equity curve */}
        {closedOrdered.length > 0 && (
          <div className="p-5 rounded-2xl glass-panel mb-6">
            <span className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5 mb-3">
              <BarChart3 className="h-4 w-4 text-indigo-600" /> Cumulative R (closed trades)
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={profitable ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2740" />
                  <XAxis dataKey="label" stroke="#6b7aa6" fontSize={10} />
                  <YAxis stroke="#6b7aa6" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1220', borderColor: '#1e2740', color: '#e2e8f0' }} />
                  <Area type="monotone" dataKey="r" stroke={profitable ? '#10b981' : '#f43f5e'} fill="url(#colorR)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Trades list */}
        {trades.length === 0 ? (
          <div className="text-center py-20 rounded-2xl glass-panel">
            {refreshing ? (
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            ) : (
              <>
                <BookMarked className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No paper trades yet.</p>
                <p className="text-xs text-slate-400 mt-1">Open the AI Signals or Scanner and hit “Take Paper Trade” on any setup to start tracking.</p>
              </>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-sans">
                  <tr>
                    <th className="p-4 font-bold">PAIR / SETUP</th>
                    <th className="p-4 font-bold">ENTRY</th>
                    <th className="p-4 font-bold">SL / TP1</th>
                    <th className="p-4 font-bold">STATUS</th>
                    <th className="p-4 font-bold text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {trades.map(t => {
                    const DirIcon = t.type === 'LONG' ? TrendingUp : TrendingDown;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <DirIcon className={`h-3.5 w-3.5 ${t.type === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}`} />
                            {t.pair}
                          </span>
                          <span className="text-[10px] text-slate-500 block">{t.strategy} · {t.timeframe}</span>
                        </td>
                        <td className="p-4 text-slate-900">${t.entryPrice}</td>
                        <td className="p-4">
                          <span className="text-rose-600">${t.stopLoss}</span>
                          <span className="text-slate-400"> / </span>
                          <span className="text-emerald-600">${t.target1}</span>
                        </td>
                        <td className="p-4">{statusBadge(t)}</td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-600 h-7 w-7 p-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
};

export default JournalPage;