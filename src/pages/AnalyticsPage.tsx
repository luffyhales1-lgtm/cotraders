import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { StrategyBacktest } from '@/components/trading/StrategyBacktest';
import { EconomicCalendar } from '@/components/trading/EconomicCalendar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Award, Zap, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AnalyticsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-8">
          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/40 font-bold mb-2">
            <Zap className="h-3.5 w-3.5 mr-1" /> INSTITUTIONAL QUANT ANALYTICS
          </Badge>
          <h1 className="text-3xl font-black text-slate-100">AI Strategy Performance & Macro Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Backtested win rates, risk ratios, and economic event triggers.</p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <StrategyBacktest />
          <EconomicCalendar />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default AnalyticsPage;