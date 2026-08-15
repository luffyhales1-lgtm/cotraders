import { useAuth } from '@/context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  TrendingUp, 
  Sparkles, 
  LineChart, 
  Scan, 
  Crown, 
  Award, 
  ShieldCheck, 
  Radio, 
  LogIn, 
  LogOut,
  UserPlus, 
  Users, 
  Send, 
  Instagram, 
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Navbar: React.FC = () => {
  const { user, logout, instagramUrl, isVipMember } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-[10px] border-b border-slate-800/90 px-4 lg:px-8 py-3 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
            <Activity className="h-6 w-6 text-slate-950 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg text-slate-100 tracking-tight">COTRADERS</span>
              <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AI PRO</span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wider uppercase font-bold flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              1-Min Auto-Scan & Telegram Active
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-3">
          <Link to="/">
            <Button 
              variant={isActive('/') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2.5 text-xs font-bold ${isActive('/') ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Dashboard
            </Button>
          </Link>

          <Link to="/signals">
            <Button 
              variant={isActive('/signals') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2 text-xs font-bold ${isActive('/signals') ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <Sparkles className="h-5 w-5 text-cyan-400" />
              AI Signals
              {!isVipMember && <span className="h-3.5 w-3.5 text-amber-400 ml-0.5">LOCK</span>}
            </Button>
          </Link>

          <Link to="/charts">
            <Button 
              variant={isActive('/charts') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2 text-xs font-bold ${isActive('/charts') ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <LineChart className="h-5 w-5 text-indigo-400" />
              Pro Charts
              {!isVipMember && <span className="h-3.5 w-3.5 text-amber-400 ml-0.5">LOCK</span>}
            </Button>
          </Link>

          <Link to="/scanner">
            <Button 
              variant={isActive('/scanner') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2 text-xs font-bold ${isActive('/scanner') ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <Scan className="h-5 w-5 text-amber-400" />
              1000+ Scanner
              {!isVipMember && <span className="h-3.5 w-3.5 text-amber-400 ml-0.5">LOCK</span>}
            </Button>
          </Link>

          <Link to="/pricing">
            <Button 
              variant={isActive('/pricing') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2.5 text-xs font-bold ${isActive('/pricing') ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <Crown className="h-5 w-5 text-amber-400" />
              VIP Plans
            </Button>
          </Link>

          <Link to="/analytics">
            <Button 
              variant={isActive('/analytics') ? 'secondary' : 'ghost'} 
              size="sm"
              className={`gap-2 text-xs font-bold ${isActive('/analytics') ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'}`}
            >
              <Award className="h-5 w-5 text-purple-400" />
              Analytics
            </Button>
          </Link>

          {user?.isAdmin && (
            <Link to="/admin">
              <Button 
                variant={isActive('/admin') ? 'secondary' : 'outline'} 
                size="sm"
                className="gap-2.5 text-xs font-bold border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              >
                <ShieldCheck className="h-5 w-5" />
                Admin Panel
              </Button>
            </Link>
          )}
        </nav>

        {/* Right Action */}
        <div className="flex items-center gap-4">
          
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="hidden sm:flex gap-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs hover:opacity-95 shadow-md shadow-amber-500/20 transition-all duration-300">
              <Crown className="h-5 w-5" />
              Subscribe VIP Access
            </Button>
          </a>

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs font-bold text-slate-200">{user.name}</span>
                  {user.tier !== 'free' ? (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] gap-1.5 px-2 py-0.5 font-extrabold">
                      <Crown className="h-4 w-4 text-amber-400" /> VIP
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">FREE</Badge>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">{user.email}</p>
              </div>

              <Button variant="ghost" size="icon" onClick={logout} title="Logout" className="text-slate-400 hover:text-rose-400 hover:bg-slate-900/20 transition-all duration-200">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="outline" className="gap-2.5 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800 transition-all duration-300">
                <LogIn className="h-5 w-5 text-emerald-400" />
                Log In
              </Button>
            </Link>
          )}

        </div>
      </div>
    </header>
  );
};

export default Navbar;