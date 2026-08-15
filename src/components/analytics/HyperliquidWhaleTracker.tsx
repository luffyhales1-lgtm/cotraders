import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck,
  ExternalLink,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface WhaleTransaction {
  id: string;
  timestamp: string;
  asset: string;
  action: 'BUY' | 'SELL';
  amount: number;
  usdValue: number;
  price: number;
  wallet: string; // First and last 4 chars of wallet
}

export const HyperliquidWhaleTracker: React.FC = () => {
  const { isVipMember } = useAuth();
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWhaleData = async () => {
      try {
        // Simulate fetching whale data from Hyperliquid API
        // In a real app, you would call the actual Hyperliquid API
        setLoading(true);
        
        // Simulated data - in production, replace with actual API call
        const simulatedData: WhaleTransaction[] = [
          {
            id: 'whale-1',
            timestamp: '2 mins ago',
            asset: 'BTC',
            action: 'BUY',
            amount: 125.5,
            usdValue: 12150000,
            price: 96800,
            wallet: '0x742d...5Cc8'
          },
          {
            id: 'whale-2',
            timestamp: '8 mins ago',
            asset: 'ETH',
            action: 'BUY',
            amount: 2450,
            usdValue: 8650000,
            price: 3530,
            wallet: '0x8ba1...1B98'
          },
          {
            id: 'whale-3',
            timestamp: '15 mins ago',
            asset: 'SOL',
            action: 'SELL',
            amount: 15000,
            usdValue: 4200000,
            price: 280,
            wallet: '0xAb58...1B98'
          },
          {
            id: 'whale-4',
            timestamp: '22 mins ago',
            asset: 'XAU',
            action: 'BUY',
            amount: 450,
            usdValue: 1302525,
            price: 2894.5,
            wallet: '0x4b20...9B8c'
          }
        ];
        
        setWhaleTransactions(simulatedData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching whale data:', error);
        setLoading(false);
        toast.error('Failed to load whale tracking data');
      }
    };

    fetchWhaleData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWhaleData, 30 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (!isVipMember) {
    return (
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
            <ShieldCheck className="h-5 w-5" />
            Hyperliquid Whale Tracking
          </CardTitle>
          <Badge variant="outline" className="text-slate-400 border-slate-800 text-[10px]">
            VIP ONLY
          </Badge>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-slate-400">
            Upgrade to VIP to access real-time Hyperliquid whale transaction tracking.
          </p>
          <Button onClick={() => window.location.href = '/pricing'} className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1">
            Upgrade to VIP
          </Button>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-400">
          <Activity className="h-5 w-5" />
          Hyperliquid Whale Tracking
        </CardTitle>
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 text-[10px]">
          LIVE DATA
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Zap className="h-4 w-4 text-purple-400 animate-spin" />
              </div>
              <span className="text-sm text-slate-400">Loading whale transactions...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {whaleTransactions.map((tx) => (
              <div key={tx.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${tx.action === 'BUY' ? 'bg-emerald-500/20' : 'bg-rose-500/20'} flex items-center justify-center`}>
                    {tx.action === 'BUY' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-100">{tx.asset} Whale Transaction</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" /> {tx.timestamp}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      Wallet: <span className="font-mono">{tx.wallet}</span>
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-slate-100">
                      {tx.action === 'BUY' ? '+' : '-'}${tx.usdValue.toLocaleString()} USD
                    </p>
                    <p className="text-xs text-slate-400">
                      {tx.amount} {tx.asset} @ ${tx.price.toLocaleString()}
                    </p>
                    <Badge className={tx.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}>
                      {tx.action}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </div>
  );
};