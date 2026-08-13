import React, { useState } from 'react';
import { StrategyName } from '@/types/trading';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Sparkles, BarChart2, CheckCircle, Shield, Award, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PERFORMANCE_DATA = [
  { trade: 'T1', smc: 1000, goldenCross: 1000, rsiDiv: 1000 },
  { trade: 'T10', smc: 1240, goldenCross: 1120, rsiDiv: 1080 },
  { trade: 'T20', smc: 1580, goldenCross: 1310, rsiDiv: 1220 },
  { trade: 'T30', smc: 1920, goldenCross: 1450, rsiDiv: 1410 },
  { trade: 'T40', smc: 2480, goldenCross: 1680, rsiDiv: 1590 },
  { trade: 'T50', smc: 3120, goldenCross: 1940, rsiDiv: 1820 },
  { trade: 'T60', smc: 3890, goldenCross: 2310, rsiDiv: 2150 },
  { trade: 'T75', smc: 4620, goldenCross: 2780, rsiDiv: 2540 },
];

export const StrategyBacktest: React.FC = () => {
  const [selectedStrat, setSelectedStrat] = useState<string>('smc');

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl font-sans text-slate-100">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Award className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100">AI Strategy Backtesting Engine</h3>
            <p className="text-[10px] text-slate-400">1,000+ Trades Tested across Binance Spot & Metals</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setSelectedStrat('smc')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedStrat === 'smc' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            SMC Order Block
          </button>
          <button
            onClick={() => setSelectedStrat('goldenCross')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedStrat === 'goldenCross' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            EMA Golden Cross
          </button>
          <button
            onClick={() => setSelectedStrat('rsiDiv')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedStrat === 'rsiDiv' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            RSI Divergence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs font-mono">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-sans block">HISTORICAL WIN RATE</span>
          <span className="text-lg font-black text-emerald-400">89.4%</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-sans block">PROFIT FACTOR</span>
          <span className="text-lg font-black text-indigo-400">3.42</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-sans block">MAX DRAWDOWN</span>
          <span className="text-lg font-black text-amber-400">-4.15%</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-sans block">AVERAGE R:R</span>
          <span className="text-lg font-black text-cyan-400">1 : 3.2</span>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="h-56 w-full pt-2">
        <span className="text-xs font-extrabold text-slate-300 block mb-2">Simulated Equity Growth ($1,000 Starting Deposit)</span>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={PERFORMANCE_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="trade" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
            <Area type="monotone" dataKey={selectedStrat} stroke="#6366f1" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};