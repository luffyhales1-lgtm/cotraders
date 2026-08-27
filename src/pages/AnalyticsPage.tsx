import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { StrategyBacktest } from '@/components/trading/StrategyBacktest';
import { EconomicCalendar } from '@/components/trading/EconomicCalendar';
import { GrokMarketBot } from '@/components/analytics/GrokMarketBot';
import { WhaleTracker } from '@/components/analytics/WhaleTracker';
import { MobileNav } from '@/components/layout/MobileNav';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { Zap, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const AnalyticsPage: React.FC = () => {
  const { isVipMember } = useAuth();

  if (!isVipMember) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
        <AmbientBackground />
        <TickerTape />
        <Navbar />
        <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <UpgradeBanner />
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold mb-2">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> VIP ACCESS REQUIRED
            </Badge>
            <h2 className="text-2xl font-black text-slate-900">Grok AI Intelligence & Quantitative Backtests</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Upgrade to VIP to access Grok AI market statements, quantitative backtests, and advanced analytics.
            </p>
            <Button onClick={() => window.location.href = '/pricing'} className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8">
              Upgrade to VIP
            </Button>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-8 animate-fade-up">
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-bold mb-2">
            <Zap className="h-3.5 w-3.5 mr-1" /> BINANCE FUTURES & GROK AI ANALYTICS
          </Badge>
          <h1 className="text-3xl font-black text-slate-900 text-shimmer">Grok AI Intelligence & Quantitative Backtests</h1>
          <p className="text-sm text-slate-500 mt-1">Backtested win rates, Grok AI market statements, and non-repetitive hourly Telegram reports.</p>
        </div>

        {/* Grok AI Quantitative Scanner Agent */}
        <GrokMarketBot />

        <div className="grid grid-cols-1 gap-8 mt-8">
          <StrategyBacktest />
          <EconomicCalendar />
        </div>

        {/* Whale Tracker — free Hyperliquid live feed (VIP-only) */}
        <div className="mt-8">
          <WhaleTracker />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default AnalyticsPage;
