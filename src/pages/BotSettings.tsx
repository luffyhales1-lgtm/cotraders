import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
import { MobileNav } from '@/components/layout/MobileNav';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import {
  UserPlus,
  Users,
  ShieldCheck,
  Send,
  Instagram,
  LogIn,
  ArrowRight,
  Crown,
  LogOut,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { testTelegramConnection } from '@/services/telegramService';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const BotSettings: React.FC = () => {
  const { user, updateTelegramConfig, isVipMember, logout } = useAuth();
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testTelegramConnection(botToken.trim(), chatId.trim());
    setTestResult({ ok: res.success, msg: res.message });
    if (res.success) toast.success(res.message);
    else toast.error(res.message);
    setTesting(false);
  };

  useEffect(() => {
    if (!user || !isVipMember) return;
    fetchUserTelegramConfig();
  }, [user, isVipMember]);

  const fetchUserTelegramConfig = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('telegram_configs')
        .select('bot_token, chat_id, auto_scan_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching telegram config:', error);
        toast.error('Failed to load your bot configuration');
        return;
      }

      if (data) {
        setBotToken(data.bot_token || '');
        setChatId(data.chat_id || '');
        setAutoScanEnabled(data.auto_scan_enabled ?? false);
      } else {
        // No config found, set to empty strings and false
        setBotToken('');
        setChatId('');
        setAutoScanEnabled(false);
      }
    } catch (err) {
      console.error('Error fetching telegram config:', err);
      toast.error('Failed to load your bot configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Save through AuthContext so the rest of the app (Force Scan, Signals,
      // Dispatch, etc.) immediately sees the updated token/chat ID too —
      // no logout/login needed.
      await updateTelegramConfig(botToken, chatId);

      // Auto-scan flag isn't tracked in context, so update it directly
      const { error: updateError } = await supabase
        .from('telegram_configs')
        .update({ auto_scan_enabled: autoScanEnabled })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (err) {
      console.error('Error saving bot configuration:', err);
      toast.error('Failed to save bot configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!isVipMember) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
        <AmbientBackground />
        <TickerTape />
        <Navbar />
        <main className="relative z-10 max-w-3xl mx-auto px-4 lg:px-8 py-8">
          {!user ? (
            <div className="p-4 mb-6 rounded-2xl glass-panel text-center">
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Login to access bot settings
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 mb-6 rounded-2xl glass-panel">
              <span className="text-slate-500">{user.email}</span>
              <Button onClick={logout} variant="ghost" size="icon" title="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
          <VIPGateModal
            title="Bot Settings Locked"
            description="Upgrade to VIP to manage your Telegram bot configurations, enable/disable auto-scan, and customize your trading signals."
          />
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />
      <main className="relative z-10 max-w-3xl mx-auto px-4 lg:px-8 py-8">
      <div className="flex items-center justify-between p-4 mb-6 rounded-2xl glass-panel">
        <span className="text-slate-500">{user.email}</span>
        <Button onClick={logout} variant="ghost" size="icon" title="Logout">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-6 rounded-2xl glass-panel">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-3 text-indigo-600">
            <Settings className="h-6 w-6" />
            My Bot Settings
          </CardTitle>
          <Badge variant="outline" className="text-slate-500 border-slate-200 text-[10px]">
            VIP Exclusive
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-2">Telegram Bot Token</label>
              <Input
                type="password"
                placeholder="123456789:ABCdefGHI..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 text-xs font-mono"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-2">Telegram Chat / Channel ID</label>
              <Input
                type="text"
                placeholder="-100123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 text-xs font-mono"
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={autoScanEnabled}
                onChange={(e) => setAutoScanEnabled(e.target.checked)}
                className="h-5 w-5 text-indigo-600 bg-white border-slate-300 rounded"
                disabled={loading}
              />
              <span className="ml-2.5 text-slate-700 text-xs">
                Enable Auto Scan (Receive automated trading signals)
              </span>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-5 px-8"
            >
              {loading ? 'Saving...' : 'Save Bot Configuration'}
            </Button>

            <Button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !botToken || !chatId}
              variant="outline"
              className="w-full border-cyan-500/50 text-cyan-600 hover:bg-cyan-500/10 font-bold text-xs py-5 px-8 gap-2"
            >
              <Send className="h-4 w-4" />
              {testing ? 'Testing connection…' : 'Test Connection (send test message)'}
            </Button>

            {testResult && (
              <div
                className={`text-xs rounded-xl p-3 border ${
                  testResult.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                }`}
              >
                {testResult.msg}
              </div>
            )}
          </form>
        </CardContent>
      </div>

      {/* Current Status */}
      <div className="mt-6 p-4 rounded-2xl glass-panel">
        <h3 className="font-bold text-lg text-slate-900 mb-4">Current Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-slate-600">
            <span>Bot Token:</span>
            <span className="font-mono">{botToken ? botToken.substring(0, 10) + '...' : 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Chat ID:</span>
            <span className="font-mono">{chatId ? chatId : 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Auto Scan:</span>
            <span className={autoScanEnabled ? 'text-emerald-600' : 'text-slate-500'}>
              {autoScanEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 rounded-2xl glass-panel">
        <h3 className="font-bold text-lg text-slate-900 mb-4">How to Get Your Telegram Bot Token and Chat ID</h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-600">
          <li>Talk to @BotFather on Telegram to create a new bot and get your token</li>
          <li>Start a chat with your bot and send any message</li>
          <li>Get your chat ID by visiting: {'https://api.telegram.org/bot<your_token>/getUpdates'}</li>
          <li>Look for {'"chat":{"id":<your_chat_id>}'} in the response</li>
        </ol>
        <p className="mt-3 text-slate-600">
          <strong>Note:</strong> Your bot must be started (send /start to it) before it can receive messages.
        </p>
      </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default BotSettings;