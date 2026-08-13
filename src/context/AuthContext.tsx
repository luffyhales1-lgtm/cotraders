import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, SubscriptionTier } from '@/types/trading';
import { toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  updateUserSubscription: (email: string, tier: SubscriptionTier, durationDays: number) => void;
  allUsers: UserProfile[];
  instagramUrl: string;
  vipMonthlyPrice: number;
  vipYearlyPrice: number;
}

const ADMIN_EMAIL = 'luffyhales1@gmail.com';
const ADMIN_PASS = 'yahoo789';

const INSTAGRAM_URL = 'https://www.instagram.com/abdul_kaif12';
const VIP_MONTHLY_PRICE = 49.90;
const VIP_YEARLY_PRICE = 99.90;

const INITIAL_USERS: UserProfile[] = [
  {
    email: ADMIN_EMAIL,
    name: 'Master Admin (Abdul Kaif)',
    tier: 'vip_yearly',
    isAdmin: true,
    subscriptionStart: new Date().toISOString(),
    subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isExpired: false,
  },
  {
    email: 'trader1@gmail.com',
    name: 'Alex Rivera',
    tier: 'vip_monthly',
    isAdmin: false,
    subscriptionStart: new Date().toISOString(),
    subscriptionEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Expiring in 3 days
    isExpired: false,
  },
  {
    email: 'guest_trader@gmail.com',
    name: 'Free Member',
    tier: 'free',
    isAdmin: false,
    subscriptionStart: new Date().toISOString(),
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
        return INITIAL_USERS[0];
      }
    }
    // Default to admin user for immediate preview access
    return INITIAL_USERS[0];
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('livetrading_all_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

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

  // Check subscription expiry timer
  useEffect(() => {
    if (!user || user.tier === 'free') return;

    if (user.subscriptionEnd) {
      const endTime = new Date(user.subscriptionEnd).getTime();
      const now = Date.now();
      const daysLeft = (endTime - now) / (1000 * 60 * 60 * 24);

      if (now >= endTime) {
        toast.error('Your VIP Subscription has expired! Downgrading to Free Trial.');
        const updatedUser: UserProfile = { ...user, tier: 'free', isExpired: true };
        setUser(updatedUser);
      } else if (daysLeft <= 3 && !sessionStorage.getItem('notified_3days')) {
        toast.warning(`⚠️ Reminder: Your VIP Subscription expires in ${Math.ceil(daysLeft)} days! Renewal alert sent to ${user.email}.`);
        sessionStorage.setItem('notified_3days', 'true');
      }
    }
  }, [user]);

  const login = (email: string, pass: string): boolean => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
      const adminAcc: UserProfile = {
        email: ADMIN_EMAIL,
        name: 'Master Admin (Abdul Kaif)',
        tier: 'vip_yearly',
        isAdmin: true,
        subscriptionStart: new Date().toISOString(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        isExpired: false,
      };
      setUser(adminAcc);
      toast.success('Welcome Master Admin! Access Granted to Full Platform & Admin Panel.');
      return true;
    }

    // Check existing users or create new free account
    const existing = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      setUser(existing);
      toast.success(`Logged in as ${existing.name}`);
      return true;
    }

    // Demo user registration
    const newUser: UserProfile = {
      email,
      name: email.split('@')[0],
      tier: 'free',
      isAdmin: false,
      subscriptionStart: new Date().toISOString(),
      isExpired: false,
    };

    setAllUsers(prev => [...prev, newUser]);
    setUser(newUser);
    toast.success('Account Created! Standard Free Trial Access Granted.');
    return true;
  };

  const logout = () => {
    setUser(null);
    toast.info('You have logged out.');
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

    // If current logged in user is updated
    if (user && user.email.toLowerCase() === email.toLowerCase()) {
      const selfUpdated = updated.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (selfUpdated) setUser(selfUpdated);
    }

    toast.success(`Subscription updated for ${email} to ${tier.toUpperCase()}`);
  };

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