import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Microscope,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Send,
  AlertTriangle,
  Gauge,
  Activity,
  Layers,
} from 'lucide-react';
import { analyzeCoinDeep, DeepCoinAnalysis } from '@/services/deepCoinAnalysis';
import { signalToTelegramPayload } from '@/services/grokResearchService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface DeepCoinAnalyzerProps {
  symbol: string | null;
  pair: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const trendIcon = (t: 'UP' | 'DOWN' | 'SIDEWAYS') =>
  t === 'UP' ? TrendingUp : t === 'DOWN' ? TrendingDown : Minus;
const trendColor = (t: 'UP' | 'DOWN' | 'SIDEWAYS') =>
  t === 'UP' ? 'text-emerald-400' : t === 'DOWN' ? 'text-rose-400' : 'text-slate-400';

export const DeepCoinAnalyzer: React.FC<DeepCoinAnalyzerProps> = ({ symbol, pair, open, onOpenChange }) => {
  const { telegramBotToken, telegramChatId, dispatchTelegramSignal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DeepCoinAnalysis | null>(null);
  const [sending, setSending] = useState(false);

  const run = useCallback(async () => {
    if (!symbol || !pair) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeCoinDeep(symbol, pair);
      setAnalysis(result);
    } catch (e: any) {
      setError(e?.message ?? 'Deep analysis failed. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [symbol, pair]);

  useEffect(() => {
    if (open && symbol) run();
    // reset when closing
    if (!open) {
      setAnalysis(null);
      setError(null);
    }
  }, [open, symbol, run]);

  const sendToTelegram = async () => {
    if (!analysis?.bestSignal) return;
    if (!telegramBotToken || !telegramChatId) {
      toast.error('Add your Telegram bot token & chat ID in the Admin panel first.');
      return;
    }
    setSending(true);
    try {
      const payload = signalToTelegramPayload(analysis.bestSignal);
      await dispatchTelegramSignal(payload);
      toast.success(`${analysis.pair} deep-analysis setup sent to Telegram.`);
    } finally {
      setSending(false);
    }
  };

  const biasColor =
    analysis?.netBias === 'LONG' ? 'text-emerald-400' : analysis?.netBias === 'SHORT' ? 'text-rose-400' : 'text-slate-300';
  const biasBadge =
    analysis?.netBias === 'LONG'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : analysis?.netBias === 'SHORT'
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
        : 'bg-slate-500/20 text-slate-300 border-slate-500/40';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Microscope className="h-4 w-4 text-cyan-400" />
            </div>
            Deep Analysis — {pair ?? ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            Reading 5m → 4h timeframes, strategies, RSI/MACD & backtest…
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">{error}</p>
            <Button size="sm" onClick={run} className="mt-3 bg-cyan-600 hover:bg-cyan-500">Retry</Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Net bias header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl glass-panel">
              <div>
                <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider">Net Multi-Timeframe Bias</span>
                <span className={`text-2xl font-black ${biasColor}`}>{analysis.netBias}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider">Timeframe Alignment</span>
                <span className="text-2xl font-black text-indigo-400">{analysis.alignmentScore}%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider">Live Price</span>
                <span className="text-2xl font-black text-slate-100 tabular-nums">
                  ${analysis.price < 1 ? analysis.price.toFixed(6) : analysis.price.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Per-timeframe grid */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1 mb-2">
                <Layers className="h-3.5 w-3.5" /> Timeframe breakdown
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {analysis.perTimeframe.map(tf => {
                  const TrendIcon = trendIcon(tf.trend);
                  return (
                    <div key={tf.interval} className="p-3 rounded-xl glass-panel text-xs font-mono">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-100 font-sans">{tf.interval}</span>
                        <TrendIcon className={`h-4 w-4 ${trendColor(tf.trend)}`} />
                      </div>
                      <div className={`text-[11px] font-bold ${trendColor(tf.trend)}`}>{tf.trend}</div>
                      <div className="text-[10px] text-slate-400 mt-1">RSI {tf.rsi ?? '—'}</div>
                      <div className="text-[10px] text-slate-400">ATR {tf.atrPercent != null ? `${tf.atrPercent}%` : '—'}</div>
                      <div className="text-[10px] mt-1">
                        {tf.direction ? (
                          <span className={tf.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                            {tf.triggeredStrategies.length} trig · {tf.direction}
                          </span>
                        ) : (
                          <span className="text-slate-500">no trigger</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divergence flag */}
            {analysis.divergence && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                {analysis.divergence.toUpperCase()} RSI divergence detected on the higher timeframe.
              </div>
            )}

            {/* Best actionable signal */}
            {analysis.bestSignal ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                    <Badge className={analysis.bestSignal.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}>
                      {analysis.bestSignal.type}
                    </Badge>
                    {analysis.bestSignal.strategy}
                  </span>
                  <span className="text-sm font-black text-cyan-400 flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" /> {analysis.bestSignal.confidenceScore ?? '—'}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div><span className="text-slate-500 block text-[10px]">ENTRY</span>${analysis.bestSignal.entryPrice}</div>
                  <div><span className="text-slate-500 block text-[10px]">STOP</span><span className="text-rose-400">${analysis.bestSignal.stopLoss}</span></div>
                  <div><span className="text-slate-500 block text-[10px]">TP1</span><span className="text-emerald-400">${analysis.bestSignal.target1}</span></div>
                  <div><span className="text-slate-500 block text-[10px]">LEV</span>{analysis.bestSignal.leverage}</div>
                </div>
                <p className="text-[10px] text-slate-400">{analysis.bestSignal.backtestLabel}</p>
                <Button
                  onClick={sendToTelegram}
                  disabled={sending}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1 mt-1"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send this real setup to Telegram
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg glass-panel text-xs text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                No strategy is triggering a clean entry right now — no forced trade. This is an honest "wait" read.
              </div>
            )}

            {/* Natural-language summary */}
            <div className="p-4 rounded-xl glass-panel text-xs leading-relaxed text-slate-300 font-mono">
              {analysis.summary}
            </div>

            <p className="text-[10px] text-slate-500 text-right">Analyzed {analysis.analyzedAt} · live Binance data</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
