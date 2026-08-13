import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { SignalCard } from '@/components/signals/SignalCard';
import { generateLiveSignals } from '@/services/signalEngine';
import { Signal } from '@/types/trading';
import { Sparkles, RefreshCw, Filter, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const AiSignals: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);

  const loadSignals = () => {
    setLoading(true);
    setTimeout(() => {
      setSignals(generateLiveSignals());
      setLoading(false);
      toast.success('AI Scanner Refreshed: New 5-Minute Strategy Confluence Computed');
    }, 600);
  };

  useEffect(() => {
    loadSignals();
    const interval = setInterval(() => {
      setSignals(generateLiveSignals());
    }, 5 * 60 * 1000); // Every 5 min
    return () => clearInterval(interval);
  }, []);

  const filtered = signals.filter(s => {
    if (filterType === 'LONG') return s.type === 'LONG';
    if (filterType === 'SHORT') return s.type === 'SHORT';
    if (filterType === 'GOLD') return s.symbol === 'XAUUSDT';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        <UpgradeBanner />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold">
                <Zap className="h-3.5 w-3.5 mr-1" /> 5-MIN DYNAMIC SCANNER
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono">
                1000+ Pairs
              </Badge>
            </div>
            <h1 className="text-3xl font-black text-slate-100 mt-2">Live AI Trading Signals</h1>
            <p className="text-sm text-slate-400 mt-1">
              Multi-indicator algorithms evaluating SMC Order Blocks, EMA Crossovers & RSI Divergence.
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>

      </main>
    </div>
  );
};

export default AiSignals;