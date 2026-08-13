import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Crown, Sparkles, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const UpgradeBanner: React.FC = () => {
  const { user, instagramUrl, vipMonthlyPrice, vipYearlyPrice } = useAuth();

  if (user?.tier !== 'free') return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-purple-950/80 to-slate-900 border-y border-amber-500/40 px-4 py-3 shadow-lg my-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-amber-400 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm">FREE TRIAL MODE - RESTRICTED ACCESS</span>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">
                <ShieldAlert className="h-3 w-3 mr-1" /> VIP REQUIRED FOR 5MIN AI SIGNALS
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Unlock 1000+ Binance Live Scanners, Gold Precision Signals, SMC Order Blocks & Pro Terminal Execution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden xl:block">
            <div className="text-xs font-extrabold text-amber-400">VIP Monthly: ${vipMonthlyPrice} | Yearly: ${vipYearlyPrice}</div>
            <div className="text-[10px] text-slate-400">Instant Access Verification via DM</div>
          </div>

          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs gap-1.5 shadow-md shadow-amber-500/20">
              <Sparkles className="h-4 w-4" />
              Subscribe on Instagram
              <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </a>
        </div>

      </div>
    </div>
  );
};