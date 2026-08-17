import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
import { SignalCard } from '@/components/signals/SignalCard';
import { TelegramBotSimulator } from '@/components/telegram/TelegramBotSimulator';
import { AutoScannerService } from '@/components/telegram/AutoScannerService';
import { CustomScannerSandbox } from '@/components/signals/CustomScannerSandbox';
import { scanMarketForSignals } from '@/services/signalEngine';
import { Signal } from '@/types/trading';
import { RefreshCw, Zap, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const AiSignals: React.FC = () => {
  const { isVipMember, dispatchTelegramSignal } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const live = await scanMarketForSignals();
      setSignals(live);
      toast.success(live.length > 0
        ? `Scan complete: ${live.length} strategy trigger(s) found on real candles.`
        : 'Scan complete: no strategy conditions met right now.');
    } catch (e) {
      toast.error('Scan failed — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
    const interval = setInterval(() => {
      loadSignals();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = signals.filter(s => {
    if (filterType === 'LONG') return s.type === 'LONG';
    if (filterType === 'SHORT') return s.type === 'SHORT';
    if (filterType === 'GOLD') return s.symbol === 'XAUUSDT';
    return true;
  });

  const handleBroadcastTelegram = (sig: Signal) => {
    dispatchTelegramSignal({
      pair: sig.pair,
      type: sig.type,
      strategy: sig.strategy,
      timeframe: sig.timeframe,
      entryPrice: sig.entryPrice,
      target1: sig.target1,
      target2: sig.target2,
      target3: sig.target3,
      stopLoss: sig.stopLoss,
      leverage: sig.leverage,
      winProbability: sig.winProbability,
      riskReward: sig.riskReward,
      rationale: sig.rationale,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        <UpgradeBanner />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold">
                <Zap className="h-3.5 w-3.5 mr-1" /> 1-MIN AUTOMATED DISPATCH
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono">
                1000+ Pairs & Gold
              </Badge>
            </div>
            <h1 className="text-3xl font-black text-slate-100 mt-2">Live AI Trading Signals & Telegram Redirect</h1>
            <p className="text-sm text-slate-400 mt-1">
              Multi-indicator algorithms evaluating SMC Order Blocks, EMA Crossovers & RSI Divergence with 1-min auto Telegram dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              {['ALL', 'LONG', 'SHORT', 'GOLD'].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button 
              onClick={loadSignals} 
              disabled={loading}
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Scan Now
            </Button>
          </div>
        </div>

        {/* 1-Minute Auto Scanner Service */}
        <AutoScannerService />

        <div className="mb-8">
          <TelegramBotSimulator />
        </div>

        {!isVipMember ? (
          <div>
            <VIPGateModal 
              title="Full AI Signal Engine Restricted" 
              description="Free users can only view sample setups. Subscribe to VIP to view all live 5-minute signals and receive automated Telegram alerts."
            />
            
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-300 mb-4">Sample Signal Preview</h3>
              <div className="max-w-md">
                {signals.slice(0, 1).map(sig => (
                  <SignalCard key={sig.id} signal={{ ...sig, isVipOnly: false }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <CustomScannerSandbox />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(signal => (
                <div key={signal.id} className="relative group">
                  <SignalCard signal={signal} />
                  <div className="mt-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBroadcastTelegram(signal)}
                      className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-[11px] font-bold h-7 gap-1"
                    >
                      <Send className="h-3 w-3" /> Dispatch to Telegram
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AiSignals;