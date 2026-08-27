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
    <div className="relative my-10 p-10 md:p-14 rounded-2xl bg-gradient-to-b from-amber-50 via-white to-white border border-amber-300 text-center shadow-2xl overflow-hidden backdrop-blur-xl max-w-2xl mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400/50" />

      <div className="h-20 w-20 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-200">
        <Crown className="h-11 w-11 text-amber-600 animate-pulse" />
      </div>

      <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-mono text-xs px-4 py-2 mb-4">
        INSTITUTIONAL TERMINAL LOCKED
      </Badge>

      <h2 className="text-2.5xl md:text-3.5xl font-black text-slate-900 tracking-tight">{title}</h2>
      <p className="text-sm text-slate-600 mt-3 max-w-xl mx-auto leading-relaxed">{description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8 max-w-md mx-auto text-xs font-mono">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-amber-600 font-bold block">VIP Monthly</span>
          <span className="text-slate-900 font-black text-base">${vipMonthlyPrice} / Mo</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-indigo-600 font-bold block">VIP Yearly</span>
          <span className="text-slate-900 font-black text-base">${vipYearlyPrice} / Yr</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs py-6 px-8 shadow-xl shadow-amber-500/20 transition-all duration-300">
            <Instagram className="h-5 w-5" /> Subscribe via Instagram DM
          </Button>
        </a>

        <Link to="/login" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs py-6 px-8 gap-3">
            <LogIn className="h-5 w-5 text-emerald-600" /> Log In Account
          </Button>
        </Link>
      </div>

      <div className="mt-8 pt-5 border-t border-slate-200 text-[12px] text-slate-500">
        Direct activation assistance by Admin Kaif (@abdul_kaif12)
      </div>
    </div>
  );
};