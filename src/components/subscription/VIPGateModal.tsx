import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, Crown, Sparkles, Instagram, LogIn, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface VIPGateModalProps {
  title?: string;
  description?: string;
}

export const VIPGateModal: React.FC<VIPGateModalProps> = ({
  title = 'VIP Subscription Required',
  description = 'Unlock 1,000+ Binance Live Scanners, 5-minute AI Strategy Signals, Gold SMC Order Blocks & Real-Time Telegram Broadcasts.'
}) => {
  const { instagramUrl, vipMonthlyPrice, vipYearlyPrice } = useAuth();

  return (
    <div className="relative my-8 p-8 md:p-12 rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border border-amber-500/40 text-center shadow-2xl overflow-hidden backdrop-blur-xl max-w-3xl mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400/50" />

      <div className="h-16 w-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/10">
        <Crown className="h-8 w-8 text-amber-400 animate-pulse" />
      </div>

      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-xs px-3 py-1 mb-3">
        INSTITUTIONAL TERMINAL LOCKED
      </Badge>

      <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">{title}</h2>
      <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto leading-relaxed">{description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6 max-w-md mx-auto text-xs font-mono">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-amber-400 font-bold block">VIP Monthly</span>
          <span className="text-slate-100 font-black text-base">${vipMonthlyPrice} / Mo</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-purple-400 font-bold block">VIP Yearly</span>
          <span className="text-slate-100 font-black text-base">${vipYearlyPrice} / Yr</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs py-5 px-6 shadow-xl shadow-amber-500/20 gap-2">
            <Instagram className="h-4 w-4" /> Subscribe via Instagram DM
          </Button>
        </a>

        <Link to="/login" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 font-bold text-xs py-5 px-6 gap-2">
            <LogIn className="h-4 w-4 text-emerald-400" /> Log In Account
          </Button>
        </Link>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400">
        Direct activation assistance by Admin Kaif (@abdul_kaif12)
      </div>
    </div>
  );
};