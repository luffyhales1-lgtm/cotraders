import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ShieldCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { fetchWhaleTrackerData, WhaleEvent, WhaleTrackerError } from '@/services/whaleTrackerApi';

const REFRESH_INTERVAL_MS = 45 * 1000;

function timeAgo(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export const WhaleTracker: React.FC = () => {
  const { isVipMember } = useAuth();
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadWhaleData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setLoading(true);
    try {
      const result = await fetchWhaleTrackerData();
      setEvents(result.events);
      // keep only sources that actually reported an error (values are null when healthy)
      const activeErrors: Record<string, string> = {};
      Object.entries(result.sourceErrors || {}).forEach(([k, v]) => {
        if (v) activeErrors[k] = v;
      });
      setSourceErrors(activeErrors);
      setLastUpdated(Date.now());
      setError(null);
    } catch (e) {
      const message =
        e instanceof WhaleTrackerError
          ? e.message
          : 'Could not reach the whale tracking service.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isVipMember) return;
    loadWhaleData();
    const interval = setInterval(() => loadWhaleData(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isVipMember, loadWhaleData]);

  if (!isVipMember) {
    return (
      <div className="p-6 rounded-3xl glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
            <ShieldCheck className="h-5 w-5" />
            Whale Tracker
          </CardTitle>
          <Badge variant="outline" className="text-slate-400 border-slate-800 text-[10px]">
            VIP ONLY
          </Badge>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-slate-400">
            Upgrade to VIP to access real-time whale transaction tracking — live $50k+ fills straight from the Hyperliquid perp DEX.
          </p>
          <Button onClick={() => window.location.href = '/pricing'} className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1">
            Upgrade to VIP
          </Button>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-3xl glass-panel">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-400">
            <Activity className="h-5 w-5" />
            Whale Tracker
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 text-[10px]">
              LIVE · HYPERLIQUID
            </Badge>
            {lastUpdated && (
              <span className="text-[10px] text-slate-500">Updated {timeAgo(Math.floor(lastUpdated / 1000))}</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadWhaleData(true)}
          disabled={loading}
          className="border-slate-800 text-slate-400 hover:text-slate-100 gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && events.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Zap className="h-4 w-4 text-purple-400 animate-spin" />
              </div>
              <span className="text-sm text-slate-400">Loading whale transactions...</span>
            </div>
          </div>
        ) : error && events.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto" />
            <p className="text-sm text-slate-300 max-w-sm mx-auto">{error}</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              This live feed streams free from the Hyperliquid public API. If it stalls, it's usually a temporary network/WebSocket hiccup — retry in a moment.
            </p>
            <Button size="sm" onClick={() => loadWhaleData(true)} className="bg-purple-600 hover:bg-purple-500">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.keys(sourceErrors).length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Some data sources are unavailable: {Object.entries(sourceErrors).map(([k, v]) => `${k} (${v})`).join(', ')}
                </span>
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No whale activity above threshold in the current window.</p>
            ) : (
              events.map((tx) => (
                <div key={tx.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg shrink-0 flex items-center justify-center ${
                      tx.action === 'BUY' ? 'bg-emerald-500/20' : tx.action === 'SELL' ? 'bg-rose-500/20' : 'bg-slate-700/40'
                    }`}>
                      {tx.action === 'BUY' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> :
                       tx.action === 'SELL' ? <TrendingDown className="h-5 w-5 text-rose-400" /> :
                       <ArrowRightLeft className="h-5 w-5 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-100 truncate">{tx.asset} · {tx.detail}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" /> {timeAgo(tx.timestamp)}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        <span className="font-mono">{tx.wallet}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1 shrink-0">
                    <p className="font-bold text-slate-100">{formatUsd(tx.usdValue)}</p>
                    {tx.amount !== null && (
                      <p className="text-xs text-slate-400">
                        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.asset}
                        {tx.price !== null && ` @ $${tx.price.toLocaleString()}`}
                      </p>
                    )}
                    <Badge className={
                      tx.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                      tx.action === 'SELL' ? 'bg-rose-500/20 text-rose-400' :
                      'bg-slate-700/40 text-slate-300'
                    }>
                      {tx.action}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </div>
  );
};