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
  let ratingColor = 'text-amber-600 bg-amber-100 border-amber-200';
  if (score >= 75) {
    rating = 'STRONG BUY';
    ratingColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
  } else if (score >= 58) {
    rating = 'BUY';
    ratingColor = 'text-teal-600 bg-teal-100 border-teal-200';
  } else if (score <= 25) {
    rating = 'STRONG SELL';
    ratingColor = 'text-rose-600 bg-rose-100 border-rose-200';
  } else if (score <= 42) {
    rating = 'SELL';
    ratingColor = 'text-rose-600 bg-rose-100 border-rose-200';
  }

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl text-slate-900 font-sans">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-100 border border-cyan-200 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Technical Indicator Summary</h3>
            <p className="text-[10px] text-slate-500">Multi-Timeframe Oscillators & Moving Averages</p>
          </div>
        </div>
        <Badge className={`font-mono text-[11px] font-extrabold ${ratingColor}`}>
          {rating}
        </Badge>
      </div>

      {/* Visual Gauge Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold">
          <span className="text-rose-600">STRONG SELL</span>
          <span>NEUTRAL</span>
          <span className="text-emerald-600">STRONG BUY</span>
        </div>
        <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-all duration-700 rounded-full"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="text-center text-xs font-mono font-bold text-slate-600">
          Confluence Index: <span className="text-cyan-600">{score} / 100</span>
        </div>
      </div>

      {/* Indicator Breakdown */}
      <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-[9px] text-slate-500 font-sans block">RSI (14)</span>
          <span className="font-bold text-emerald-600">64.2 (Bullish)</span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-[9px] text-slate-500 font-sans block">MACD (12,26)</span>
          <span className="font-bold text-emerald-600">+14.2 (Histogram)</span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-[9px] text-slate-500 font-sans block">EMA 20/200</span>
          <span className="font-bold text-indigo-600">Golden Cross</span>
        </div>
      </div>

    </div>
  );
};