import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { 
  UserPlus, 
  Users, 
  ShieldCheck, 
  Send, 
  Instagram, 
  LogIn, 
  ArrowRight,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminPage: React.FC = () => {
  const {
    user,
    allUsers,
    updateUserSubscription,
    instagramUrl,
    vipMonthlyPrice,
    vipYearlyPrice,
    telegramBotToken,
    telegramChatId,
    updateTelegramConfig,
    dispatchTelegramSignal
  } = useAuth();
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      fetchUserTelegramConfig();
    }
  }, [user]);

  const fetchUserTelegramConfig = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('telegram_configs')
          .select('bot_token, chat_id, auto_scan_enabled')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching telegram config:', error);
          return;
        }

        if (data) {
          setAutoScanEnabled(data.auto_scan_enabled ?? false);
        } else {
          setAutoScanEnabled(false);
        }
      } catch (err) {
        console.error('Error fetching telegram config:', err);
      }
    };

  const handleAutoScanToggle = async (enabled: boolean) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from('telegram_configs')
          .update({ auto_scan_enabled: enabled })
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        toast.success('Auto-scan setting updated');
      } catch (err) {
        console.error('Error updating auto-scan setting:', err);
        toast.error('Failed to update auto-scan setting');
      }
    };

  const [targetEmail, setTargetEmail] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<'vip_monthly' | 'vip_yearly' | 'free'>('vip_monthly');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [tokenInput, setTokenInput] = useState<string>(telegramBotToken);
  const [chatIdInput, setChatIdInput] = useState<string>(telegramChatId);

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <Navbar />
        <main className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <div className="h-16 w-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-6">
            {/* Replaced Lock icon with text to avoid Illegal constructor error */}
            <span className="h-9 w-9 text-rose-400">LOCK</span>
          </div>
          <h2 className="text-2xl font-black text-slate-100">Restricted Admin Access</h2>
          <p className="text-xs text-slate-400 mt-2">
            Admin access is reserved for <span className="text-amber-400 font-mono font-bold">luffyhales1@gmail.com</span>.
          </p>
          <Button onClick={() => window.location.href = '/login'} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-4 px-8 transition-all duration-300">
            Log In as Admin
          </Button>
        </main>
      </div>
    );
  }

  const handleGrantAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail) {
      toast.error('Please enter a user email address');
      return;
    }

    updateUserSubscription(targetEmail, selectedTier, durationDays);
    setTargetEmail('');
  }

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    updateTelegramConfig(tokenInput, chatIdInput);
  }

  const handleTestTelegram = () => {
    dispatchTelegramSignal({
      pair: 'BTC/USDT',
      type: 'LONG',
      strategy: 'SMC Order Block',
      timeframe: '15m',
      entryPrice: 96420,
      target1: 98340,
      target2: 100800,
      target3: 104200,
      stopLoss: 95100,
      leverage: '20x',
      winProbability: 92,
      riskReward: '1:3.4',
      rationale: 'Test Signal dispatch from Master Admin Control Panel.',
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Admin Header */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/40 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono font-bold">
                <ShieldCheck className="h-4 w-4 mr-1.5" /> MASTER ADMIN CONTROL PANEL
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono text-[11px]">
                {user.email}
              </Badge>
            </div>
            <h1 className="text-3.5xl font-black text-slate-100 mt-3">Subscription & Telegram Dispatch Manager</h1>
            <p className="text-sm text-slate-400 mt-2">
              Directly manage user VIP access ($29.90 / $99.90) and configure real-time Telegram signal broadcasting.
            </p>
          </div>

          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs gap-1.5 py-3 px-6 transition-all duration-300">
              <Instagram className="h-5 w-5" /> Admin Instagram
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Grant VIP Access */}
          <div className="space-y-8">
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-3 text-amber-400">
                  <UserPlus className="h-6 w-6" />
                  Grant VIP Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGrantAccess} className="space-y-6">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">User Email</label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">Subscription Tier</label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value as 'vip_monthly' | 'vip_yearly' | 'free')}
                      className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-bold"
                    >
                      <option value="vip_monthly">VIP Monthly ($29.90 / 30 Days)</option>
                      <option value="vip_yearly">VIP Yearly ($99.90 / 365 Days)</option>
                      <option value="free">Downgrade to Free</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">Duration (Days)</label>
                    <Input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-6 px-8">
                    Update User Subscription
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Telegram Bot Integration Box */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-3 text-indigo-400">
                  <Send className="h-6 w-6" />
                  Telegram Bot Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTelegram} className="space-y-6">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">Bot Token</label>
                    <Input
                      type="password"
                      placeholder="123456789:ABCdefGHI..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">Telegram Chat / Channel ID</label>
                    <Input
                      type="text"
                      placeholder="-100123456789"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-2">
                      Enable Auto Scan
                    </label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={autoScanEnabled}
                        onChange={(e) => handleAutoScanToggle(e.target.checked)}
                        className="h-5 w-5 text-indigo-600 bg-slate-950 border-slate-800 rounded"
                      />
                      <span className="ml-2.5 text-slate-100 text-xs">
                        Automatically scan for trade signals and send to Telegram
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-5 px-6">
                      Save Telegram Config
                    </Button>
                    <Button type="button" onClick={handleTestTelegram} variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs font-bold py-5 px-6">
                      Test Signal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* User Database Table */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center justify-between text-slate-100">
                  <span className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-indigo-400" />
                    Registered Users ({allUsers.length})
                  </span>
                  <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                    Active VIP Users: {allUsers.filter(u => u.tier !== 'free').length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                      <tr>
                        <th className="p-4 font-bold">USER</th>
                        <th className="p-4 font-bold">TIER</th>
                        <th className="p-4 font-bold">EXPIRES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {allUsers.map((u) => {
                        const isVip = u.tier !== 'free';
                        const expiresDate = u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString() : 'N/A';
                        return (
                          <tr key={u.email} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                              <span className="font-bold text-slate-100 block">{u.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                            </td>
                            <td className="p-4">
                              {isVip ? (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                                  <Crown className="h-4 w-4 mr-1.5" /> {u.tier.toUpperCase()}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">FREE</Badge>
                              )}
                            </td>
                            <td className="p-4 text-slate-300">{expiresDate}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;