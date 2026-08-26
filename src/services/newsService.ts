import { MarketNews } from '@/types/trading';
import { supabase } from '@/integrations/supabase/client';

/**
 * LIVE crypto/macro news service.
 *
 * Sources, in order of preference:
 *   1. Our own `market-news` Supabase edge function, which aggregates MANY real
 *      outlets server-side (CryptoCompare + CoinDesk, Cointelegraph, Decrypt,
 *      Bitcoin Magazine, CryptoSlate, CoinJournal RSS) with no CORS/key limits.
 *   2. Direct CryptoCompare (CCData) browser call — works with no backend at all,
 *      so the feed keeps working even before the edge function is deployed.
 *
 * We normalise every article into the app's MarketNews shape and derive a
 * lightweight sentiment + impact read from the headline/body keywords so the UI
 * can colour-code them. Nothing here is faked: if every source fails we throw so
 * the caller shows a real error state rather than inventing placeholder news.
 */

const CRYPTOCOMPARE_NEWS_URL =
  'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest';

interface RawArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  imageUrl?: string;
  body?: string;
  publishedOn: number; // unix ms
  categories?: string[];
}

interface CryptoCompareArticle {
  id: string;
  guid?: string;
  published_on: number; // unix seconds
  imageurl?: string;
  title: string;
  url: string;
  body?: string;
  tags?: string;
  categories?: string;
  source?: string;
  source_info?: { name?: string };
}

const BULLISH_WORDS = [
  'surge', 'soar', 'rally', 'jump', 'gain', 'bullish', 'record', 'all-time high',
  'ath', 'adopt', 'approval', 'approved', 'inflow', 'accumulat', 'breakout',
  'pump', 'upgrade', 'partnership', 'institutional', 'buy', 'buying', 'rebound',
  'recover', 'greenlight', 'etf approval', 'boost', 'soars', 'spikes', 'climbs',
  'rises', 'outperform', 'demand', 'halving', 'bull run',
];

const BEARISH_WORDS = [
  'crash', 'plunge', 'plummet', 'drop', 'fall', 'dump', 'bearish', 'hack',
  'exploit', 'breach', 'ban', 'banned', 'lawsuit', 'sued', 'sell-off', 'selloff',
  'liquidat', 'outflow', 'decline', 'warning', 'fear', 'fraud', 'scam', 'collapse',
  'bankrupt', 'sinks', 'slump', 'tumble', 'crackdown', 'rug', 'downgrade',
  'sell pressure', 'correction', 'fud', 'delist', 'halt',
];

const HIGH_IMPACT_WORDS = [
  'etf', 'sec', 'federal reserve', 'fed ', 'fomc', 'interest rate', 'cpi',
  'inflation', 'regulation', 'lawsuit', 'blackrock', 'halving', 'bitcoin', 'btc',
  'ethereum', 'eth', 'hack', 'trump', 'tariff', 'billion', 'gold', 'treasury',
];

function scoreSentiment(text: string): MarketNews['sentiment'] {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) score += 1;
  for (const w of BEARISH_WORDS) if (t.includes(w)) score -= 1;
  if (score > 0) return 'BULLISH';
  if (score < 0) return 'BEARISH';
  return 'NEUTRAL';
}

function scoreImpact(text: string): MarketNews['impact'] {
  const t = text.toLowerCase();
  let hits = 0;
  for (const w of HIGH_IMPACT_WORDS) if (t.includes(w)) hits += 1;
  if (hits >= 2) return 'HIGH';
  if (hits === 1) return 'MEDIUM';
  return 'LOW';
}

/** Human "x mins ago" from a unix-ms timestamp, computed live on every render. */
export function relativeTime(publishedMs: number): string {
  const diff = Date.now() - publishedMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function normaliseRaw(articles: RawArticle[]): MarketNews[] {
  return articles.map((a, idx) => {
    const publishedMs = a.publishedOn || Date.now();
    const summary = (a.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
    const haystack = `${a.title} ${summary} ${(a.categories ?? []).join(' ')}`;
    return {
      id: a.id ?? `n-${idx}-${publishedMs}`,
      title: a.title,
      source: a.source ?? 'Crypto Newswire',
      time: relativeTime(publishedMs),
      summary: summary || 'Tap through for the full market report.',
      sentiment: scoreSentiment(haystack),
      impact: scoreImpact(haystack),
      isVipOnly: false,
      url: a.url,
      imageUrl: a.imageUrl,
      publishedOn: publishedMs,
      categories: a.categories ?? [],
    } as MarketNews;
  });
}

function normaliseCryptoCompare(articles: CryptoCompareArticle[]): RawArticle[] {
  return articles.map((a, idx) => ({
    id: a.id ?? a.guid ?? `cc-${idx}`,
    title: a.title,
    source: a.source_info?.name ?? a.source ?? 'Crypto Newswire',
    url: a.url,
    imageUrl: a.imageurl,
    body: a.body,
    publishedOn: (a.published_on ?? 0) * 1000,
    categories: (a.categories ?? '').split('|').map(c => c.trim()).filter(Boolean).slice(0, 4),
  }));
}

/** Source #1 — our multi-outlet aggregator edge function. */
async function fetchFromEdge(): Promise<RawArticle[]> {
  try {
    const { data, error } = await supabase.functions.invoke('market-news', { body: {} });
    if (error) return [];
    const articles: RawArticle[] = data?.articles ?? [];
    return Array.isArray(articles) ? articles : [];
  } catch (e) {
    console.warn('[newsService] edge aggregator unavailable, falling back:', e);
    return [];
  }
}

/** Source #2 — direct CryptoCompare (no backend needed). */
async function fetchFromCryptoCompare(): Promise<RawArticle[]> {
  try {
    const res = await fetch(CRYPTOCOMPARE_NEWS_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const json = await res.json();
    const data: CryptoCompareArticle[] = json?.Data ?? [];
    return Array.isArray(data) ? normaliseCryptoCompare(data) : [];
  } catch (e) {
    console.warn('[newsService] CryptoCompare direct call failed:', e);
    return [];
  }
}

/**
 * Fetches the latest live market news, newest first. Tries the multi-source
 * aggregator first and transparently falls back to a direct CryptoCompare call,
 * so the page stays live even if the edge function isn't deployed yet. Throws
 * only if BOTH paths fail — the caller shows a real error state (never fake news).
 */
export async function fetchLiveNews(limit = 30): Promise<MarketNews[]> {
  let raw = await fetchFromEdge();

  if (raw.length === 0) {
    raw = await fetchFromCryptoCompare();
  }

  if (raw.length === 0) {
    throw new Error('Live news feed is temporarily unreachable. Please refresh in a moment.');
  }

  return normaliseRaw(raw)
    .sort((a, b) => (b.publishedOn ?? 0) - (a.publishedOn ?? 0))
    .slice(0, limit);
}
