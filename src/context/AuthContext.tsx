import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, SubscriptionTier } from '@/types/trading';
import { sendTelegramSignalNotification, TelegramSignalPayload } from '@/services/telegramService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Simple UUID generator for demo purposes
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  updateUserSubscription: (email: string, tier: SubscriptionTier, durationDays: number) => void;
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

const ADMIN_EMAIL = 'luffyhales1@gmail.com';
const ADMIN_PASS = 'Yahoo132$';

const INSTAGRAM_URL = 'https://www.instagram.com/abdul_kaif12';
const VIP_MONTHLY_PRICE = 29.90;
const VIP_YEARLY_PRICE = 99.90;

// Generate IDs for initial users
const INITIAL_USERS: UserProfile[] = [
  {
    id: generateUUID(),
    email: ADMIN_EMAIL,
    name: 'Cotraders',
    tier: 'vip_yearly',
    isAdmin: true,
    subscriptionStart: new Date().toISOString(),
    subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isExpired: false,
  },
  {
    id: generateUUID(),
    email: 'trader1@gmail.com',
    name: 'Alex Rivera',
    tier: 'vip_monthly',
    isAdmin: false,
    subscriptionStart: new Date().toISOString(),
    subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isExpired: false,
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('livetrading_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null; // Public guest by default until logged in
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('livetrading_all_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');

  useEffect(() => {
    if (user) {
      localStorage.setItem('livetrading_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('livetrading_user');
    }
  }, [user]);

  useEffect(() => {
      localStorage.setItem('livetrading_all_users', JSON.stringify(allUsers));
    }, [allUsers]);
  
    useEffect(() => {
      if (user) {
        fetchTelegramConfig();
      } else {
        setTelegramBotToken('');
        setTelegramChatId('');
      }
    }, [user]);
  
  // Subscription expiry check
  useEffect(() => {
    if (!user || user.tier === 'free') return;

    if (user.subscriptionEnd) {
      const endTime = new Date(user.subscriptionEnd).getTime();
      const now = Date.now();
      const daysLeft = (endTime - now) / (1000 * 60 * 60 * 24);

      if (now >= endTime) {
        toast.error('Your VIP Subscription has expired! Downgraded to Free access.');
        const updatedUser: UserProfile = { ...user, tier: 'free', isExpired: true };
        setUser(updatedUser);
      } else if (daysLeft <= 3 && !sessionStorage.getItem('notified_3days')) {
        toast.warning(`⚠️ VIP Alert: Your access expires in ${Math.ceil(daysLeft)} days! Renew on Instagram to avoid interruption.`);
        sessionStorage.setItem('notified_3days', 'true');
      }
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

        if (error) {
          throw error;
        }

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

  const login = (email: string, pass: string): boolean => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
      const adminAcc: UserProfile = {
        id: generateUUID(), // Generate a new ID for the admin session (or we could use the one from INITIAL_USERS)
        email: ADMIN_EMAIL,
        name: 'Cotraders',
        tier: 'vip_yearly',
        isAdmin: true,
        subscriptionStart: new Date().toISOString(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        isExpired: false,
      };
      setUser(adminAcc);
      toast.success('Master Admin Verified! Full Terminal & Management Unlocked.');
      return true;
    }

    const existing = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      setUser(existing);
      toast.success(`Welcome back, ${existing.name}!`);
      return true;
    }

    const newUser: UserProfile = {
      id: generateUUID(),
      email,
      name: email.split('@')[0],
      tier: 'free',
      isAdmin: false,
      subscriptionStart: new Date().toISOString(),
      isExpired: false,
    };

    setAllUsers(prev => [...prev, newUser]);
    setUser(newUser);
    toast.success('Account Created! Welcome to LiveTrading AI.');
    return true;
  };

  const logout = () => {
    setUser(null);
    toast.info('Logged out successfully.');
  };

  const updateUserSubscription = (email: string, tier: SubscriptionTier, durationDays: number) => {
      const updated = allUsers.map(u => {
        if (u.email.toLowerCase() === email.toLowerCase()) {
          const now = new Date();
          const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          return {
            ...u,
            tier,
            isExpired: false,
            subscriptionStart: now.toISOString(),
            subscriptionEnd: endDate.toISOString(),
          };
        }
        return u;
      });

      setAllUsers(updated);

      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        const selfUpdated = updated.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (selfUpdated) setUser(selfUpdated);
      }

      toast.success(`Subscription for ${email} set to ${tier.toUpperCase()}`);
    };

  const fetchTelegramConfig = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('telegram_configs')
        .select('bot_token, chat_id, auto_scan_enabled')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        console.error('Error fetching telegram config:', error);
        return;
      }

      if (data) {
        setTelegramBotToken(data.bot_token || '');
        setTelegramChatId(data.chat_id || '');
        // We don't have auto_scan_enabled in the context, but we could add it if needed.
        // For now, we only need bot_token and chat_id for the context.
      } else {
        // No config found, set to empty strings
        setTelegramBotToken('');
        setTelegramChatId('');
      }
    } catch (err) {
      console.error('Error fetching telegram config:', err);
    }
  };

  const isVipMember = !!(user && user.tier !== 'free');

  return (
    <AuthContext.Provider value={{
      user,
      login,
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