import React from 'react';
import { Shield, Layers, Flame, Target, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LiquidityZone {
  price: number;
  type: 'BSL' | 'SSL' | 'FVG_BULL' | 'FVG_BEAR';
  volumeUsd: string;
  strength: 'HIGH' | 'EXTREME' | 'MEDIUM';
}

interface LiquidityHeatmapProps {
  symbol: string;
  pair: string;
  currentPrice: number;
}

export const LiquidityHeatmap: React.FC<LiquidityHeatmapProps> = ({ symbol, pair, currentPrice }) => {
  // Generate SMC liquidity zones dynamically based on current price
  const zones: LiquidityZone[] = [
    {
      price: +(currentPrice * 1.028).toFixed(2),
      type: 'BSL',
      volumeUsd: '$48.2M',
      strength: 'EXTREME',
    },
    {
      price: +(currentPrice * 1.014).toFixed(2),
      type: 'FVG_BEAR',
      volumeUsd: '$18.5M',
      strength: 'HIGH',
    },
    {
      price: +(currentPrice * 0.985).toFixed(2),
      type: 'FVG_BULL',
      volumeUsd: '$22.1M',
      strength: 'HIGH',
    },
    {
      price: +(currentPrice * 0.968).toFixed(2),
      type: 'SSL',
      volumeUsd: '$64.8M',
      strength: 'EXTREME',
    },
  ];

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-100">
      
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100">SMC Institutional Liquidity Map</h3>
            <p className="text-[10px] text-slate-400">Buy-Side (BSL), Sell-Side (SSL) & Fair Value Gaps (FVG)</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 font-mono">
          {pair}
        </Badge>
      </div>

      <div className="space-y-2.5 font-mono text-xs">
        {zones.map((z, idx) => {
          const isAbove = z.price > currentPrice;
          let badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
          let label = 'Buy-Side Liquidity Pool (BSL)';

          if (z.type === 'SSL') {
            badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            label = 'Sell-Side Liquidity Pool (SSL)';
          } else if (z.type === 'FVG_BULL') {
            badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
            label = 'Bullish Fair Value Gap Imbalance';
          } else if (z.type === 'FVG_BEAR') {
            badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            label = 'Bearish Fair Value Gap Imbalance';
          }

          return (
            <div key={`zone-${idx}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-2 py-1 rounded text-[10px] font-bold border ${badgeColor}`}>
                  {z.type}
                </div>
                <div>
                  <span className="font-bold text-slate-200 block font-sans text-xs">{label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Est. Volume Pool: {z.volumeUsd}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-black text-sm text-slate-100 block">${z.price.toLocaleString()}</span>
                <span className={`text-[10px] font-bold ${isAbove ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {isAbove ? `+${((z.price / currentPrice - 1) * 100).toFixed(2)}% Above` : `${((z.price / currentPrice - 1) * 100).toFixed(2)}% Below`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};