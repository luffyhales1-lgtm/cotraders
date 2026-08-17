import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';
import { sendTpHitTelegramNotification } from '@/services/telegramService';
import { generateLiveBacktestSummary, sendBacktestReportToTelegram } from '@/services/backtestService';
import { scanMarketForSignals, describeMomentum, buildDynamicWatchlist, DEFAULT_SCAN_WATCHLIST, MACRO_SCAN_WATCHLIST } from '@/services/signalEngine';
import { fetchKlines } from '@/services/binanceApi';
import { rsi, macd } from '@/services/indicators';
import { Signal } from '@/types/trading';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  Radio,
  Flame,
  BarChart2,
  Image as ImageIcon,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AutoScanLog {
  id: string;
  time: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  support1: number;
  resistance1: number;
  winProb: number;
  chartImg: string;
  dispatchedToTelegram: boolean;
}

const SCAN_INTERVAL_MS = 60 * 1000; // real 1-minute auto-scan
const BACKTEST_INTERVAL_MS = 60 * 60 * 1000; // auto-send backtest report hourly in case the user forgets
const AUTO_SCAN_STORAGE_KEY = 'cotraders:autoScanEnabled';
const MACRO_COUNT = MACRO_SCAN_WATCHLIST.length;

function readStoredAutoScanEnabled(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_SCAN_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export const AutoScannerService: React.FC = () => {
  const { user, telegramBotToken, telegramChatId, dispatchTelegramSignal, isVipMember } = useAuth();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [totalScannedCount, setTotalScannedCount] = useState<number>(DEFAULT_SCAN_WATCHLIST.length);
  const [lastScanTime, setLastScanTime] = useState<string>('Not yet run');
  const [logs, setLogs] = useState<AutoScanLog[]>([]);
  const [selectedLogForModal, setSelectedLogForModal] = useState<AutoScanLog | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(readStoredAutoScanEnabled);

  const isVipWithBot = isVipMember && telegramBotToken && telegramChatId;
  const trackedTradesRef = useRef<Map<string, Signal & { hitTp1: boolean; hitTp2: boolean }>>(new Map());

  const toggleAutoScan = () => {
    setAutoScanEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(AUTO_SCAN_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      toast[next ? 'success' : 'info'](next ? '▶️ Auto-scan enabled — resuming every 60s.' : '⏸️ Auto-scan paused. Use Force Scan to run one-off scans.');
      return next;
    });
  };

  // Refresh the real top-volume watchlist size once on mount so the
  // WATCHLIST card shows the actual number of symbols being scanned
  // (top-volume USDT perpetuals + gold/silver/forex), not a stale count.
  useEffect(() => {
    let active = true;
    buildDynamicWatchlist().then(list => { if (active) setTotalScannedCount(list.length); });
    return () => { active = false; };
  }, []);

  const handleTriggerImmediateBacktest = async () => {
    if (!isVipWithBot) {
      toast.error('Only VIP members with a configured Telegram bot can use this feature.');
      return;
    }
    toast.info('Running real walk-forward backtest against live historical candles...');
    const summary = await generateLiveBacktestSummary('Immediate On-Demand Backtest');

    if (telegramBotToken && telegramChatId) {
      const res = await sendBacktestReportToTelegram(telegramBotToken, telegramChatId, summary);
      if (res.success) toast.success('Backtest report sent to Telegram!');
      else toast.error(res.message);
    } else {
      toast.success(summary.totalTrades > 0
        ? `Backtest complete: ${summary.winRate}% win rate over ${summary.totalTrades} real simulated trades.`
        : 'Backtest complete: not enough triggered trades in this window yet.');
    }
  };

  // Poll an open trade's real price against its real TP1/TP2/TP3/SL levels
  // and send a notification driven by a genuine momentum read when a level
  // is actually crossed -- not a timer-based fake alert.
  const monitorTradeForTpHits = (signal: Signal) => {
    trackedTradesRef.current.set(signal.id, { ...signal, hitTp1: false, hitTp2: false });

    const interval = setInterval(async () => {
      const tracked = trackedTradesRef.current.get(signal.id);
      if (!tracked) { clearInterval(interval); return; }

      try {
        const candles = await fetchKlines(signal.symbol, '5m', 60);
        if (candles.length < 30) return;
        const lastClose = candles[candles.length - 1].close;
        const closes = candles.map(c => c.close);
        const rsiSeries = rsi(closes, 14);
        const macdRes = macd(closes);
        const i = candles.length - 1;
        const momentum = describeMomentum(tracked.type, rsiSeries[i], macdRes.histogram[i], macdRes.histogram[i - 1]);

        const isLong = tracked.type === 'LONG';
        const hitSl = isLong ? lastClose <= tracked.stopLoss : lastClose >= tracked.stopLoss;
        const hitTp3 = isLong ? lastClose >= tracked.target3 : lastClose <= tracked.target3;
        const hitTp2 = !tracked.hitTp2 && (isLong ? lastClose >= tracked.target2 : lastClose <= tracked.target2);
        const hitTp1 = !tracked.hitTp1 && (isLong ? lastClose >= tracked.target1 : lastClose <= tracked.target1);

        if (hitSl) {
          if (telegramBotToken && telegramChatId) await sendTpHitTelegramNotification(telegramBotToken, telegramChatId, tracked.pair, 'SL', lastClose, momentum);
          trackedTradesRef.current.delete(signal.id);
          clearInterval(interval);
        } else if (hitTp3) {
          if (telegramBotToken && telegramChatId) await sendTpHitTelegramNotification(telegramBotToken, telegramChatId, tracked.pair, 'TP3', lastClose, momentum);
          trackedTradesRef.current.delete(signal.id);
          clearInterval(interval);
        } else if (hitTp2) {
          if (telegramBotToken && telegramChatId) await sendTpHitTelegramNotification(telegramBotToken, telegramChatId, tracked.pair, 'TP2', lastClose, momentum);
          trackedTradesRef.current.set(signal.id, { ...tracked, hitTp2: true });
        } else if (hitTp1) {
          if (telegramBotToken && telegramChatId) await sendTpHitTelegramNotification(telegramBotToken, telegramChatId, tracked.pair, 'TP1', lastClose, momentum);
          trackedTradesRef.current.set(signal.id, { ...tracked, hitTp1: true });
        }
      } catch (e) {
        console.error('[monitorTradeForTpHits] error:', e);
      }
    }, 60 * 1000);

    // Stop watching after 6 hours regardless, to avoid orphaned intervals.
    setTimeout(() => { trackedTradesRef.current.delete(signal.id); clearInterval(interval); }, 6 * 60 * 60 * 1000);
  };

  const executeAutoScan = async () => {
    setIsScanning(true);
    try {
      const signals = await scanMarketForSignals();

      if (signals.length === 0) {
        setLastScanTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (!isVipWithBot) toast.info('🔍 Scan complete — no strategy conditions met this minute.');
        setIsScanning(false);
        return;
      }

      for (const signal of signals) {
        const digits = signal.entryPrice < 10 ? 4 : 2;
        const supp1 = +(Math.min(signal.entryPrice, signal.stopLoss) * 0.999).toFixed(digits);
        const res1 = +(Math.max(signal.entryPrice, signal.stopLoss) * 1.001).toFixed(digits);

        const chartImg = generateTradeSetupChartImage({
          pair: signal.pair,
          type: signal.type,
          entryPrice: signal.entryPrice,
          target1: signal.target1,
          target2: signal.target2,
          target3: signal.target3,
          stopLoss: signal.stopLoss,
          support1: supp1,
          resistance1: res1,
          timeframe: signal.timeframe,
          strategy: signal.strategy,
          winProbability: signal.winProbability,
          footprintDelta: signal.footprintDelta,
          orderBlockZone: signal.orderBlockZone,
        });

        let dispatched = false;
        if (telegramBotToken && telegramChatId) {
          dispatched = await dispatchTelegramSignal({
            pair: signal.pair,
            type: signal.type,
            strategy: signal.strategy,
            timeframe: signal.timeframe,
            entryPrice: signal.entryPrice,
            target1: signal.target1,
            target2: signal.target2,
            target3: signal.target3,
            stopLoss: signal.stopLoss,
            leverage: signal.leverage,
            winProbability: signal.winProbability,
            riskReward: signal.riskReward,
            rationale: signal.rationale,
            footprintDelta: signal.footprintDelta,
            orderBlockZone: signal.orderBlockZone,
            backtestLabel: signal.backtestLabel,
            momentumNote: signal.momentumNote,
          });
          if (dispatched) monitorTradeForTpHits(signal);
        } else {
          toast.info(`🔍 ${signal.pair} ${signal.type} signal fired (${signal.strategy}) — connect Telegram to receive alerts.`);
        }

        const newLog: AutoScanLog = {
          id: signal.id,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          pair: signal.pair,
          type: signal.type,
          entryPrice: signal.entryPrice,
          tp1: signal.target1,
          tp2: signal.target2,
          tp3: signal.target3,
          sl: signal.stopLoss,
          support1: supp1,
          resistance1: res1,
          winProb: signal.winProbability,
          chartImg,
          dispatchedToTelegram: dispatched,
        };
        setLogs(prev => [newLog, ...prev].slice(0, 12));
      }

      setLastScanTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Auto-scan error:', err);
      toast.error('Scan failed — check your connection and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  // Real 1-minute auto-scan loop.
  useEffect(() => {
    if (!autoScanEnabled) return;
    executeAutoScan();
    const id = setInterval(executeAutoScan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScanEnabled]);

  // Automatic hourly backtest report so it goes out even if the user never
  // taps "Immediate Backtest Report".
  useEffect(() => {
    if (!isVipWithBot) return;
    const id = setInterval(async () => {
      const summary = await generateLiveBacktestSummary('Hourly Auto Report');
      if (telegramBotToken && telegramChatId) await sendBacktestReportToTelegram(telegramBotToken, telegramChatId, summary);
    }, BACKTEST_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVipWithBot, telegramBotToken, telegramChatId]);

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-emerald-500/40 shadow-2xl text-slate-100 font-sans my-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Radio className={`h-6 w-6 text-emerald-400`} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-100">Real Strategy Scan Engine & Telegram Dispatch</h3>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] gap-1 font-bold">
                <Flame className="h-3 w-3 text-amber-400" /> 21 STRATEGIES · LIVE CANDLES
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Runs all 21 strategies (incl. ICT/SMC, footprint delta, order blocks) against real Binance candles every 60s,
              across the top {totalScannedCount - MACRO_COUNT} pairs by volume plus gold, silver &amp; forex. Only dispatches when a strategy genuinely triggers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs flex items-center gap-2">
            <span className="text-slate-400">Last Scan:</span>
            <span className="font-extrabold text-emerald-400 text-sm">{isScanning ? 'SCANNING...' : lastScanTime}</span>
          </div>

          <Button
            onClick={toggleAutoScan}
            size="sm"
            variant="outline"
            className={autoScanEnabled
              ? 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold gap-1'
              : 'border-rose-500/50 text-rose-300 hover:bg-rose-500/20 text-xs font-bold gap-1'}
          >
            {autoScanEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoScanEnabled ? 'Auto-Scan: ON' : 'Auto-Scan: OFF'}
          </Button>

          <Button
            onClick={handleTriggerImmediateBacktest}
            size="sm"
            variant="outline"
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/20 text-xs font-bold gap-1"
          >
            <BarChart2 className="h-3.5 w-3.5 text-purple-400" />
            Immediate Backtest Report
          </Button>

          <Button
            onClick={executeAutoScan}
            disabled={isScanning}
            size="sm"
            variant="outline"
            className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 text-xs font-bold gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            Force Scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4 font-mono text-xs">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">WATCHLIST</span>
          <span className="text-sm font-bold text-slate-100">{totalScannedCount} pairs · live Binance data</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">ANALYSIS ENGINE</span>
          <span className="text-sm font-bold text-cyan-400">21 real strategies + RSI/MACD/ATR</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">TP1/TP2/TP3 ALERTS</span>
          <span className="text-sm font-bold text-emerald-400">Live price-triggered</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">BACKTEST REPORT</span>
          <span className="text-sm font-bold text-indigo-300">Auto-sent hourly</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 font-sans">
            <Send className="h-3.5 w-3.5 text-indigo-400" />
            Live Dispatched Signals (real triggers only)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Auto-scans every 60s</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center text-xs text-slate-400 font-mono">
            {!autoScanEnabled
              ? '⏸️ Auto-scan is paused. Toggle Auto-Scan back on, or use Force Scan for a one-off pass.'
              : isScanning
                ? '⏳ Scanning live candles...'
                : '⏳ No strategy has triggered yet this cycle. It will post here the moment one does.'}
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs max-h-56 overflow-y-auto scrollbar-none">
            {logs.map(log => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Badge className={log.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}>
                    {log.type}
                  </Badge>
                  <div>
                    <span className="font-bold text-slate-100 font-sans">{log.pair}</span>
                    <span className="text-[10px] text-slate-400 block">Entry: ${log.entryPrice} | TP1: ${log.tp1} | SL: ${log.sl}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <span className="text-emerald-400 font-bold">{log.winProb > 0 ? `${log.winProb}% backtested` : 'insufficient sample'}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLogForModal(log)}
                    className="border-slate-800 text-cyan-400 hover:bg-cyan-500/10 text-[10px] h-7 gap-1 font-bold"
                  >
                    <ImageIcon className="h-3 w-3" /> View Chart
                  </Button>
                  {log.dispatchedToTelegram && (
                    <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300 gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Sent
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLogForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-cyan-400" />
                {selectedLogForModal.pair} Setup Chart
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedLogForModal(null)} className="text-slate-400">
                Close
              </Button>
            </div>

            <img
              src={selectedLogForModal.chartImg}
              alt="Trade Setup Chart"
              className="w-full rounded-xl border border-slate-800 shadow-lg"
            />

            <div className="mt-3 text-right">
              <Button size="sm" onClick={() => setSelectedLogForModal(null)} className="bg-indigo-600 text-white font-bold text-xs">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};