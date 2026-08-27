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
  BookMarked,
} from 'lucide-react';
import { analyzeCoinDeep, DeepCoinAnalysis } from '@/services/deepCoinAnalysis';
import { signalToTelegramPayload } from '@/services/grokResearchService';
import { addPaperTradeFromSignal, hasOpenTradeForSymbol } from '@/services/paperTradingService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface DeepCoinAnalyzerProps {
  symbol: string | null;
  pair: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GOLDEN_MIN_CONFIDENCE = 80;

const trendIcon = (t: 'UP' | 'DOWN' | 'SIDEWAYS') =>
  t === 'UP' ? TrendingUp : t === 'DOWN' ? TrendingDown : Minus;
const trendColor = (t: 'UP' | 'DOWN' | 'SIDEWAYS') =>
  t === 'UP' ? 'text-emerald-600' : t === 'DOWN' ? 'text-rose-600' : 'text-slate-400';

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
    if (!open) {
      setAnalysis(null);
      setError(null);
    }
  }, [open, symbol, run]);

  const sendToTelegram = async () => {
    if (!analysis?.bestSignal) return;
    if (!telegramBotToken || !telegramChatId) {
      toast.error('Add your own Telegram Bot Token & Chat ID in Bot Settings first — signals dispatch only to your own bot.');
      return;
    }
    setSending(true);
    try {
      const payload = signalToTelegramPayload(analysis.bestSignal);
      await dispatchTelegramSignal(payload);
    } finally {
      setSending(false);
    }
  };

  const handlePaperTrade = () => {
    if (!analysis?.bestSignal) return;
    if (hasOpenTradeForSymbol(analysis.bestSignal.symbol)) {
      toast.info(`${analysis.pair} already has an open paper trade — track it on the Journal page.`);
      return;
    }
    addPaperTradeFromSignal(analysis.bestSignal);
    toast.success(`${analysis.pair} ${analysis.bestSignal.type} opened in your paper journal (risk-free).`);
  };

  const biasColor =
    analysis?.netBias === 'LONG' ? 'text-emerald-600' : analysis?.netBias === 'SHORT' ? 'text-rose-600' : 'text-slate-500';

  const isGolden = (analysis?.bestSignal?.confidenceScore ?? 0) >= GOLDEN_MIN_CONFIDENCE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
              <Microscope className="h-4 w-4 text-cyan-600" />
            </div>
            Deep Analysis — {pair ?? ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            Reading 5m → 4h timeframes, all 21 strategies, RSI/MACD &amp; backtest…
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-slate-700">{error}</p>
            <Button size="sm" onClick={run} className="mt-3 bg-cyan-600 hover:bg-cyan-500 text-white">Retry</Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Net bias header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Net Multi-Timeframe Bias</span>
                <span className={`text-2xl font-black ${biasColor}`}>{analysis.netBias}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Timeframe Alignment</span>
                <span className="text-2xl font-black text-indigo-600">{analysis.alignmentScore}%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-sans block uppercase tracking-wider">Live Price</span>
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  ${analysis.price < 1 ? analysis.price.toFixed(6) : analysis.price.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Per-timeframe grid */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1 mb-2">
                <Layers className="h-3.5 w-3.5" /> Timeframe breakdown
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {analysis.perTimeframe.map(tf => {
                  const TrendIcon = trendIcon(tf.trend);
                  return (
                    <div key={tf.interval} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-900 font-sans">{tf.interval}</span>
                        <TrendIcon className={`h-4 w-4 ${trendColor(tf.trend)}`} />
                      </div>
                      <div className={`text-[11px] font-bold ${trendColor(tf.trend)}`}>{tf.trend}</div>
                      <div className="text-[10px] text-slate-500 mt-1">RSI {tf.rsi ?? '—'}</div>
                      <div className="text-[10px] text-slate-500">ATR {tf.atrPercent != null ? `${tf.atrPercent}%` : '—'}</div>
                      <div className="text-[10px] mt-1">
                        {tf.direction ? (
                          <span className={tf.direction === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}>
                            {tf.triggeredStrategies.length} trig · {tf.direction}
                          </span>
                        ) : (
                          <span className="text-slate-400">no trigger</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divergence flag */}
            {analysis.divergence && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-300/60 text-xs text-amber-700">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                {analysis.divergence.toUpperCase()} RSI divergence detected on the higher timeframe.
              </div>
            )}

            {/* Best actionable signal */}
            {analysis.bestSignal ? (
              <div className={`p-4 rounded-xl bg-white border space-y-2 ${isGolden ? 'border-amber-400/70 ring-1 ring-amber-300/50' : 'border-emerald-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                    <Badge className={analysis.bestSignal.type === 'LONG' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 border-rose-500/30'}>
                      {analysis.bestSignal.type}
                    </Badge>
                    {analysis.bestSignal.strategy}
                    {isGolden && <span className="text-[9px] font-black text-amber-600 bg-amber-100 border border-amber-300 rounded px-1 py-0.5">🏆 GOLDEN</span>}
                  </span>
                  <span className="text-sm font-black text-cyan-600 flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" /> {analysis.bestSignal.confidenceScore ?? '—'}/100
                  </span>
                </div>

                {analysis.bestSignal.demandSupplyZone && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Layers className="h-3 w-3 text-indigo-500" />
                    <span className="font-bold text-slate-700">Zone:</span> {analysis.bestSignal.demandSupplyZone}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div><span className="text-slate-500 block text-[10px]">ENTRY</span>${analysis.bestSignal.entryPrice}</div>
                  <div><span className="text-slate-500 block text-[10px]">STOP</span><span className="text-rose-600">${analysis.bestSignal.stopLoss}</span></div>
                  <div><span className="text-slate-500 block text-[10px]">TP1</span><span className="text-emerald-600">${analysis.bestSignal.target1}</span></div>
                  <div><span className="text-slate-500 block text-[10px]">LEV</span>{analysis.bestSignal.leverage}</div>
                </div>
                <p className="text-[10px] text-slate-500">{analysis.bestSignal.backtestLabel}</p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={handlePaperTrade}
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 font-bold text-xs gap-1.5"
                  >
                    <BookMarked className="h-3.5 w-3.5" /> Paper Trade
                  </Button>
                  <Button
                    onClick={sendToTelegram}
                    disabled={sending}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    To Telegram
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                No strategy is triggering a clean entry right now — no forced trade. This is an honest "wait" read.
              </div>
            )}

            {/* Natural-language summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-600 font-mono">
              {analysis.summary}
            </div>

            <p className="text-[10px] text-slate-400 text-right">Analyzed {analysis.analyzedAt} · live Binance futures data</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
