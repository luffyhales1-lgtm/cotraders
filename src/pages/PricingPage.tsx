import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { MobileNav } from '@/components/layout/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { 
  Crown, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Instagram, 
  Zap, 
  ShieldCheck, 
  HelpCircle,
  MessageCircle,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PricingPage: React.FC = () => {
  const { instagramUrl, vipMonthlyPrice, vipYearlyPrice, isVipMember, user } = useAuth();

  // Active VIP members shouldn't see pricing/subscribe CTAs at all —
  // isVipMember is computed live off subscription_end, so this flips
  // back to false (and this page back to normal) automatically the
  // moment their subscription lapses, no manual admin step needed.
  if (isVipMember && user) {
    const endDate = user.subscriptionEnd ? new Date(user.subscriptionEnd) : null;
    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
        <TickerTape />
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 lg:px-8 py-16">
          <Card className="bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-900 border-amber-500/50 text-slate-100 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black text-center py-1 uppercase tracking-widest">
              Active Subscription
            </div>
            <CardHeader className="text-center">
              <Badge className="w-fit mx-auto bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] mb-2">
                <Crown className="h-3 w-3 mr-1 text-amber-400" /> {user.tier === 'yearly' ? 'YEARLY PRO VIP' : 'MONTHLY VIP'}
              </Badge>
              <CardTitle className="text-3xl font-black">You're all set, {user.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center pb-10">
              <p className="text-sm text-slate-400">
                Your VIP access is active. All 1,000+ pair scanning, AI signals, gold setups, and full news are unlocked.
              </p>
              {endDate && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
                  <CalendarClock className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-300">
                    Renews / expires on <span className="font-bold text-slate-100">{endDate.toLocaleDateString()}</span>
                    {daysLeft !== null && <span className="text-slate-500"> · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>}
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                When your subscription ends, your account automatically reverts to the Free tier — no action needed. You'll see this pricing page again once that happens if you want to renew.
              </p>
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs py-5 gap-2">
                  <Instagram className="h-4 w-4" /> Contact Support / Renew Early
                </Button>
              </a>
            </CardContent>
          </Card>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold mb-3 px-3 py-1">
            <Crown className="h-4 w-4 mr-1 text-amber-400" /> INSTITUTIONAL VIP ACCESS
          </Badge>
          <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight">
            Choose Your Trading Plan
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-3">
            Unlock 1,000+ Binance Live Scanners, 5-minute strategy signals, Gold order block setups, and dedicated support.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          
          {/* Free Plan */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100 relative overflow-hidden flex flex-col justify-between">
            <CardHeader>
              <Badge variant="outline" className="w-fit text-slate-400 border-slate-800 text-[10px] mb-2">FREE TRIAL</Badge>
              <CardTitle className="text-2xl font-black">Free Standard</CardTitle>
              <div className="mt-2 font-mono">
                <span className="text-3xl font-black">$0</span>
                <span className="text-xs text-slate-400"> / forever</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Basic Binance 24h Ticker Tape</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Public News Headlines (2 Items)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Standard Chart Overview</li>
                <li className="flex items-center gap-2 text-slate-500"><XCircle className="h-4 w-4 text-slate-600" /> 5-Min Strategy AI Signals (Locked)</li>
                <li className="flex items-center gap-2 text-slate-500"><XCircle className="h-4 w-4 text-slate-600" /> Gold (XAU/USD) SMC Order Blocks</li>
                <li className="flex items-center gap-2 text-slate-500"><XCircle className="h-4 w-4 text-slate-600" /> 1,000+ Pair Depth Scanner</li>
              </ul>

              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-6 block">
                <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs py-5">
                  Current Free Account
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* VIP Monthly - Featured */}
          <Card className="bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-900 border-amber-500/50 text-slate-100 relative overflow-hidden shadow-2xl scale-105 flex flex-col justify-between">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black text-center py-1 uppercase tracking-widest">
              MOST POPULAR TRADER CHOICE
            </div>
            <CardHeader>
              <Badge className="w-fit bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] mb-2">
                <Crown className="h-3 w-3 mr-1 text-amber-400" /> VIP MONTHLY
              </Badge>
              <CardTitle className="text-2xl font-black">Monthly VIP</CardTitle>
              <div className="mt-2 font-mono">
                <span className="text-4xl font-black text-amber-400">${vipMonthlyPrice}</span>
                <span className="text-xs text-slate-400"> / 30 days</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
              <ul className="space-y-2.5 text-xs text-slate-200 font-medium">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> All 5-Min Strategy AI Signals Unlocked</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Gold (XAU/USD) High-Win SMC Setups</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 1,000+ Binance Live Pairs Depth Scanner</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Pro Dark Chart Execution Terminal</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Full Institutional Intelligence News</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Priority DM Support & Verification</li>
              </ul>

              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-6 block">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs py-5 shadow-lg shadow-amber-500/20 gap-2">
                  <Instagram className="h-4 w-4" /> Subscribe via Instagram DM
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* VIP Yearly */}
          <Card className="bg-slate-900 border-purple-500/40 text-slate-100 relative overflow-hidden flex flex-col justify-between">
            <CardHeader>
              <Badge className="w-fit bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] mb-2">MAX VALUE</Badge>
              <CardTitle className="text-2xl font-black">Yearly Pro VIP</CardTitle>
              <div className="mt-2 font-mono">
                <span className="text-3xl font-black text-purple-400">${vipYearlyPrice}</span>
                <span className="text-xs text-slate-400"> / 365 days</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Full VIP Access for 1 Full Year</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Save over 80% vs Monthly billing</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> All 5-Min Strategy AI Signals</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Priority 1-on-1 Instagram Support</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Custom Pair Request Scanners</li>
              </ul>

              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-6 block">
                <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-5 shadow-lg shadow-purple-900/30 gap-2">
                  <Instagram className="h-4 w-4" /> Get Yearly Access
                </Button>
              </a>
            </CardContent>
          </Card>

        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <h2 className="text-xl font-extrabold text-slate-100 mb-6 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" />
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-slate-200 mb-1">How do I activate my VIP Subscription?</h4>
              <p className="text-slate-400 leading-relaxed">
                Click any Subscribe button to message Admin Abdul Kaif on Instagram (@abdul_kaif12). Send your payment confirmation and account email to receive instant activation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-slate-200 mb-1">How often do AI signals refresh?</h4>
              <p className="text-slate-400 leading-relaxed">
                Our algorithm scans 1,000+ pairs every 5 minutes and computes confluence parameters for SMC, EMA crossovers, and RSI divergence.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-slate-200 mb-1">What happens when my subscription expires?</h4>
              <p className="text-slate-400 leading-relaxed">
                You will receive automated notification reminders 3 days before expiration. If unrenewed, the system automatically reverts your access to the free trial tier.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-slate-200 mb-1">Are Gold (XAU/USD) signals included?</h4>
              <p className="text-slate-400 leading-relaxed">
                Yes! Gold precision signals with TP1/2/3 and Stop Loss levels are fully included in both Monthly and Yearly VIP packages.
              </p>
            </div>
          </div>
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default PricingPage;