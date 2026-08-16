import { useState, useRef, useEffect } from 'react';
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
  Newspaper,
  Settings,
  Menu,
  X,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  vipOnly?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: TrendingUp, iconColor: 'text-emerald-400' },
  { path: '/signals', label: 'AI Signals', icon: Sparkles, iconColor: 'text-cyan-400', vipOnly: true },
  { path: '/charts', label: 'Pro Charts', icon: LineChart, iconColor: 'text-indigo-400', vipOnly: true },
  { path: '/scanner', label: '1000+ Scanner', icon: Scan, iconColor: 'text-amber-400', vipOnly: true },
  { path: '/news', label: 'News', icon: Newspaper, iconColor: 'text-sky-400' },
  { path: '/analytics', label: 'Analytics', icon: Award, iconColor: 'text-purple-400' },
  { path: '/bot-settings', label: 'Bot Settings', icon: Settings, iconColor: 'text-teal-400', vipOnly: true },
  { path: '/pricing', label: 'VIP Plans', icon: Crown, iconColor: 'text-amber-400' },
];

export const Navbar: React.FC = () => {
  const { user, logout, instagramUrl, isVipMember } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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

        {/* Menu Button + Dropdown */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="gap-2 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800 transition-all duration-300"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu
          </Button>

          {menuOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl shadow-black/40 overflow-hidden z-50">
              <div className="py-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const locked = item.vipOnly && !isVipMember;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}>
                      <div
                        className={`flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors duration-150 ${
                          isActive(item.path)
                            ? 'bg-slate-800 text-slate-100'
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={`h-4.5 w-4.5 ${item.iconColor}`} />
                          {item.label}
                        </span>
                        {locked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                      </div>
                    </Link>
                  );
                })}

                {user?.isAdmin && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)}>
                    <div
                      className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold border-t border-slate-800 mt-1 pt-3 transition-colors duration-150 ${
                        isActive('/admin')
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'text-amber-400 hover:bg-amber-500/10'
                      }`}
                    >
                      <ShieldCheck className="h-4.5 w-4.5" />
                      Admin Panel
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-4">
          
          {!isVipMember && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="hidden sm:flex gap-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs hover:opacity-95 shadow-md shadow-amber-500/20 transition-all duration-300">
                <Crown className="h-5 w-5" />
                Subscribe VIP Access
              </Button>
            </a>
          )}

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