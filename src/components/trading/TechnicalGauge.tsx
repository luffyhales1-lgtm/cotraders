import React from 'react';
import { Gauge, TrendingUp, Activity, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TechnicalGaugeProps {
  pair: string;
  price: number;
  change24h: number;
}

export const TechnicalGauge: React.FC<TechnicalGaugeProps> = ({ pair, price, change24h }) => {
  // Score indicator from 0 to 100 based on price change and mock confluence
  const score = Math.min(98, Math.max(12, Math.round(50 + change24h * 5 + 15)));
  
  let rating = 'NEUTRAL';
  let ratingColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (score >= 75) {
    rating = 'STRONG BUY';
    ratingColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  } else if (score >= 58) {
    rating = 'BUY';
    ratingColor = 'text-teal-400 bg-teal-500/10 border-teal-500/30';
  } else if (score <= 25) {
    rating = 'STRONG SELL';
    ratingColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
  } else if (score <= 42) {
    rating = 'SELL';
    ratingColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  }

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl text-slate-100 font-sans">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100">Technical Indicator Summary</h3>
            <p className="text-[10px] text-slate-400">Multi-Timeframe Oscillators & Moving Averages</p>
          </div>
        </div>
        <Badge className={`font-mono text-[11px] font-extrabold ${ratingColor}`}>
          {rating}
        </Badge>
      </div>

      {/* Visual Gauge Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
          <span className="text-rose-400">STRONG SELL</span>
          <span>NEUTRAL</span>
          <span className="text-emerald-400">STRONG BUY</span>
        </div>
        <div className="relative h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-all duration-700 rounded-full"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="text-center text-xs font-mono font-bold text-slate-300">
          Confluence Index: <span className="text-cyan-400">{score} / 100</span>
        </div>
      </div>

      {/* Indicator Breakdown */}
      <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-[9px] text-slate-400 font-sans block">RSI (14)</span>
          <span className="font-bold text-emerald-400">64.2 (Bullish)</span>
        </div>

        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-[9px] text-slate-400 font-sans block">MACD (12,26)</span>
          <span className="font-bold text-emerald-400">+14.2 (Histogram)</span>
        </div>

        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-[9px] text-slate-400 font-sans block">EMA 20/200</span>
          <span className="font-bold text-indigo-400">Golden Cross</span>
        </div>
      </div>

    </div>
  );
};