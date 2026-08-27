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

// Owner / super-admin accounts. These emails are ALWAYS treated as admins on
// the client, even if the database `is_admin` flag was never set or a `profiles`
// row is missing/blocked by RLS. This guarantees the owner never loses the
// admin portal. (Real end users still get admin only via the DB flag.)
const ADMIN_EMAILS = new Set<string>([
  'luffyhales1@gmail.com',
]);

function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// VIP status is computed live from the expiry date, never trusted as a stored
// flag. Admins always have full (VIP) access to every feature.
function computeIsVip(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (profile.tier === 'free') return false;
  if (!profile.subscriptionEnd) return true;
  return new Date(profile.subscriptionEnd).getTime() > Date.now();
}

function mapRowToProfile(row: any): UserProfile {
  const email = row.email ?? '';
  return {
    id: row.id,
    email,
    name: row.name ?? email?.split('@')[0] ?? 'User',
    tier: row.tier ?? 'free',
    // DB flag OR hard-coded owner email — either one makes you an admin.
    isAdmin: !!row.is_admin || isAdminEmail(email),
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

  /**
   * Turn a Supabase auth session user into an app UserProfile.
   *
   * Robustness is the whole point here: the OLD code used `.single()`, which
   * THROWS if the `profiles` row is missing or hidden by RLS — that returned
   * null and made a perfectly valid session look "logged out", so the login
   * screen kept coming back. Now we:
   *   1. read the row with `.maybeSingle()` (0 rows -> null, no throw),
   *   2. if a row exists, use it (and quietly persist the owner's admin flag),
   *   3. if NO row exists, synthesise a profile from the auth user so the
   *      session ALWAYS resolves, and best-effort create the row for next time.
   * The user is therefore never bounced back to login on a valid session.
   */
  const resolveProfile = useCallback(async (sessionUser: any): Promise<UserProfile> => {
    const email: string = sessionUser?.email ?? '';
    const metaName: string | undefined = sessionUser?.user_metadata?.name;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (!error && data) {
        const profile = mapRowToProfile(data);
        // Owner logged in but DB flag is off? Persist it (fire-and-forget).
        if (isAdminEmail(email) && !data.is_admin) {
          supabase.from('profiles').update({ is_admin: true }).eq('id', sessionUser.id)
            .then(() => {}, () => {});
        }
        return profile;
      }
    } catch (err) {
      console.warn('[auth] profile lookup failed, using session fallback:', err);
    }

    // No usable row — build a safe profile straight from the auth session so
    // the app treats the user as logged in no matter what.
    const fallback: UserProfile = {
      id: sessionUser.id,
      email,
      name: metaName ?? email.split('@')[0] ?? 'Trader',
      tier: 'free',
      isAdmin: isAdminEmail(email),
      subscriptionStart: undefined,
      subscriptionEnd: undefined,
      isExpired: false,
    };

    // Best-effort: create the row so future loads have real data. Ignore
    // failures (e.g. RLS) — the fallback above already keeps the user logged in.
    supabase.from('profiles').upsert(
      {
        id: sessionUser.id,
        email,
        name: fallback.name,
        tier: 'free',
        is_admin: isAdminEmail(email),
      },
      { onConflict: 'id' },
    ).then(() => {}, () => {});

    return fallback;
  }, []);

  // Restore session on load, and stay in sync with auth state changes.
  useEffect(() => {
    let mounted = true;

    const applySession = async (session: any) => {
      if (session?.user) {
        const profile = await resolveProfile(session.user);
        if (mounted) setUser(profile);
      } else if (mounted) {
        setUser(null);
      }
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await applySession(session);
      if (mounted) setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase advises against awaiting other supabase calls *directly*
      // inside this callback (it can dead-lock the auth lock). Defer to a
      // microtask/timeout so the profile lookup runs cleanly.
      if (event === 'SIGNED_OUT') {
        if (mounted) setUser(null);
        return;
      }
      setTimeout(() => { applySession(session); }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [resolveProfile]);

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
    // Per-user bot gating. Signals only ever go to THIS user's own bot (the
    // telegram_configs row is keyed by user_id), and only once they are a VIP
    // who has actually configured it. There is no shared/global bot, and free
    // users never trigger a dispatch.
    if (!computeIsVip(user)) {
      toast.error('Telegram signals are a VIP feature. Upgrade to VIP, then add your own bot in Bot Settings.');
      return false;
    }
    if (!telegramBotToken || !telegramChatId) {
      toast.error('Add your own Telegram Bot Token & Chat ID in Bot Settings first — signals dispatch only to your own bot.');
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
      const refreshed = await resolveProfile({ id: user.id, email: user.email });
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
