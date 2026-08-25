import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { runGrokDeepResearch, signalToTelegramPayload, GrokResearchResult } from '@/services/grokResearchService';
import { Signal } from '@/types/trading';
import {
  Bot,
  Sparkles,
  Send,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Globe as GlobeIcon,
  Image as ImageIcon,
  Gauge,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const GrokMarketBot: React.FC = () => {
  const { telegramBotToken, telegramChatId, dispatchTelegramSignal } = useAuth();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [research, setResearch] = useState<GrokResearchResult | null>(null);
  const [leadChart, setLeadChart] = useState<string | null>(null);
  const mounted = useRef(true);

  const handleRunGrokScan = async () => {
    setIsScanning(true);
    toast.info('Grok AI deep-research agent scanning the live market across multiple coins…');
    try {
      const result = await runGrokDeepResearch(6);
      if (!mounted.current) return;
      setResearch(result);

      const lead = result.topSignals[0];
      if (lead) {
        const payload = signalToTelegramPayload(lead);
        setLeadChart(payload.chartScreenshotUrl ?? null);

        // Auto-dispatch the single strongest REAL setup to Telegram if configured.
        if (telegramBotToken && telegramChatId) {
          await dispatchTelegramSignal(payload);
          toast.success(`Grok AI statement + strongest setup (${lead.pair}) dispatched to Telegram.`);
        } else {
          toast.success(`Grok AI deep research complete — ${result.topSignals.length} setups found. Add your Telegram bot in Admin to auto-dispatch.`);
        }
      } else {
        setLeadChart(null);
        toast.success('Grok AI deep research complete — no high-conviction setups this pass.');
      }
    } catch (e) {
      console.error('[GrokMarketBot] deep research failed:', e);
      toast.error('Grok AI scan failed — check your connection and try again.');
    } finally {
      if (mounted.current) setIsScanning(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    handleRunGrokScan();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overview = research?.overview;
  const biasColor =
    overview?.bias === 'BULLISH' ? 'text-emerald-400' : overview?.bias === 'BEARISH' ? 'text-rose-400' : 'text-slate-300';

  const resend = async (sig: Signal) => {
    const payload = signalToTelegramPayload(sig);
    if (telegramBotToken && telegramChatId) {
      await dispatchTelegramSignal(payload);
      toast.success(`${sig.pair} setup re-sent to Telegram.`);
    } else {
      toast.error('Add your Telegram bot token & chat ID in the Admin panel first.');
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-cyan-950/70 to-slate-900 border border-cyan-500/50 shadow-2xl text-slate-100 font-sans">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Bot className={`h-6 w-6 text-cyan-400 ${isScanning ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-slate-100">Grok AI Deep-Research Intelligence</h3>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
                <Sparkles className="h-3 w-3 text-cyan-400" /> MULTI-COIN ENGINE
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Runs every strategy across the full live universe, synthesizes a real top-down market statement, and dispatches the strongest setups with charts to Telegram.
            </p>
          </div>
        </div>

        <Button
          onClick={handleRunGrokScan}
          disabled={isScanning}
          className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs py-5 px-6 gap-2 shadow-lg shadow-cyan-950/40"
        >
          <Sparkles className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Grok AI researching…' : 'Run Grok Deep Research'}
        </Button>
      </div>

      {/* Market Statement Banner */}
      <div className="my-4 p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/30 text-xs leading-relaxed font-mono">
        <span className="text-cyan-400 font-bold font-sans block text-sm mb-1 flex items-center gap-2">
          <GlobeIcon className="h-4 w-4 text-cyan-400" /> GROK AI LIVE MARKET STATEMENT
        </span>
        <p className="text-slate-300">
          {research?.statement ?? 'Running the first deep-research pass across the live market…'}
        </p>
      </div>

      {/* Breadth snapshot */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-sans block">NET BIAS</span>
            <span className={`text-lg font-black ${biasColor}`}>{overview.bias}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-sans block">BREADTH</span>
            <span className="text-lg font-black text-indigo-400">{overview.biasStrengthPct}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-sans block">AVG RSI(14)</span>
            <span className="text-lg font-black text-cyan-400">{overview.avgRsi ?? '—'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-sans block">SETUPS LIVE</span>
            <span className="text-lg font-black text-amber-400">{overview.signalCount}</span>
          </div>
        </div>
      )}

      {/* Strongest lead setup + chart */}
      {research && research.topSignals[0] && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-extrabold text-slate-100 text-sm font-sans flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {research.topSignals[0].pair} — STRONGEST LIVE SETUP
            </span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono text-xs">
              {research.topSignals[0].confidenceScore ?? research.topSignals[0].winProbability}% CONVICTION
            </Badge>
          </div>

          {leadChart && (
            <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md max-w-xl">
              <div className="p-2 bg-slate-900 text-[10px] font-bold text-cyan-400 flex items-center justify-between">
                <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Grok AI Chart Setup</span>
                <span className="text-slate-400">{telegramBotToken && telegramChatId ? 'Sent to Telegram' : 'Configure bot to dispatch'}</span>
              </div>
              <img src={leadChart} alt="Grok Chart Setup" className="w-full h-auto" />
            </div>
          )}
        </div>
      )}

      {/* Multi-coin deep research list */}
      {research && research.topSignals.length > 0 && (
        <div className="mt-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
            Deep research — strongest setups across multiple coins
          </span>
          <div className="space-y-2">
            {research.topSignals.map(sig => {
              const DirIcon = sig.type === 'LONG' ? TrendingUp : TrendingDown;
              return (
                <div key={sig.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={sig.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 gap-1'}>
                      <DirIcon className="h-3 w-3" /> {sig.type}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-100 block truncate">{sig.pair}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sig.strategy} · Entry ${sig.entryPrice} · SL ${sig.stopLoss} · TP1 ${sig.target1}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-black text-cyan-400 tabular-nums flex items-center gap-1 justify-end">
                        <Gauge className="h-3 w-3" /> {sig.confidenceScore ?? '—'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 justify-end">
                        <Activity className="h-3 w-3" /> RSI {sig.rsiValue ?? '—'}
                      </span>
                    </div>
                    <Button size="sm" onClick={() => resend(sig)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1">
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
