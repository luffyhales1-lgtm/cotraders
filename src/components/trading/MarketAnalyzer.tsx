import React, { useState } from 'react';
import {
  scanMarketForSignals,
  getScanBatch,
  buildDynamicWatchlist,
  analyzeMarketOverview,
} from '@/services/signalEngine';
import { MarketOverview, Signal } from '@/types/trading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Radar,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Activity,
  Flame,
  Send,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface MarketAnalyzerProps {
  onSignals?: (signals: Signal[]) => void;
}

/**
 * The dashboard "Analyze Whole Market" panel. One tap runs every one of the 21
 * strategies against the live scan batch (top-volume perps + gold/silver +
 * forex), then computes a genuine top-down market read: net bias, breadth,
 * average RSI/conviction, which strategies are firing, and the strongest fresh
 * setups. The same signals are auto-dispatched to Telegram every 60s by the
 * scan engine below -- this button gives an on-demand, full-market snapshot.
 */
export const MarketAnalyzer: React.FC<MarketAnalyzerProps> = ({ onSignals }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [universeSize, setUniverseSize] = useState<number>(0);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const [batch, full] = await Promise.all([getScanBatch(), buildDynamicWatchlist()]);
      setUniverseSize(full.length);
      const signals = await scanMarketForSignals(batch);
      const ov = analyzeMarketOverview(signals, batch.length);
      setOverview(ov);
      onSignals?.(signals);
      toast.success(
        signals.length > 0
          ? `📡 Market analyzed — ${signals.length} live setups across ${batch.length} instruments.`
          : `📡 Market analyzed — no strategy conditions met right now across ${batch.length} instruments.`,
      );
    } catch (e) {
      console.error('[MarketAnalyzer] failed:', e);
      toast.error('Market analysis failed — check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const biasColor =
    overview?.bias === 'BULLISH'
      ? 'text-emerald-600'
      : overview?.bias === 'BEARISH'
        ? 'text-rose-600'
        : 'text-slate-600';
  const BiasIcon = overview?.bias === 'BULLISH' ? TrendingUp : overview?.bias === 'BEARISH' ? TrendingDown : Minus;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-white via-indigo-50 to-white p-6 md:p-8 shadow-2xl mb-8">
      {/* ambient depth orbs for the 3D feel */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-cyan-100 border border-cyan-200 flex items-center justify-center shadow-lg shadow-cyan-200/40">
            <Radar className={`h-7 w-7 text-cyan-600 ${analyzing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Analyze Whole Market</h2>
              <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px] font-bold gap-1">
                <Flame className="h-3 w-3 text-amber-600" /> ALL 21 STRATEGIES
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Scans the full live universe — top futures by volume, real gold &amp; silver perps and forex majors —
              running every strategy, all trends, support/resistance, RSI divergence and footprint delta. The strongest
              setups auto-dispatch to your Telegram every 60 seconds.
            </p>
          </div>
        </div>

        <Button
          onClick={runAnalysis}
          disabled={analyzing}
          className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-black px-7 py-6 rounded-2xl shadow-lg shadow-cyan-500/25 gap-2 text-base shrink-0"
        >
          {analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radar className="h-5 w-5" />}
          {analyzing ? 'Scanning market…' : 'Analyze Whole Market'}
        </Button>
      </div>

      {overview && (
        <div className="relative z-10 mt-6 space-y-5">
          {/* Bias banner */}
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Net Market Bias</span>
                <div className={`flex items-center gap-2 mt-1 ${biasColor}`}>
                  <BiasIcon className="h-7 w-7" />
                  <span className="text-3xl font-black">{overview.bias}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Strength</span>
                <div className="text-3xl font-black text-slate-900 tabular-nums">{overview.biasStrengthPct}%</div>
                <span className="text-[11px] text-slate-500 font-mono">as of {overview.timestamp}</span>
              </div>
            </div>

            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 grid grid-cols-2 gap-3">
              <StatBox label="Long setups" value={String(overview.longCount)} tone="emerald" icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
              <StatBox label="Short setups" value={String(overview.shortCount)} tone="rose" icon={<ArrowDownRight className="h-3.5 w-3.5" />} />
              <StatBox label="Avg RSI(14)" value={overview.avgRsi != null ? String(overview.avgRsi) : '—'} tone="cyan" icon={<Activity className="h-3.5 w-3.5" />} />
              <StatBox label="Avg conviction" value={overview.avgConfidence != null ? `${overview.avgConfidence}/100` : '—'} tone="amber" icon={<Gauge className="h-3.5 w-3.5" />} />
            </div>
          </div>

          {/* Coverage + BTC read */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Coverage this scan</span>
              <span className="text-sm font-bold text-slate-900">
                {overview.scannedCount} instruments scanned{universeSize ? ` · ${universeSize} in rotation` : ''}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Fresh signals found</span>
              <span className="text-sm font-bold text-cyan-600">{overview.signalCount} live setups</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">BTC/USDT read</span>
              <span className="text-sm font-bold text-slate-900">{overview.btcTrend ?? 'No BTC trigger this scan'}</span>
            </div>
          </div>

          {/* Top strategies firing */}
          {overview.topStrategies.length > 0 && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                Strategies firing most
              </span>
              <div className="flex flex-wrap gap-2">
                {overview.topStrategies.map(s => (
                  <Badge key={s.name} variant="outline" className="border-indigo-200 text-indigo-700 text-[11px] font-bold">
                    {s.name} · {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Strongest setups */}
          {overview.strongest.length > 0 && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                Strongest live setups
              </span>
              <div className="space-y-2">
                {overview.strongest.map(sig => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={sig.type === 'LONG' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}>
                        {sig.type}
                      </Badge>
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-slate-900 block truncate">{sig.pair}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {sig.strategy} · Entry ${sig.entryPrice} · SL ${sig.stopLoss}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-cyan-600 tabular-nums block">{sig.confidenceScore ?? '—'}/100</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        RSI {sig.rsiValue ?? '—'}{sig.rsiDivergence ? ` · ${sig.rsiDivergence} div` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono pt-1">
            <Send className="h-3.5 w-3.5 text-indigo-600" />
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Strongest setups auto-dispatch to your Telegram bot every 60s while auto-scan is on.
          </div>
        </div>
      )}
    </div>
  );
};

const toneMap: Record<string, string> = {
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  cyan: 'text-cyan-600',
  amber: 'text-amber-600',
};

const StatBox: React.FC<{ label: string; value: string; tone: string; icon: React.ReactNode }> = ({ label, value, tone, icon }) => (
  <div className="rounded-xl bg-white border border-slate-200 p-3">
    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-lg font-black tabular-nums ${toneMap[tone] ?? 'text-slate-900'}`}>{value}</span>
  </div>
);