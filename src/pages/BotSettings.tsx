import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
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
  Settings,
  Menu,
  TrendingUp,
  Sparkles,
  LineChart,
  Scan
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const BotSettings: React.FC = () => {
  const { user, updateTelegramConfig, isVipMember, logout } = useAuth();
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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
        .single();

      if (error && error.code !== 'PGRST116') {
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
      // Update bot token and chat ID
      const { error: upsertError } = await supabase
        .from('telegram_configs')
        .upsert(
          { user_id: user.id, bot_token: botToken, chat_id: chatId },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        throw upsertError;
      }

      // Update auto-scan enabled
      const { error: updateError } = await supabase
        .from('telegram_configs')
        .update({ auto_scan_enabled: autoScanEnabled })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Bot configuration saved successfully!');
    } catch (err) {
      console.error('Error saving bot configuration:', err);
      toast.error('Failed to save bot configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!isVipMember) {
    return (
      <>
        {!user ? (
          <div className="p-4 bg-slate-900 border-b border-slate-800 text-center">
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
              Login to access bot settings
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
            <span className="text-slate-400">{user.email}</span>
            <Button onClick={logout} variant="ghost" size="icon" title="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
        <VIPGateModal 
          title="Bot Settings Locked" 
          description="Upgrade to VIP to manage your Telegram bot configurations, enable/disable auto-scan, and customize your trading signals."
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <span className="text-slate-400">{user.email}</span>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <Link to="/" className="flex items-center w-full px-2 py-2 text-slate-800 hover:bg-slate-100">
                  <TrendingUp className="mr-2 h-4 w-4" /> Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/signals" className="flex items-center w-full px-2 py-2 text-slate-800 hover:bg-slate-100">
                  <Sparkles className="mr-2 h-4 w-4" /> Signals
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/charts" className="flex items-center w-full px-2 py-2 text-slate-800 hover:bg-slate-100">
                  <LineChart className="mr-2 h-4 w-4" /> Terminal
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/scanner" className="flex items-center w-full px-2 py-2 text-slate-800 hover:bg-slate-100">
                  <Scan className="mr-2 h-4 w-4" /> Scanner
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/bot-settings" className="flex items-center w-full px-2 py-2 text-slate-800 hover:bg-slate-100 font-bold">
                  <Settings className="mr-2 h-4 w-4" /> Bots
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="border-t">
                <Button onClick={logout} variant="ghost" size="icon" className="w-full justify-start px-2 py-2 text-slate-400">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-3 text-indigo-400">
            <Settings className="h-6 w-6" />
            My Bot Settings
          </CardTitle>
          <Badge variant="outline" className="text-slate-400 border-slate-800 text-[10px]">
            VIP Exclusive
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">Telegram Bot Token</label>
              <Input
                type="password"
                placeholder="123456789:ABCdefGHI..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">Telegram Chat / Channel ID</label>
              <Input
                type="text"
                placeholder="-100123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={autoScanEnabled}
                onChange={(e) => setAutoScanEnabled(e.target.checked)}
                className="h-5 w-5 text-indigo-600 bg-slate-950 border-slate-800 rounded"
                disabled={loading}
              />
              <span className="ml-2.5 text-slate-100 text-xs">
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
          </form>
        </CardContent>
      </div>

      {/* Current Status */}
      <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="font-bold text-lg text-slate-100 mb-4">Current Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span>Bot Token:</span>
            <span className="font-mono">{botToken ? botToken.substring(0, 10) + '...' : 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Chat ID:</span>
            <span className="font-mono">{chatId ? chatId : 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Auto Scan:</span>
            <span className={autoScanEnabled ? 'text-emerald-400' : 'text-slate-400'}>
              {autoScanEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="font-bold text-lg text-slate-100 mb-4">How to Get Your Telegram Bot Token and Chat ID</h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-400">
          <li>Talk to @BotFather on Telegram to create a new bot and get your token</li>
          <li>Start a chat with your bot and send any message</li>
          <li>Get your chat ID by visiting: {'https://api.telegram.org/bot<your_token>/getUpdates'}</li>
          <li>Look for {'"chat":{"id":<your_chat_id>}'} in the response</li>
        </ol>
        <p className="mt-3 text-slate-400">
          <strong>Note:</strong> Your bot must be started (send /start to it) before it can receive messages.
        </p>
      </div>
    </>
  );
};

export default BotSettings;