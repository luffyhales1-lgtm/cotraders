import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import {
  Newspaper,
  Flame,
  ExternalLink,
  Lock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { fetchLiveNews, relativeTime } from '@/services/newsService';
import { MarketNews } from '@/types/trading';
import { toast } from 'sonner';

const AUTO_REFRESH_MS = 2 * 60 * 1000; // live auto-refresh every 2 minutes
const FREE_TIER_VISIBLE = 6;           // free users see the latest N; VIP sees all

const NewsPage: React.FC = () => {
  const { instagramUrl, isVipMember } = useAuth();
  const [news, setNews] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  // ticks once a minute so the "x mins ago" labels stay live without refetching
  const [, setClock] = useState(0);
  const mounted = useRef(true);

  const loadNews = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const items = await fetchLiveNews(24);
      if (!mounted.current) return;
      setNews(items);
      setLastUpdated(Date.now());
      setError(null);
      if (isManual) toast.success(`📰 Refreshed — ${items.length} live stories loaded.`);
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e?.message ?? 'Could not load live news right now.');
      if (isManual) toast.error('Could not refresh news — please try again shortly.');
    } finally {
      if (!mounted.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadNews();

    // live auto-refresh every 2 minutes
    const refreshInterval = setInterval(() => loadNews(false), AUTO_REFRESH_MS);
    // re-render every 60s so relative timestamps advance ("2 mins" -> "3 mins")
    const clockInterval = setInterval(() => setClock(c => c + 1), 60 * 1000);

    return () => {
      mounted.current = false;
      clearInterval(refreshInterval);
      clearInterval(clockInterval);
    };
  }, [loadNews]);

  const visibleNews = isVipMember ? news : news.slice(0, FREE_TIER_VISIBLE);
  const hiddenCount = news.length - visibleNews.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 animate-fade-up">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Newspaper className="h-7 w-7 text-rose-500" />
              Institutional Intelligence &amp; Market News
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE
              </span>
              Aggregated from CoinDesk, Cointelegraph, Decrypt &amp; more · auto-refreshes every 2 min
              {lastUpdated && (
                <span className="text-slate-400 font-mono">· updated {relativeTime(lastUpdated)}</span>
              )}
            </p>
          </div>

          <Button
            onClick={() => loadNews(true)}
            disabled={refreshing}
            className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-black gap-2 rounded-xl shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh Now'}
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 animate-pulse">
                <div className="h-3 w-32 bg-slate-200 rounded mb-4" />
                <div className="h-5 w-full bg-slate-200 rounded mb-2" />
                <div className="h-5 w-2/3 bg-slate-200 rounded mb-4" />
                <div className="h-3 w-full bg-slate-200/70 rounded mb-1.5" />
                <div className="h-3 w-5/6 bg-slate-200/70 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 rounded-2xl glass-panel">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-800 font-bold">{error}</p>
            <Button onClick={() => loadNews(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 scene-3d">
              {visibleNews.map(item => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>

            {!isVipMember && hiddenCount > 0 && (
              <div className="mt-6 p-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-50 to-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Lock className="h-6 w-6 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-black text-slate-900">{hiddenCount} more live stories + VIP macro analysis</p>
                    <p className="text-xs text-slate-500">Unlock the full real-time intelligence feed and institutional sentiment reads.</p>
                  </div>
                </div>
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button className="bg-amber-500 hover:bg-amber-400 text-white font-black gap-2">
                    <Lock className="h-4 w-4" /> Unlock VIP Feed
                  </Button>
                </a>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const NewsCard: React.FC<{ item: MarketNews }> = ({ item }) => {
  const sentimentStyle =
    item.sentiment === 'BULLISH'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40'
      : item.sentiment === 'BEARISH'
        ? 'bg-rose-500/15 text-rose-600 border-rose-500/40'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  const SentimentIcon =
    item.sentiment === 'BULLISH' ? TrendingUp : item.sentiment === 'BEARISH' ? TrendingDown : Minus;
  const impactStyle =
    item.impact === 'HIGH'
      ? 'border-rose-500/40 text-rose-600'
      : item.impact === 'MEDIUM'
        ? 'border-amber-500/40 text-amber-600'
        : 'border-slate-200 text-slate-500';

  const liveTime = item.publishedOn ? relativeTime(item.publishedOn) : item.time;

  return (
    <div className="p-6 rounded-2xl glass-panel glass-panel-interactive transition-colors flex flex-col justify-between card-3d">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-bold text-slate-800 truncate">{item.source}</span>
          <span className="flex items-center gap-1 shrink-0">
            <Radio className="h-3 w-3 text-emerald-600" /> {liveTime}
          </span>
        </div>

        <h3 className="font-extrabold text-lg text-slate-900 leading-snug">{item.title}</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.summary}</p>

        {item.categories && item.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.categories.map(c => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className={`gap-1 ${sentimentStyle}`}>
            <SentimentIcon className="h-3 w-3" /> {item.sentiment}
          </Badge>
          <Badge variant="outline" className={`gap-1 ${impactStyle}`}>
            <Flame className="h-3 w-3" /> {item.impact}
          </Badge>
        </div>

        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-indigo-600 hover:text-indigo-500 gap-1">
              Read <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
};

export default NewsPage;
