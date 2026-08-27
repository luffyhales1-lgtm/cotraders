import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { runGrokDeepResearch, signalToTelegramPayload, GrokResearchResult } from '@/services/grokResearchService';
import { addPaperTradeFromSignal, hasOpenTradeForSymbol } from '@/services/paperTradingService';
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
  BookMarked,
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
  const dispatchedLead = useRef<string | null>(null);

  const handleRunGrokScan = async () => {
    setIsScanning(true);
    dispatchedLead.current = null;
    toast.info('Grok AI deep-research agent scanning every live coin…');
    try {
      const result = await runGrokDeepResearch({
        topN: 8,
        shouldContinue: () => mounted.current,
        // Stream every incremental pass straight into the UI so it fills in live.
        onProgress: (partial) => {
          if (!mounted.current) return;
          setResearch(partial);
          const lead = partial.topSignals[0];
          if (lead) {
            const payload = signalToTelegramPayload(lead);
            setLeadChart(payload.chartScreenshotUrl ?? null);
            // Auto-dispatch the single strongest REAL setup ONCE, only if the
            // user has connected their own Telegram bot.
            if (
              telegramBotToken &&
              telegramChatId &&
              dispatchedLead.current !== lead.id
            ) {
              dispatchedLead.current = lead.id;
              dispatchTelegramSignal(payload)
                .then(() => toast.success(`Grok's strongest setup (${lead.pair}) dispatched to your Telegram bot.`))
                .catch(() => { /* surfaced elsewhere */ });
            }
          }
        },
      });

      if (!mounted.current) return;
      setResearch(result);
      if (result.topSignals.length > 0) {
        toast.success(`Grok AI deep research complete — ${result.topSignals.length} live setups across ${result.totalToScan} coins.`);
      } else {
        toast.success(`Grok AI scanned ${result.totalToScan} coins — no high-conviction setups this pass.`);
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
    overview?.bias === 'BULLISH' ? 'text-emerald-600' : overview?.bias === 'BEARISH' ? 'text-rose-600' : 'text-slate-600';

  const scannedPct = research && research.totalToScan > 0
    ? Math.round((research.scannedCount / research.totalToScan) * 100)
    : 0;

  const resend = async (sig: Signal) => {
    const payload = signalToTelegramPayload(sig);
    if (telegramBotToken && telegramChatId) {
      await dispatchTelegramSignal(payload);
      toast.success(`${sig.pair} setup re-sent to your Telegram bot.`);
    } else {
      toast.error('Add your own Telegram Bot Token & Chat ID in Bot Settings first — signals dispatch only to your own bot.');
    }
  };

  const paperTrade = (sig: Signal) => {
    if (hasOpenTradeForSymbol(sig.symbol)) {
      toast.error(`You already have an open paper trade on ${sig.pair}.`);
      return;
    }
    addPaperTradeFromSignal(sig);
    toast.success(`📘 Paper trade opened on ${sig.pair} — tracked in your Paper Journal.`);
  };

  return (
    <div className="p-6 rounded-3xl bg-white border border-indigo-200 shadow-xl shadow-indigo-100/50 text-slate-900 font-sans">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
            <Bot className={`h-6 w-6 text-indigo-600 ${isScanning ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-slate-900">Grok AI Deep-Research Intelligence</h3>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">
                <Sparkles className="h-3 w-3 text-indigo-600" /> SCANS EVERY COIN
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Runs every strategy across the entire live coin universe, synthesizes a real top-down market statement, and dispatches the strongest setups with charts to your Telegram bot.
            </p>
          </div>
        </div>

        <Button
          onClick={handleRunGrokScan}
          disabled={isScanning}
          className="bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-black text-xs py-5 px-6 gap-2 shadow-lg shadow-indigo-200"
        >
          <Sparkles className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Grok AI researching…' : 'Re-run Grok Deep Research'}
        </Button>
      </div>

      {/* Live scan progress */}
      {research && !research.done && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              Scanning {research.scannedCount}/{research.totalToScan} coins · {research.topSignals.length ? `${overview?.signalCount ?? 0} setups found` : 'searching for setups…'}
            </span>
            <span>{scannedPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300" style={{ width: `${scannedPct}%` }} />
          </div>
        </div>
      )}

      {/* Market Statement Banner */}
      <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-indigo-100 text-xs leading-relaxed font-mono">
        <span className="text-indigo-700 font-bold font-sans text-sm mb-1 flex items-center gap-2">
          <GlobeIcon className="h-4 w-4 text-indigo-600" /> GROK AI LIVE MARKET STATEMENT
        </span>
        <p className="text-slate-700">
          {research?.statement ?? 'Running the first deep-research pass across the live market…'}
        </p>
      </div>

      {/* Breadth snapshot */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-sans block">NET BIAS</span>
            <span className={`text-lg font-black ${biasColor}`}>{overview.bias}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-sans block">BREADTH</span>
            <span className="text-lg font-black text-indigo-700">{overview.biasStrengthPct}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-sans block">AVG RSI(14)</span>
            <span className="text-lg font-black text-cyan-600">{overview.avgRsi ?? '—'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-sans block">SETUPS LIVE</span>
            <span className="text-lg font-black text-amber-600">{overview.signalCount}</span>
          </div>
        </div>
      )}

      {/* Strongest lead setup + chart */}
      {research && research.topSignals[0] && (
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70">
            <span className="font-extrabold text-slate-900 text-sm font-sans flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {research.topSignals[0].pair} — STRONGEST LIVE SETUP
            </span>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-mono text-xs">
              {research.topSignals[0].confidenceScore ?? research.topSignals[0].winProbability}% CONVICTION
            </Badge>
          </div>

          {leadChart && (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md max-w-xl">
              <div className="p-2 bg-slate-100 text-[10px] font-bold text-indigo-700 flex items-center justify-between">
                <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Grok AI Chart Setup</span>
                <span className="text-slate-500">{telegramBotToken && telegramChatId ? 'Sent to your Telegram bot' : 'Connect your bot in Bot Settings to dispatch'}</span>
              </div>
              <img src={leadChart} alt="Grok Chart Setup" className="w-full h-auto" />
            </div>
          )}
        </div>
      )}

      {/* Multi-coin deep research list */}
      {research && research.topSignals.length > 0 && (
        <div className="mt-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
            Deep research — strongest setups across every coin
          </span>
          <div className="space-y-2">
            {research.topSignals.map(sig => {
              const DirIcon = sig.type === 'LONG' ? TrendingUp : TrendingDown;
              return (
                <div key={sig.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={sig.type === 'LONG' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 gap-1' : 'bg-rose-100 text-rose-700 border-rose-200 gap-1'}>
                      <DirIcon className="h-3 w-3" /> {sig.type}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-900 block truncate">{sig.pair}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {sig.strategy} · Entry ${sig.entryPrice} · SL ${sig.stopLoss} · TP1 ${sig.target1}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-black text-cyan-600 tabular-nums flex items-center gap-1 justify-end">
                        <Gauge className="h-3 w-3" /> {sig.confidenceScore ?? '—'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 justify-end">
                        <Activity className="h-3 w-3" /> RSI {sig.rsiValue ?? '—'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => paperTrade(sig)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs gap-1" title="Open paper trade">
                      <BookMarked className="h-3 w-3" />
                    </Button>
                    <Button size="sm" onClick={() => resend(sig)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1" title="Send to your Telegram bot">
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
