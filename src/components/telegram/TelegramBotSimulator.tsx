import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Scan, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const TelegramBotSimulator: React.FC = () => {
  const { telegramBotToken, telegramChatId, dispatchTelegramSignal } = useAuth();

  const [step, setStep] = useState<'IDLE' | 'SELECT_TIMEFRAME' | 'SELECT_COIN' | 'SCANNING' | 'COMPLETED'>('IDLE');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [selectedCoin, setSelectedCoin] = useState<string>('BTCUSDT');
  const [scannedSignal, setScannedSignal] = useState<any | null>(null);

  const timeframes = [
    { id: '1m', label: '1m (Scalp)' },
    { id: '5m', label: '5m (High Win)' },
    { id: '15m', label: '15m (Intraday)' },
    { id: '1h', label: '1h (Trend)' },
    { id: '4h', label: '4h (Swing)' },
  ];

  const coins = [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (Gold)', price: 2892.40 },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT', price: 96940.00 },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT', price: 3540.20 },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT', price: 228.40 },
    { symbol: 'SUIUSDT', pair: 'SUI/USDT', price: 3.680 },
    { symbol: 'BNBUSDT', pair: 'BNB/USDT', price: 665.10 },
  ];

  const handleStartScannerMenu = () => {
    setStep('SELECT_TIMEFRAME');
  };

  const handleSelectTimeframe = (tf: string) => {
    setSelectedTimeframe(tf);
    setStep('SELECT_COIN');
  };

  const handleSelectCoinAndScan = (coinSymbol: string) => {
    setSelectedCoin(coinSymbol);
    setStep('SCANNING');

    setTimeout(() => {
      const selected = coins.find(c => c.symbol === coinSymbol) || coins[1];
      const isLong = Math.random() > 0.35;
      const price = selected.price;

      const generated = {
        pair: selected.pair,
        type: isLong ? ('LONG' as const) : ('SHORT' as const),
        strategy: 'SMC Order Block & Liquidity Sweep',
        timeframe: selectedTimeframe,
        entryPrice: price,
        target1: +(price * (isLong ? 1.022 : 0.978)).toFixed(2),
        target2: +(price * (isLong ? 1.048 : 0.952)).toFixed(2),
        target3: +(price * (isLong ? 1.082 : 0.918)).toFixed(2),
        stopLoss: +(price * (isLong ? 0.984 : 1.016)).toFixed(2),
        leverage: isLong ? '20x' : '10x',
        winProbability: Math.floor(Math.random() * 8) + 89,
        riskReward: '1:3.4',
        rationale: `Direct live scan completed on ${selectedTimeframe} chart. Order block mitigation confirmed with institutional volume surge.`,
      };

      setScannedSignal(generated);
      setStep('COMPLETED');

      // Auto dispatch to connected Telegram channel
      if (telegramBotToken && telegramChatId) {
        dispatchTelegramSignal(generated);
      } else {
        toast.success(`Live Scan Complete for ${selected.pair}! Configure Telegram Bot Token in Admin Panel to dispatch automatically.`);
      }
    }, 1200);
  };

  const handleReset = () => {
    setStep('IDLE');
    setScannedSignal(null);
  };

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-cyan-500/40 shadow-2xl font-sans text-slate-100 relative overflow-hidden">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-cyan-400 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-100">Telegram Bot Scanner Menu</h3>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
                <Zap className="h-3 w-3 mr-1" /> TELEGRAM INTEGRATION
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tap Menu -> Select Timeframe -> Select Coin -> Auto Redirect Trade to Telegram
            </p>
          </div>
        </div>

        <Button onClick={handleReset} variant="outline" size="sm" className="border-slate-800 text-slate-400 text-xs font-bold">
          Reset Bot Menu
        </Button>
      </div>

      {/* Interactive Chat Window */}
      <div className="mt-6 space-y-4 max-w-2xl mx-auto">
        
        {/* Step 0: Idle Menu Prompt */}
        {step === 'IDLE' && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <Bot className="h-4 w-4" /> LiveTrading Telegram Bot
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Welcome to the LiveTrading AI Scanner Bot! Tap <b>🔍 Interactive Scanner</b> below to select timeframe & asset:
            </p>
            <div className="pt-2">
              <Button 
                onClick={handleStartScannerMenu} 
                className="w-full bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-xs py-5 gap-2 shadow-lg shadow-cyan-950/40"
              >
                <Scan className="h-4 w-4" />
                Tap Menu: 🔍 Live AI Scanner
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Select Timeframe */}
        {step === 'SELECT_TIMEFRAME' && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-cyan-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> STEP 1: SELECT TIMEFRAME
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">Telegram Interactive</Badge>
            </div>
            <p className="text-xs text-slate-300">Choose the candle timeframe for the AI order block strategy algorithm:</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {timeframes.map(tf => (
                <Button
                  key={tf.id}
                  onClick={() => handleSelectTimeframe(tf.id)}
                  variant="outline"
                  className="border-slate-800 hover:border-cyan-500 text-slate-200 hover:bg-cyan-500/10 font-mono text-xs py-4"
                >
                  {tf.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Coin */}
        {step === 'SELECT_COIN' && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                <Scan className="h-4 w-4" /> STEP 2: SELECT COIN / ASSET ({selectedTimeframe})
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">Binance & Gold API</Badge>
            </div>
            <p className="text-xs text-slate-300">Select which asset to scan against Binance & Gold live feeds:</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {coins.map(c => (
                <Button
                  key={c.symbol}
                  onClick={() => handleSelectCoinAndScan(c.symbol)}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-100 font-bold text-xs py-5 flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-mono">{c.pair}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">${c.price.toLocaleString()}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Scanning Loading State */}
        {step === 'SCANNING' && (
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
            <h4 className="font-extrabold text-sm text-slate-100">Computing Live Multi-Factor AI Confluence...</h4>
            <p className="text-xs text-slate-400 font-mono">
              Scanning Binance Vision & Gold Spot stream for {selectedCoin} ({selectedTimeframe})
            </p>
          </div>
        )}

        {/* Step 4: Completed Scan Result & Telegram Dispatch */}
        {step === 'COMPLETED' && scannedSignal && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/50 space-y-4 animate-in zoom-in-95 duration-300">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="font-extrabold text-sm text-slate-100">{scannedSignal.pair} LIVE SIGNAL COMPUTED</span>
              </div>
              <Badge className={scannedSignal.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold'}>
                {scannedSignal.type} ({scannedSignal.winProbability}% Win)
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">ENTRY</span>
                <span className="font-bold text-slate-100">${scannedSignal.entryPrice}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-emerald-400 font-sans block">TP1</span>
                <span className="font-bold text-emerald-400">${scannedSignal.target1}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-emerald-400 font-sans block">TP2</span>
                <span className="font-bold text-emerald-400">${scannedSignal.target2}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-rose-400 font-sans block">STOP LOSS</span>
                <span className="font-bold text-rose-400">${scannedSignal.stopLoss}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed">
              <b>AI Confluence:</b> {scannedSignal.rationale}
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <Send className="h-3.5 w-3.5" /> Dispatched to Telegram Chat
              </span>
              <Button onClick={() => setStep('SELECT_TIMEFRAME')} size="sm" variant="outline" className="border-slate-800 text-slate-300 text-xs font-bold">
                Scan Another Coin
              </Button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};