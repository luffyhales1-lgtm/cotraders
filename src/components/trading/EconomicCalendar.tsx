import React from 'react';
import { Calendar, Globe, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EconomicEvent {
  id: string;
  time: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'CRYPTO';
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast: string;
  previous: string;
  assetAffected: string;
}

const UPCOMING_EVENTS: EconomicEvent[] = [
  {
    id: 'e1',
    time: '14:30 EST Today',
    currency: 'USD',
    event: 'US Core CPI Inflation Rate (MoM)',
    impact: 'HIGH',
    forecast: '0.3%',
    previous: '0.3%',
    assetAffected: 'XAU/USD & BTC'
  },
  {
    id: 'e2',
    time: '19:00 EST Today',
    currency: 'USD',
    event: 'FOMC Meeting Minutes & Rate Decision',
    impact: 'HIGH',
    forecast: '4.75%',
    previous: '5.00%',
    assetAffected: 'Gold & Crypto'
  },
  {
    id: 'e3',
    time: '08:30 EST Tomorrow',
    currency: 'USD',
    event: 'Non-Farm Payrolls (NFP) & Unemployment',
    impact: 'HIGH',
    forecast: '175K',
    previous: '142K',
    assetAffected: 'All FX & Metals'
  },
  {
    id: 'e4',
    time: '12:00 EST Friday',
    currency: 'CRYPTO',
    event: 'Derivatives Options Expiry ($6.2B BTC/ETH)',
    impact: 'HIGH',
    forecast: 'Max Pain $94,500',
    previous: 'N/A',
    assetAffected: 'BTC / ETH / SOL'
  }
];

export const EconomicCalendar: React.FC = () => {
  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-100">
      
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100">High-Impact Macro Calendar</h3>
            <p className="text-[10px] text-slate-400">Fed Meetings, NFP & Gold Market Drivers</p>
          </div>
        </div>
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> VOLATILITY ALERT
        </Badge>
      </div>

      <div className="space-y-2.5 font-mono text-xs">
        {UPCOMING_EVENTS.map((ev) => (
          <div key={ev.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2">
            
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-slate-900 text-slate-300 font-bold text-[10px]">
                {ev.currency}
              </span>
              <div>
                <span className="font-bold text-slate-100 block font-sans">{ev.event}</span>
                <span className="text-[10px] text-slate-400 font-sans flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-slate-500" /> {ev.time}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">AFFECTS</span>
                <span className="text-amber-400 font-bold">{ev.assetAffected}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-sans block">FORECAST / PREV</span>
                <span className="text-slate-300 font-bold">{ev.forecast} ({ev.previous})</span>
              </div>

              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[9px]">
                {ev.impact}
              </Badge>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};