import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  TrendingUp, 
  LineChart, 
  Scan, 
  Newspaper, 
  Instagram,
  Lock,
  Sparkles,
  Settings,
  Video
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const MobileNav: React.FC = () => {
  const location = useLocation();
  const { instagramUrl } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-3 py-3 flex items-center justify-around shadow-2xl">

      <Link to="/" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/') ? 'text-emerald-600' : 'text-slate-500'}`}>
        <TrendingUp className="h-5 w-5" />
        Home
      </Link>

      <Link to="/signals" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/signals') ? 'text-cyan-600' : 'text-slate-500'}`}>
        <Sparkles className="h-5 w-5" />
        Signals
      </Link>

      <Link to="/charts" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/charts') ? 'text-indigo-600' : 'text-slate-500'}`}>
        <LineChart className="h-5 w-5" />
        Terminal
      </Link>

      <Link to="/scanner" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/scanner') ? 'text-amber-600' : 'text-slate-500'}`}>
        <Scan className="h-5 w-5" />
        Scanner
      </Link>

      <Link to="/analysis-video" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/analysis-video') ? 'text-rose-600' : 'text-slate-500'}`}>
        <Video className="h-5 w-5" />
        Video
      </Link>

      <Link to="/bot-settings" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${isActive('/bot-settings') ? 'text-indigo-600' : 'text-slate-500'}`}>
        <Settings className="h-5 w-5" />
        Bots
      </Link>
    </div>
  );
};

export { MobileNav };