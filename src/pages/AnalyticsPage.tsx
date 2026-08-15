import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { StrategyBacktest } from '@/components/trading/StrategyBacktest';
import { EconomicCalendar } from '@/components/trading/EconomicCalendar';
import { GrokMarketBot } from '@/components/analytics/GrokMarketBot';
import { HyperliquidWhaleTracker } from '@/components/analytics/HyperliquidWhaleTracker'; // New component
import { MobileNav } from '@/components/layout/MobileNav';
import { Award, Zap, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const AnalyticsPage: React.FC = () => {
  const { isVipMember } = useAuth();

  if (!isVipMember) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
        <TickerTape />
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <UpgradeBanner />
          <div className="flex items-center justify-center py-20">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold mb-2">
              <Lock className="h-3.5 w-3.5 mr-1" /> VIP ACCESS REQUIRED
            </Badge>
            <h2 className="text-2xl font-black text-slate-100">Grok AI Intelligence & Quantitative Backtests</h2>
            <p className="text-sm text-slate-400 mt-1">
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-8">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold mb-2">
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

        {/* Hyperliquid Whale Tracker (VIP-only) */}
        <div className="mt-8">
          <HyperliquidWhaleTracker />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default AnalyticsPage;