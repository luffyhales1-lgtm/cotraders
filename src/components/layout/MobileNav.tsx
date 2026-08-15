import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  TrendingUp, 
  LineChart, 
  Scan, 
  Newspaper, 
  Instagram
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Lock from 'lucide-react/dist/esm/icons/lock';

export const MobileNav: React.FC = () => {
  const location = useLocation();
  const { instagramUrl } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-3 py-3 flex items-center justify-around shadow-2xl">
      
      <Link to="/" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/') ? 'text-emerald-400' : 'text-slate-400'}`}>
        <TrendingUp className="h-5 w-5" />
        Home
      </Link>

      <Link to="/signals" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/signals') ? 'text-cyan-400' : 'text-slate-400'}`}>
        <Sparkles className="h-5 w-5" />
        Signals
      </Link>

      <Link to="/charts" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/charts') ? 'text-indigo-400' : 'text-slate-400'}`}>
        <LineChart className="h-5 w-5" />
        Terminal
      </Link>

      <Link to="/scanner" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/scanner') ? 'text-amber-400' : 'text-slate-400'}`}>
        <Scan className="h-5 w-5" />
        Scanner
      </Link>

      <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 text-[10px] font-extrabold text-pink-400">
        <Instagram className="h-5 w-5" />
        Buy VIP
      </a>
    </div>
  );
};