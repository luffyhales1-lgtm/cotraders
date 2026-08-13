import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import { SubscriptionTier } from '@/types/trading';
import { 
  ShieldCheck, 
  Users, 
  Crown, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  UserPlus, 
  Calendar,
  Lock,
  Instagram,
  RefreshCw,
  Send,
  Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const [targetEmail, setTargetEmail] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('vip_monthly');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [tokenInput, setTokenInput] = useState<string>(telegramBotToken);
  const [chatIdInput, setChatIdInput] = useState<string>(telegramChatId);

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <Navbar />
        <main className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <div className="h-14 w-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-100">Restricted Admin Access</h2>
          <p className="text-xs text-slate-400 mt-2">
            Admin access is reserved for <span className="text-amber-400 font-mono font-bold">luffyhales1@gmail.com</span>.
          </p>
          <Button onClick={() => window.location.href = '/login'} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 font-bold">
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
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    updateTelegramConfig(tokenInput, chatIdInput);
  };

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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        {/* Admin Header */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono font-bold">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> MASTER ADMIN CONTROL PANEL
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono text-[11px]">
                {user.email}
              </Badge>
            </div>
            <h1 className="text-3xl font-black text-slate-100 mt-2">Subscription & Telegram Dispatch Manager</h1>
            <p className="text-xs text-slate-400 mt-1">
              Directly manage user VIP access ($49.90 / $99.90) and configure real-time Telegram signal broadcasting.
            </p>
          </div>

          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs gap-1.5">
              <Instagram className="h-4 w-4" /> Admin Instagram
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-6">
            {/* Grant VIP Access */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
                  <UserPlus className="h-5 w-5" />
                  Grant VIP Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGrantAccess} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">User Email</label>
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
                    <label className="text-xs text-slate-400 font-bold block mb-1">Subscription Tier</label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value as SubscriptionTier)}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-bold"
                    >
                      <option value="vip_monthly">VIP Monthly ($49.90 / 30 Days)</option>
                      <option value="vip_yearly">VIP Yearly ($99.90 / 365 Days)</option>
                      <option value="free">Downgrade to Free</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">Duration (Days)</label>
                    <Input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-5">
                    Update User Subscription
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Telegram Bot Integration Box */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-400">
                  <Send className="h-5 w-5" />
                  Telegram Bot Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTelegram} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">Bot Token</label>
                    <Input
                      type="password"
                      placeholder="123456789:ABCdefGHI..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">Telegram Chat / Channel ID</label>
                    <Input
                      type="text"
                      placeholder="-100123456789"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-4">
                      Save Telegram Config
                    </Button>
                    <Button type="button" onClick={handleTestTelegram} variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs font-bold py-4">
                      Test Signal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* User Database Table */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center justify-between text-slate-100">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-400" />
                    Registered Users ({allUsers.length})
                  </span>
                  <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                    Auto VIP Expiry Engine
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                      <tr>
                        <th className="p-3 font-bold">USER</th>
                        <th className="p-3 font-bold">TIER</th>
                        <th className="p-3 font-bold">EXPIRES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {allUsers.map((u) => {
                        const isVip = u.tier !== 'free';
                        const expiresDate = u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString() : 'N/A';
                        return (
                          <tr key={u.email} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3">
                              <span className="font-bold text-slate-100 block">{u.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                            </td>
                            <td className="p-3">
                              {isVip ? (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                                  <Crown className="h-3 w-3 mr-1" /> {u.tier.toUpperCase()}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">FREE</Badge>
                              )}
                            </td>
                            <td className="p-3 text-slate-300">{expiresDate}</td>
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