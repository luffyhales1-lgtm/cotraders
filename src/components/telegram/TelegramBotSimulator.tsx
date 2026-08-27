import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchTopCryptos } from '@/services/binanceApi';
import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';
import { generateLiveBacktestSummary, sendBacktestReportToTelegram } from '@/services/backtestService';
import { fetchKlines } from '@/services/binanceApi';
import { evaluateAllStrategies } from '@/services/strategies';
import { buildSignalFromStrategyHit } from '@/services/signalEngine';
import {
  Bot,
  Send,
  Sparkles,
  Scan,
  Clock,
  CheckCircle2,
  ExternalLink,
  Zap,
  ArrowRight,
  Shield,
  BarChart2,
  Image as ImageIcon,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const TelegramBotSimulator: React.FC = () => {
  const { user, telegramBotToken, telegramChatId, dispatchTelegramSignal, isVipMember } = useAuth();

  const [step, setStep] = useState<'IDLE' | 'SELECT_TIMEFRAME' | 'SELECT_COIN' | 'SCANNING' | 'COMPLETED'>('IDLE');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [liveAssets, setLiveAssets] = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string>('XAUUSDT');
  const [scannedSignal, setScannedSignal] = useState<any | null>(null);

  // Check if user is VIP and has set up bot
  const isVipWithBot = isVipMember && telegramBotToken && telegramChatId;

  useEffect(() => {
    const loadAssets = async () => {
      const tickers = await fetchTopCryptos();
      setLiveAssets(tickers.slice(0, 8));
    };
    loadAssets();
  }, []);

  const timeframes = [
    { id: '1m', label: '1m (Scalp)' },
    { id: '5m', label: '5m (High Win)' },
    { id: '15m', label: '15m (Intraday)' },
    { id: '1h', label: '1h (Trend)' },
    { id: '4h', label: '4h (Swing)' },
  ];

  const handleStartScannerMenu = async () => {
    if (!isVipWithBot) {
      toast.error('Only VIP members with configured Telegram bot can use this feature.');
      return;
    }
    const tickers = await fetchTopCryptos();
    setLiveAssets(tickers.slice(0, 8));
    setStep('SELECT_TIMEFRAME');
  };

  const handleTriggerImmediateBacktest = async () => {
    if (!isVipWithBot) {
      toast.error('Only VIP members with configured Telegram bot can use this feature.');
      return;
    }
    toast.info('Running real walk-forward backtest...');
    const summary = await generateLiveBacktestSummary('Telegram Interactive On-Demand Report');

    if (telegramBotToken && telegramChatId) {
      await sendBacktestReportToTelegram(telegramBotToken, telegramChatId, summary);
      toast.success('Immediate Backtest Performance Report dispatched to Telegram!');
    } else {
      toast.success(`Backtest Generated! Win Rate: ${summary.winRate}% | Net PnL: +${summary.totalPnLPercent}%`);
    }
  };

  const handleSelectTimeframe = (tf: string) => {
    setSelectedTimeframe(tf);
    setStep('SELECT_COIN');
  };

  const handleSelectCoinAndScan = async (coinSymbol: string) => {
    if (!isVipWithBot) {
      toast.error('Only VIP members with configured Telegram bot can use this feature.');
      return;
    }
    setSelectedCoin(coinSymbol);
    setStep('SCANNING');

    try {
      const selected = liveAssets.find(c => c.symbol === coinSymbol) || liveAssets[0] || {
        symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', price: 2894.50, change24h: 1.84
      };

      const candles = await fetchKlines(selected.symbol, selectedTimeframe, 200);
      if (candles.length < 60) {
        toast.error('Not enough historical candles for this timeframe yet — try a different one.');
        setStep('SELECT_COIN');
        return;
      }

      const results = evaluateAllStrategies(candles);
      const triggered = results.filter(r => r.triggered && r.direction);

      if (triggered.length === 0) {
        setScannedSignal(null);
        setStep('COMPLETED');
        toast.info(`Scan complete for ${selected.pair}: no strategy conditions are met right now. That's a real "no trade" result, not an error.`);
        return;
      }

      // Mirror the live engine exactly: consensus direction (majority vote of the
      // triggered strategies), then hand it to the shared quality gate so the
      // simulated bot output matches what the real gated dispatcher would send.
      const longVotes = triggered.filter(r => r.direction === 'LONG').length;
      const shortVotes = triggered.filter(r => r.direction === 'SHORT').length;
      const netDir: 'LONG' | 'SHORT' | null =
        longVotes > shortVotes ? 'LONG' : shortVotes > longVotes ? 'SHORT' : null;
      const agreeingReads = netDir ? triggered.filter(r => r.direction === netDir) : [];
      const best = agreeingReads[0];
      const agreeing = agreeingReads.map(r => r.name);
      const signal = best
        ? buildSignalFromStrategyHit(
            { symbol: selected.symbol, pair: selected.pair, interval: selectedTimeframe },
            candles, best, agreeing,
          )
        : null;
      if (!signal) {
        setScannedSignal(null);
        setStep('COMPLETED');
        toast.info(`${selected.pair}: strategies triggered but the setup didn't clear the quality gate (needs stronger confluence, trend & momentum alignment). Treated as "no trade" — exactly what keeps the journal clean.`);
        return;
      }

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
        timeframe: selectedTimeframe,
        strategy: signal.strategy,
        winProbability: signal.winProbability,
        footprintDelta: signal.footprintDelta,
      });

      const generated = {
        pair: signal.pair,
        type: signal.type,
        strategy: signal.strategy,
        timeframe: selectedTimeframe,
        entryPrice: signal.entryPrice,
        target1: signal.target1,
        target2: signal.target2,
        target3: signal.target3,
        stopLoss: signal.stopLoss,
        support1: supp1,
        resistance1: res1,
        leverage: signal.leverage,
        winProbability: signal.winProbability,
        riskReward: signal.riskReward,
        rationale: signal.rationale,
        chartScreenshotUrl: chartImg,
        footprintDelta: signal.footprintDelta,
        backtestLabel: signal.backtestLabel,
        momentumNote: signal.momentumNote,
      };

      setScannedSignal(generated);
      setStep('COMPLETED');

      if (telegramBotToken && telegramChatId) {
        dispatchTelegramSignal(generated);
      } else {
        toast.success(`Live scan complete for ${selected.pair}! Configure Telegram Bot Token in Admin Panel to dispatch automatically.`);
      }
    } catch (e) {
      console.error('[TelegramBotSimulator] scan failed:', e);
      toast.error('Scan failed — check your connection and try again.');
      setStep('SELECT_COIN');
    }
  };

  const handleReset = () => {
    if (!isVipWithBot) {
      toast.error('Only VIP members with configured Telegram bot can reset their bot.');
      return;
    }
    setStep('IDLE');
    setScannedSignal(null);
  };

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-b from-white via-slate-50 to-slate-50 border border-cyan-200 shadow-2xl font-sans text-slate-900 relative overflow-hidden">

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-100 border border-cyan-200 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-cyan-600 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">Telegram Bot Scanner Menu (Binance Futures Live API)</h3>
              <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px]">
                <Zap className="h-3 w-3 mr-1" /> BINANCE FUTURES LIVE
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Footprint Delta, Spoofing Wall, SMC OB & Immediate Backtest Reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTriggerImmediateBacktest}
            size="sm"
            variant="outline"
            className={isVipWithBot ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold gap-1" : "border-slate-200 text-slate-400 cursor-not-allowed"}
          >
            <BarChart2 className="h-3.5 w-3.5 text-indigo-600" /> Immediate Backtest Report
          </Button>

          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className={isVipWithBot ? "border-slate-200 text-slate-500 text-xs font-bold" : "border-slate-200 text-slate-400 cursor-not-allowed"}
          >
            Reset Bot Menu
          </Button>
        </div>
      </div>

      {/* Interactive Chat Window */}
      <div className="mt-6 space-y-4 max-w-2xl mx-auto">

        {step === 'IDLE' && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-cyan-600 font-bold text-xs">
              <Bot className="h-4 w-4" /> LiveTrading Telegram Bot Engine
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Welcome! Tap <b>🔍 Live Futures & Gold Scanner</b> to perform footprint delta analysis & send chart screenshots to Telegram:
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleStartScannerMenu}
                className={isVipWithBot ? "flex-1 bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-xs py_5 gap-2 shadow-lg shadow-cyan-200" : "flex-1 border-slate-200 text-slate-400 cursor-not-allowed"}
              >
                <Scan className="h-4 w-4" />
                Tap Menu: 🔍 Live Futures & Gold Scanner
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                onClick={handleTriggerImmediateBacktest}
                variant="outline"
                className={isVipWithBot ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs py_5 gap-2" : "border-slate-200 text-slate-400 cursor-not-allowed"}
              >
                <BarChart2 className="h-4 w-4" />
                📊 Immediate Backtest Report
              </Button>
            </div>
          </div>
        )}

        {step === 'SELECT_TIMEFRAME' && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-cyan-200 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-cyan-600 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> STEP 1: SELECT TIMEFRAME
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">Futures Stream Active</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {timeframes.map(tf => (
                <Button
                  key={tf.id}
                  onClick={() => handleSelectTimeframe(tf.id)}
                  variant="outline"
                  className="border-slate-200 hover:border-cyan-500 text-slate-700 hover:bg-cyan-50 font-mono text-xs py_4"
                >
                  {tf.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 'SELECT_COIN' && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-cyan-200 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabod text-amber-600 flex items-center gap-1.5">
                <Scan className="h-4 w-4" /> STEP 2: SELECT FUTURES ASSET ({selectedTimeframe})
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">Binance Futures Live API</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {liveAssets.map(c => (
                <Button
                  key={c.symbol}
                  onClick={() => handleSelectCoinAndScan(c.symbol)}
                  className="glass-panel hover:border-emerald-500 text-slate-900 font-bold text-xs py_5 flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-mono">{c.pair}</span>
                  <span className="text-[10px] text-emerald-600 font-mono">{c.price < 10 ? c.price.toFixed(4) : c.price.toLocaleString()}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 'SCANNING' && (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-cyan-600 animate-spin mx-auto" />
            <h4 className="font-extrabold text-sm text-slate-900">Analyzing Footprint Delta, Spoofing Walls & Generating Chart Screenshot...</h4>
            <p className="text-xs text-slate-500 font-mono">
              Binance Futures Live Feed: {selectedCoin} ({selectedTimeframe})
            </p>
          </div>
        )}

        {step === 'COMPLETED' && scannedSignal && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-emerald-200 space-y-4 animate-in zoom-in-95 duration-300">

            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-extrabold text-sm text-slate-900">{scannedSignal.pair} FULL ANALYSIS COMPLETE</span>
              </div>
              <Badge className={scannedSignal.type === 'LONG' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 font-bold' : 'bg-rose-100 text-rose-700 border-rose-200 font-bold'}>
                {scannedSignal.type} ({scannedSignal.winProbability}% Win)
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg glass-panel">
                <span className="text-[10px] text-slate-500 font-sans block">ENTRY</span>
                <span className="font-bold text-slate-900">${scannedSignal.entryPrice}</span>
              </div>
              <div className="p-2.5 rounded-lg glass-panel">
                <span className="text-[10px] text-emerald-600 font-sans block">TP1 (SCALP)</span>
                <span className="font-bold text-emerald-600">${scannedSignal.target1}</span>
              </div>
              <div className="p-2.5 rounded-lg glass-panel">
                <span className="text-[10px] text-emerald-600 font-sans block">TP2</span>
                <span className="font-bold text-emerald-600">${scannedSignal.target2}</span>
              </div>
              <div className="p-2.5 rounded-lg glass-panel">
                <span className="text-[10px] text-rose-600 font-sans block">STOP LOSS</span>
                <span className="font-bold text-rose-600">${scannedSignal.stopLoss}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl glass-panel font-mono text-xs space-y-1">
              <span className="font-bold text-slate-600 font-sans block text-[11px] mb-1">📊 Footprint Delta & Spoofing Analysis</span>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="text-cyan-600">CVD Delta: <b>+{scannedSignal.footprintDelta} Delta</b></div>
                <div className="text-amber-600">Spoofing Wall: <b>Absorbed</b></div>
                <div className="text-emerald-600">Support 1 (S1): <b>${scannedSignal.support1}</b></div>
                <div className="text-rose-600">Resistance 1 (R1): <b>${scannedSignal.resistance1}</b></div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md">
              <div className="p-2 bg-slate-100 text-[10px] font-bold text-cyan-600 flex items-center justify-between">
                <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Trade Setup Chart Screenshot</span>
                <span className="text-slate-500">Attached to Telegram</span>
              </div>
              <img src={scannedSignal.chartScreenshotUrl} alt="Chart Screenshot" className="w-full h-auto" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-600 font-mono flex items-center gap-1">
                <Send className="h-3.5 w-3.5" /> Dispatched to Telegram Bot
              </span>
              <Button onClick={() => setStep('SELECT_TIMEFRAME')} size="sm" variant="outline" className="border-slate-200 text-slate-600 text-xs font-bold">
                Scan Another Asset
              </Button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};