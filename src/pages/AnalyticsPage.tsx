import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { StrategyBacktest } from '@/components/trading/StrategyBacktest';
import { EconomicCalendar } from '@/components/trading/EconomicCalendar';
import { GrokMarketBot } from '@/components/analytics/GrokMarketBot';
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
            <Zap className="h-3.5 w-3.5 mr-1" /> BINANCE FUTURES & GROK AI ANALYTICS
          </Badge>
          <h1 className="text-3xl font-black text-slate-100">Grok AI Intelligence & Quantitative Backtests</h1>
          <p className="text-sm text-slate-400 mt-1">Backtested win rates, Grok AI market statements, and non-repetitive hourly Telegram reports.</p>
        </div>

        {/* Grok AI Quantitative Scanner Agent */}
        <GrokMarketBot />

        <div className="grid grid-cols-1 gap-8 mt-8">
          <StrategyBacktest />
          <EconomicCalendar />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default AnalyticsPage;