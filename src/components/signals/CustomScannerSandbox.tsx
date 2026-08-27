import React, { useState } from 'react';
import { StrategyName, Signal, CandleData } from '@/types/trading';
import { Sliders, Zap, RefreshCw, CheckCircle2, BookMarked, Layers, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchKlines } from '@/services/binanceApi';
import { evaluateAllStrategies } from '@/services/strategies';
import { buildSignalFromStrategyHit, ScanTarget } from '@/services/signalEngine';
import { addPaperTradeFromSignal, hasOpenTradeForSymbol } from '@/services/paperTradingService';
import { toast } from 'sonner';

// Real Binance USDT-M perpetual futures universe (NOT spot). Gold & silver are
// real Binance perps too.
const ASSETS: { symbol: string; label: string; pair: string }[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT (PERP)', pair: 'BTC/USDT (PERP)' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT (PERP)', pair: 'ETH/USDT (PERP)' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT (PERP)', pair: 'SOL/USDT (PERP)' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT (PERP)', pair: 'BNB/USDT (PERP)' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT (PERP)', pair: 'XRP/USDT (PERP)' },
  { symbol: 'SUIUSDT', label: 'SUI/USDT (PERP)', pair: 'SUI/USDT (PERP)' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT (PERP)', pair: 'DOGE/USDT (PERP)' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USDT (PERP)', pair: 'AVAX/USDT (PERP)' },
  { symbol: 'XAUUSDT', label: 'XAU/USD (GOLD PERP)', pair: 'XAU/USD (GOLD PERP)' },
  { symbol: 'XAGUSDT', label: 'XAG/USD (SILVER PERP)', pair: 'XAG/USD (SILVER PERP)' },
];

// The full, REAL strategy set the engine actually evaluates (matches the
// StrategyName union in types/trading.ts exactly — including Supply/Demand Zone).
const STRATEGIES: StrategyName[] = [
  'Triple EMA Pullback',
  'Hyper Scalper',
  'VWAP Bounce',
  'BB Squeeze Breakout',
  'ICT Rejection Block',
  'Liquidity Sweep',
  'Fair Value Gap (FVG)',
  'Market Structure Shift',
  'Order Block + StochRSI',
  'RSI Divergence',
  'MACD Cross + Histogram',
  'Mean Reversion (BB)',
  'Golden/Death Cross',
  'Pin Bar / Hammer',
  'Range Breakout',
  'Supply/Demand Zone',
  'Fibonacci Golden Zone',
  'Wyckoff Spring/Upthrust',
  'Squeeze Momentum (TTM)',
  'Quasimodo (QM)',
  'Darvas Box',
];

const GOLDEN_MIN_CONFIDENCE = 80;

interface StrategyRead { name: string; triggered: boolean; direction: 'LONG' | 'SHORT' | null; reason: string; }

export const CustomScannerSandbox: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15m');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>('Supply/Demand Zone');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [selectedRead, setSelectedRead] = useState<StrategyRead | null>(null);
  const [triggeredList, setTriggeredList] = useState<StrategyRead[]>([]);
  const [scanned, setScanned] = useState<boolean>(false);

  const handleRunCustomScan = async () => {
    setIsScanning(true);
    setSignal(null);
    setSelectedRead(null);
    setTriggeredList([]);
    setScanned(false);

    try {
      const asset = ASSETS.find(a => a.symbol === selectedAsset)!;
      const isScalp = selectedTimeframe === '5m';
      const candles: CandleData[] = await fetchKlines(selectedAsset, selectedTimeframe, 200);

      if (candles.length < 60) {
        toast.error('Not enough live candles returned for this pair/timeframe. Try another.');
        setIsScanning(false);
        setScanned(true);
        return;
      }

      const results = evaluateAllStrategies(candles);
      const triggered = results.filter(r => r.triggered && r.direction) as StrategyRead[];
      const mine = results.find(r => r.name === selectedStrategy) as StrategyRead | undefined;

      setSelectedRead(mine ?? null);
      setTriggeredList(triggered);

      // Prefer the strategy the user picked; if it isn't firing, fall back to the
      // strongest strategy that IS firing so the sandbox always shows a real trade.
      const primary =
        mine && mine.triggered && mine.direction
          ? mine
          : triggered.length > 0
            ? triggered[0]
            : null;

      if (primary) {
        const agreeing = triggered.filter(r => r.direction === primary.direction).map(r => r.name);
        const target: ScanTarget = { symbol: asset.symbol, pair: asset.pair, interval: selectedTimeframe, isScalp };
        const built = buildSignalFromStrategyHit(
          target,
          candles,
          { name: primary.name, direction: primary.direction, reason: primary.reason },
          agreeing.length > 0 ? agreeing : [primary.name],
        );
        setSignal(built);
        if (built) {
          if (mine && mine.triggered) toast.success(`${asset.pair}: ${selectedStrategy} is firing — live setup built.`);
          else toast.success(`${asset.pair}: ${selectedStrategy} isn't firing, but ${primary.name} is — showing that setup.`);
        }
      } else {
        toast(`${asset.pair}: no strategy is triggering on real ${selectedTimeframe} candles right now.`);
      }
      setScanned(true);
    } catch (e) {
      console.error('[CustomScannerSandbox] scan failed:', e);
      toast.error('Scan failed — check your connection and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePaperTrade = () => {
    if (!signal) return;
    if (hasOpenTradeForSymbol(signal.symbol)) {
      toast.info(`${signal.pair} already has an open paper trade — track it on the Journal page.`);
      return;
    }
    addPaperTradeFromSignal(signal);
    toast.success(`${signal.pair} ${signal.type} opened in your paper journal (risk-free).`);
  };

  const isGolden = (signal?.confidenceScore ?? 0) >= GOLDEN_MIN_CONFIDENCE;

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">

      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
            <Sliders className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Custom AI Strategy Scanner Sandbox</h3>
            <p className="text-[10px] text-slate-500">Runs the real 21-strategy engine on live Binance USDT-M futures candles</p>
          </div>
        </div>
        <Badge className="bg-cyan-500/15 text-cyan-700 border-cyan-500/40 text-[10px]">
          <Zap className="h-3 w-3 mr-1" /> LIVE FUTURES ENGINE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Select Pair / Asset (Futures)</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-bold"
          >
            {ASSETS.map(a => (
              <option key={a.symbol} value={a.symbol}>{a.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Timeframe</label>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-bold"
          >
            <option value="5m">5 Minutes (Scalping)</option>
            <option value="15m">15 Minutes (Intraday)</option>
            <option value="1h">1 Hour (Swing)</option>
            <option value="4h">4 Hours (Position)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Strategy (all 21 real strategies)</label>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value as StrategyName)}
            className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-bold"
          >
            {STRATEGIES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

      </div>

      <Button
        onClick={handleRunCustomScan}
        disabled={isScanning}
        className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs py-5 shadow-lg gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
        {isScanning ? 'Evaluating 21 strategies on live candles...' : 'Execute Custom AI Scan Now'}
      </Button>

      {/* Selected-strategy read (always shows what the picked strategy currently detects) */}
      {scanned && selectedRead && (
        <div className={`mt-4 p-3 rounded-xl border text-[11px] flex items-start gap-2 ${selectedRead.triggered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-50 border-slate-200'}`}>
          <Info className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${selectedRead.triggered ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-slate-600">
            <span className="font-bold text-slate-800">{selectedRead.name}:</span> {selectedRead.triggered ? `firing ${selectedRead.direction}` : 'not firing right now'} — {selectedRead.reason}
          </span>
        </div>
      )}

      {/* Other strategies currently firing on this pair */}
      {scanned && triggeredList.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-slate-500 font-bold mb-1.5">Strategies firing on {selectedAsset} · {selectedTimeframe}:</p>
          <div className="flex flex-wrap gap-1.5">
            {triggeredList.map(r => (
              <span key={r.name} className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${r.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-600'}`}>
                {r.direction === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full live signal built from the real engine */}
      {signal && (
        <div className={`mt-4 p-4 rounded-xl bg-white border text-xs font-mono space-y-2 ${isGolden ? 'border-amber-400/70 ring-1 ring-amber-300/50' : 'border-cyan-500/40'}`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="font-extrabold text-slate-900 text-sm font-sans flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {signal.pair} — {signal.type} SETUP
              {isGolden && <span className="text-[9px] font-black text-amber-600 bg-amber-100 border border-amber-300 rounded px-1 py-0.5 ml-1">🏆 GOLDEN</span>}
            </span>
            <Badge className={signal.type === 'LONG' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 border-rose-500/30'}>
              {signal.winProbability > 0 ? `${signal.winProbability}% backtested` : 'low sample'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 font-bold font-sans text-[10px]">{signal.strategy}</span>
            {signal.demandSupplyZone && (
              <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-sans text-[10px] flex items-center gap-1">
                <Layers className="h-3 w-3" /> {signal.demandSupplyZone}
              </span>
            )}
            <span className="text-slate-400 font-sans text-[10px]">Conviction {signal.confidenceScore}/100</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div><span className="text-slate-500 font-sans block">ENTRY</span><span className="text-slate-900 font-bold">${signal.entryPrice}</span></div>
            <div><span className="text-emerald-600 font-sans block">TARGET 1</span><span className="text-emerald-600 font-bold">${signal.target1}</span></div>
            <div><span className="text-emerald-600 font-sans block">TARGET 2</span><span className="text-emerald-600 font-bold">${signal.target2}</span></div>
            <div><span className="text-rose-600 font-sans block">STOP LOSS</span><span className="text-rose-600 font-bold">${signal.stopLoss}</span></div>
          </div>

          <p className="text-slate-500 font-sans text-[11px] pt-1 leading-relaxed border-t border-slate-200">
            {signal.rationale}
          </p>

          <Button
            onClick={handlePaperTrade}
            variant="outline"
            size="sm"
            className="w-full mt-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 text-[11px] font-bold gap-1.5"
          >
            <BookMarked className="h-3.5 w-3.5" /> Take Paper Trade (track risk-free)
          </Button>
        </div>
      )}

      {scanned && !signal && triggeredList.length === 0 && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-[11px] text-slate-500">
          No strategy is triggering on {selectedAsset} · {selectedTimeframe} right now. The engine only emits a setup when a real condition is met — try another pair, timeframe, or scan again after the next candle.
        </div>
      )}

    </div>
  );
};
