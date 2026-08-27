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

const REFRESH_INTERVAL_MS = 15 * 1000; // re-snapshot the live buffer every 15s

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
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-600">
            <ShieldCheck className="h-5 w-5" />
            Whale Tracker
          </CardTitle>
          <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">
            VIP ONLY
          </Badge>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-slate-500">
            Upgrade to VIP to access real-time whale transaction tracking — live $15k+ fills straight from the Hyperliquid perp DEX.
          </p>
          <Button onClick={() => window.location.href = '/pricing'} className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-white font-black text-xs gap-1">
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
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-600">
            <Activity className="h-5 w-5" />
            Whale Tracker
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              LIVE · HYPERLIQUID
            </Badge>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400">Updated {timeAgo(Math.floor(lastUpdated / 1000))}</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadWhaleData(true)}
          disabled={loading}
          className="border-slate-300 text-slate-500 hover:text-slate-900 gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && events.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                <Zap className="h-4 w-4 text-indigo-600 animate-spin" />
              </div>
              <span className="text-sm text-slate-500">Connecting to the live whale feed…</span>
            </div>
          </div>
        ) : error && events.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-700 max-w-sm mx-auto">{error}</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              This live feed streams free from the Hyperliquid public API. If it stalls, it's usually a temporary network/WebSocket hiccup — retry in a moment.
            </p>
            <Button size="sm" onClick={() => loadWhaleData(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.keys(sourceErrors).length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Some data sources are unavailable: {Object.entries(sourceErrors).map(([k, v]) => `${k} (${v})`).join(', ')}
                </span>
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Waiting for the next $15k+ whale fill on the live feed…</p>
            ) : (
              events.map((tx) => (
                <div key={tx.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg shrink-0 flex items-center justify-center ${
                      tx.action === 'BUY' ? 'bg-emerald-100' : tx.action === 'SELL' ? 'bg-rose-100' : 'bg-slate-200'
                    }`}>
                      {tx.action === 'BUY' ? <TrendingUp className="h-5 w-5 text-emerald-600" /> :
                       tx.action === 'SELL' ? <TrendingDown className="h-5 w-5 text-rose-600" /> :
                       <ArrowRightLeft className="h-5 w-5 text-slate-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 truncate">{tx.asset} · {tx.detail}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" /> {timeAgo(tx.timestamp)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-mono">{tx.wallet}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1 shrink-0">
                    <p className="font-bold text-slate-900">{formatUsd(tx.usdValue)}</p>
                    {tx.amount !== null && (
                      <p className="text-xs text-slate-500">
                        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.asset}
                        {tx.price !== null && ` @ $${tx.price.toLocaleString()}`}
                      </p>
                    )}
                    <Badge className={
                      tx.action === 'BUY' ? 'bg-emerald-100 text-emerald-700' :
                      tx.action === 'SELL' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-200 text-slate-600'
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
