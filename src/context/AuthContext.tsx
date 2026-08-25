import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, SubscriptionTier } from '@/types/trading';
import { sendTelegramSignalNotification, TelegramSignalPayload } from '@/services/telegramService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  signUp: (email: string, pass: string, name: string) => Promise<boolean>;
  logout: () => void;
  updateUserSubscription: (email: string, tier: SubscriptionTier, durationDays: number) => Promise<void>;
  allUsers: UserProfile[];
  instagramUrl: string;
  vipMonthlyPrice: number;
  vipYearlyPrice: number;
  telegramBotToken: string;
  telegramChatId: string;
  updateTelegramConfig: (token: string, chatId: string) => void;
  dispatchTelegramSignal: (signal: TelegramSignalPayload) => Promise<boolean>;
  isVipMember: boolean;
}

const INSTAGRAM_URL = 'https://www.instagram.com/abdul_kaif12';
const VIP_MONTHLY_PRICE = 29.90;
const VIP_YEARLY_PRICE = 99.90;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// VIP status is computed live from the expiry date, never trusted as a stored flag.
function computeIsVip(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.tier === 'free') return false;
  if (!profile.subscriptionEnd) return true;
  return new Date(profile.subscriptionEnd).getTime() > Date.now();
}

function mapRowToProfile(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email?.split('@')[0] ?? 'User',
    tier: row.tier,
    isAdmin: row.is_admin,
    subscriptionStart: row.subscription_start ?? undefined,
    subscriptionEnd: row.subscription_end ?? undefined,
    isExpired: row.is_expired ?? false,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data ? mapRowToProfile(data) : null;
  }, []);

  // Restore session on load, and stay in sync with auth state changes
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const fetchTelegramConfig = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('telegram_configs')
        .select('bot_token, chat_id, auto_scan_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching telegram config:', error);
        return;
      }

      setTelegramBotToken(data?.bot_token || '');
      setTelegramChatId(data?.chat_id || '');
    } catch (err) {
      console.error('Error fetching telegram config:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTelegramConfig();
    } else {
      setTelegramBotToken('');
      setTelegramChatId('');
    }
  }, [user, fetchTelegramConfig]);

  const fetchAllUsers = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    setAllUsers((data || []).map(mapRowToProfile));
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchAllUsers();
    } else {
      setAllUsers([]);
    }
  }, [user, fetchAllUsers]);

  // Gentle expiry warning, shown once per session
  useEffect(() => {
    if (!user || user.tier === 'free' || !user.subscriptionEnd) return;
    const endTime = new Date(user.subscriptionEnd).getTime();
    const daysLeft = (endTime - Date.now()) / (1000 * 60 * 60 * 24);

    if (daysLeft <= 0) {
      toast.error('Your VIP Subscription has expired. You now have Free access.');
    } else if (daysLeft <= 3 && !sessionStorage.getItem('notified_3days')) {
      toast.warning(`⚠️ VIP Alert: Your access expires in ${Math.ceil(daysLeft)} days! Renew to avoid interruption.`);
      sessionStorage.setItem('notified_3days', 'true');
    }
  }, [user]);

  const updateTelegramConfig = async (token: string, chatId: string) => {
    if (!user) {
      toast.error('User not logged in');
      return;
    }
    try {
      const { error } = await supabase
        .from('telegram_configs')
        .upsert(
          { user_id: user.id, bot_token: token, chat_id: chatId },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setTelegramBotToken(token);
      setTelegramChatId(chatId);
      toast.success('Telegram Bot Token and Chat ID updated successfully!');
    } catch (err) {
      console.error('Error updating telegram config:', err);
      toast.error('Failed to update Telegram configuration');
    }
  };

  const dispatchTelegramSignal = async (signal: TelegramSignalPayload): Promise<boolean> => {
    if (!telegramBotToken || !telegramChatId) {
      toast.error('Please configure Telegram Bot Token and Chat ID in Admin Panel first!');
      return false;
    }

    toast.info(`Dispatching ${signal.pair} ${signal.type} signal to Telegram channel...`);
    const res = await sendTelegramSignalNotification(telegramBotToken, telegramChatId, signal);
    if (res.success) {
      toast.success(res.message);
      return true;
    } else {
      toast.error(res.message);
      return false;
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      toast.error(error.message || 'Login failed. Check your email and password.');
      return false;
    }
    toast.success('Welcome back!');
    return true;
  };

  const signUp = async (email: string, pass: string, name: string): Promise<boolean> => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { name } },
    });
    if (error) {
      toast.error(error.message || 'Sign up failed.');
      return false;
    }
    toast.success('Account created! Welcome to LiveTrading AI.');
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast.info('Logged out successfully.');
  };

  const updateUserSubscription = async (email: string, tier: SubscriptionTier, durationDays: number) => {
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const { data: target, error: findError } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    if (findError || !target) {
      toast.error('No user found with that email. They need to sign up first.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        tier,
        is_expired: false,
        subscription_start: now.toISOString(),
        subscription_end: tier === 'free' ? null : endDate.toISOString(),
      })
      .eq('id', target.id);

    if (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
      return;
    }

    toast.success(`Subscription for ${email} set to ${tier.toUpperCase()}`);
    fetchAllUsers();

    if (user && user.email.toLowerCase() === target.email.toLowerCase()) {
      const refreshed = await fetchProfile(user.id);
      if (refreshed) setUser(refreshed);
    }
  };

  const isVipMember = computeIsVip(user);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signUp,
      logout,
      updateUserSubscription,
      allUsers,
      instagramUrl: INSTAGRAM_URL,
      vipMonthlyPrice: VIP_MONTHLY_PRICE,
      vipYearlyPrice: VIP_YEARLY_PRICE,
      telegramBotToken,
      telegramChatId,
      updateTelegramConfig,
      dispatchTelegramSignal,
      isVipMember,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
