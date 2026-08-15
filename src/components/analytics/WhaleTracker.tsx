import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchWhaleTrackerData, WhaleTrackerError, WhaleEvent } from '@/services/whaleTrackerApi';
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck,
  ExternalLink,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface WhaleTrackerProps {}

export const WhaleTracker: React.FC<WhaleTrackerProps> = () => {
  const { isVipMember } = useAuth();
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<{ hyperliquid: string | null; chain: string | null }>({
    hyperliquid: null,
    chain: null
  });
  const [fetchedAt, setFetchedAt] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWhaleTrackerData();
        setEvents(data.events);
        setSourceErrors(data.sourceErrors);
        setFetchedAt(data.fetchedAt);
      } catch (err) {
        if (err instanceof WhaleTrackerError) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 45 seconds
    const interval = setInterval(fetchData, 45 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (!isVipMember) {
    return (
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-400">
            <Activity className="h-5 w-5" />
            Hyperliquid Whale Tracking
          </CardTitle>
          <Badge variant="outline" className="text-slate-400 border-slate-800 text-[10px]">
            VIP ONLY
          </Badge>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-slate-400">
            Upgrade to VIP to access real-time Hyperliquid and on-chain whale transaction tracking.
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
      <CardHeader className="pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-400">
            <Activity className="h-5 w-5" />
            Hyperliquid Whale Tracking
          </CardTitle>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 text-[10px]">
            LIVE DATA
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              // Trigger refresh by refetching
              window.location.reload();
            }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
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
        ) : error ? (
          <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <p className="text-sm text-slate-400">{error}</p>
            <Button 
              onClick={() => {
                setError(null);
                // Trigger refresh
                window.location.reload();
              }}
              className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {Object.values(sourceErrors).some(Boolean) && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>
                    {sourceErrors.chain && (
                      <span>Chain data unavailable: {sourceErrors.chain}</span>
                    )}
                    {sourceErrors.hyperliquid && sourceErrors.chain && (
                      <span> | </span>
                    )}
                    {sourceErrors.hyperliquid && (
                      <span>Hyperliquid data unavailable: {sourceErrors.hyperliquid}</span>
                    )}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">
                    No whale transactions matching the current filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((tx) => (
                    <div key={tx.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${tx.action === 'BUY' ? 'bg-emerald-500/20' : tx.action === 'SELL' ? 'bg-rose-500/20' : 'bg-slate-500/20'} flex items-center justify-center`}>
                          {tx.action === 'BUY' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : 
                            tx.action === 'SELL' ? <TrendingDown className="h-5 w-5 text-rose-400" /> : 
                            <Activity className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-100">{tx.asset} Whale Transaction</h4>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" /> 
                            {new Date(tx.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ago
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            Wallet: <span className="font-mono">{tx.wallet}</span>
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="font-bold text-slate-100">
                            {tx.action === 'BUY' ? '+' : '-'}${tx.usdValue >= 1000000 ? 
                              (tx.usdValue / 1000000).toFixed(2) + 'M' : 
                              (tx.usdValue / 1000).toFixed(1) + 'K'} USD
                          </p>
                          <p className="text-xs text-slate-400">
                            {tx.amount} {tx.asset} @ {tx.price.toLocaleString()}
                          </p>
                          <Badge className={tx.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 
                            tx.action === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 
                            'bg-slate-500/20 text-slate-400'}>
                            {tx.action}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </div>
    );
};