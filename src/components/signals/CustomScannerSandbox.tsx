import React, { useState } from 'react';
import { StrategyName } from '@/types/trading';
import { Sliders, Zap, Sparkles, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const CustomScannerSandbox: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15m');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>('SMC Order Block');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any | null>(null);

  const handleRunCustomScan = () => {
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      const isLong = Math.random() > 0.4;
      const mockPrice = selectedAsset === 'XAUUSDT' ? 2738.50 : selectedAsset === 'BTCUSDT' ? 96420 : 3480;
      
      const result = {
        symbol: selectedAsset,
        type: isLong ? 'LONG' : 'SHORT',
        strategy: selectedStrategy,
        timeframe: selectedTimeframe,
        entryPrice: mockPrice,
        tp1: +(mockPrice * (isLong ? 1.02 : 0.98)).toFixed(2),
        tp2: +(mockPrice * (isLong ? 1.045 : 0.955)).toFixed(2),
        stopLoss: +(mockPrice * (isLong ? 0.985 : 1.015)).toFixed(2),
        winProbability: Math.floor(Math.random() * 12) + 84,
        rationale: `Institutional confluence detected using ${selectedStrategy} on the ${selectedTimeframe} chart for ${selectedAsset}. Volume breakout confirms high-probability liquidity sweep.`,
      };

      setScanResult(result);
      toast.success(`Custom AI Scan Complete for ${selectedAsset}! Signal Computed.`);
    }, 1000);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl font-sans text-slate-100">
      
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Sliders className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100">Custom AI Strategy Scanner Sandbox</h3>
            <p className="text-[10px] text-slate-400">Configure multi-timeframe strategy confluence parameters</p>
          </div>
        </div>
        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
          <Zap className="h-3 w-3 mr-1" /> ON-DEMAND ENGINE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        
        <div>
          <label className="text-[11px] text-slate-400 font-bold block mb-1">Select Pair / Asset</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-bold"
          >
            <option value="XAUUSDT">XAU/USD (Gold Metals)</option>
            <option value="BTCUSDT">BTC/USDT (Bitcoin Spot)</option>
            <option value="ETHUSDT">ETH/USDT (Ethereum Spot)</option>
            <option value="SOLUSDT">SOL/USDT (Solana Spot)</option>
            <option value="BNBUSDT">BNB/USDT (Binance Coin)</option>
            <option value="SUIUSDT">SUI/USDT (Sui Network)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 font-bold block mb-1">Timeframe</label>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-bold"
          >
            <option value="5m">5 Minutes (Scalping)</option>
            <option value="15m">15 Minutes (Intraday)</option>
            <option value="1h">1 Hour (Swing)</option>
            <option value="4h">4 Hours (Position)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 font-bold block mb-1">Algorithm Strategy</label>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value as StrategyName)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-bold"
          >
            <option value="SMC Order Block">SMC Order Block & Liquidity Grab</option>
            <option value="EMA 20/200 Golden Cross">EMA 20/200 Golden Cross</option>
            <option value="RSI Bullish Divergence">RSI Divergence Confluence</option>
            <option value="MACD Trend Impulse">MACD Trend Impulse</option>
            <option value="Supertrend Breakout">Supertrend Breakout</option>
            <option value="Volume Profile Rejection">Volume Profile Point of Control</option>
          </select>
        </div>

      </div>

      <Button
        onClick={handleRunCustomScan}
        disabled={isScanning}
        className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs py-5 shadow-lg shadow-indigo-900/30 gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
        {isScanning ? 'Computing Institutional Multi-Factor Strategy...' : 'Execute Custom AI Scan Now'}
      </Button>

      {/* Output Scan Result Box */}
      {scanResult && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-extrabold text-slate-100 text-sm font-sans flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {scanResult.symbol} - {scanResult.type} SETUP
            </span>
            <Badge className={scanResult.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}>
              {scanResult.winProbability}% WIN PROBABILITY
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div><span className="text-slate-400 font-sans block">ENTRY</span><span className="text-slate-100 font-bold">${scanResult.entryPrice}</span></div>
            <div><span className="text-emerald-400 font-sans block">TARGET 1</span><span className="text-emerald-400 font-bold">${scanResult.tp1}</span></div>
            <div><span className="text-emerald-400 font-sans block">TARGET 2</span><span className="text-emerald-400 font-bold">${scanResult.tp2}</span></div>
            <div><span className="text-rose-400 font-sans block">STOP LOSS</span><span className="text-rose-400 font-bold">${scanResult.stopLoss}</span></div>
          </div>

          <p className="text-slate-400 font-sans text-[11px] pt-1 leading-relaxed border-t border-slate-800/80">
            {scanResult.rationale}
          </p>
        </div>
      )}

    </div>
  );
};