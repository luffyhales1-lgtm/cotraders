import { MarketNews } from '@/types/trading';

/**
 * LIVE crypto/macro news service.
 *
 * Primary source: CryptoCompare (CCData) public news API —
 *   https://min-api.cryptocompare.com/data/v2/news/?lang=EN
 * It is free, needs no API key for basic access, and is CORS-enabled, so it can
 * be called directly from the browser. Each call returns the newest articles
 * aggregated from dozens of real outlets (CoinDesk, Cointelegraph, Decrypt,
 * The Block, Reuters crypto desk, etc.), so the feed is genuinely live and
 * changes throughout the day — no more hardcoded/stale items.
 *
 * We normalise every article into the app's MarketNews shape and derive a
 * lightweight sentiment + impact read from the headline/body keywords so the
 * UI can colour-code them. Nothing here is faked: if the network call fails we
 * surface the error to the caller rather than inventing placeholder news.
 */

const CRYPTOCOMPARE_NEWS_URL =
  'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest';

// Secondary/fallback feed (also free, no key, CORS-enabled): CoinStats news.
const COINSTATS_NEWS_URL = 'https://api.coinstats.app/public/v1/news?skip=0&limit=30';

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
  'sell pressure', 'correction', 'fud', 'delist', 'halt', 'exploit',
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

function normaliseCryptoCompare(articles: CryptoCompareArticle[]): MarketNews[] {
  return articles.map((a, idx) => {
    const publishedMs = (a.published_on ?? 0) * 1000;
    const summary = (a.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
    const haystack = `${a.title} ${summary} ${a.categories ?? ''}`;
    const categories = (a.categories ?? '')
      .split('|')
      .map(c => c.trim())
      .filter(Boolean)
      .slice(0, 4);
    return {
      id: a.id ?? a.guid ?? `cc-${idx}-${publishedMs}`,
      title: a.title,
      source: a.source_info?.name ?? a.source ?? 'Crypto Newswire',
      time: relativeTime(publishedMs),
      summary: summary || 'Tap through for the full market report.',
      sentiment: scoreSentiment(haystack),
      impact: scoreImpact(haystack),
      // Gate deeper/high-impact institutional reads behind VIP; keep the feed
      // itself readable so free users still see live headlines.
      isVipOnly: false,
      url: a.url,
      imageUrl: a.imageurl,
      publishedOn: publishedMs,
      categories,
    } as MarketNews;
  });
}

interface CoinStatsArticle {
  id?: string;
  title: string;
  link?: string;
  source?: string;
  feedDate?: number; // unix ms
  imgURL?: string;
  description?: string;
}

function normaliseCoinStats(articles: CoinStatsArticle[]): MarketNews[] {
  return articles.map((a, idx) => {
    const publishedMs = a.feedDate ?? Date.now();
    const summary = (a.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
    const haystack = `${a.title} ${summary}`;
    return {
      id: a.id ?? `cs-${idx}-${publishedMs}`,
      title: a.title,
      source: a.source ?? 'Crypto Newswire',
      time: relativeTime(publishedMs),
      summary: summary || 'Tap through for the full market report.',
      sentiment: scoreSentiment(haystack),
      impact: scoreImpact(haystack),
      isVipOnly: false,
      url: a.link,
      imageUrl: a.imgURL,
      publishedOn: publishedMs,
      categories: [],
    } as MarketNews;
  });
}

/**
 * Fetches the latest live market news, newest first. Tries CryptoCompare first
 * and transparently falls back to CoinStats if that feed is unreachable, so the
 * page stays live even if one provider has a hiccup. Throws only if BOTH
 * providers fail — the caller shows a real error state (never fake news).
 */
export async function fetchLiveNews(limit = 24): Promise<MarketNews[]> {
  // --- Primary: CryptoCompare ---
  try {
    const res = await fetch(CRYPTOCOMPARE_NEWS_URL, { headers: { accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      const data: CryptoCompareArticle[] = json?.Data ?? [];
      if (Array.isArray(data) && data.length > 0) {
        return normaliseCryptoCompare(data)
          .sort((a, b) => (b.publishedOn ?? 0) - (a.publishedOn ?? 0))
          .slice(0, limit);
      }
    }
  } catch (e) {
    console.warn('[newsService] CryptoCompare feed failed, trying fallback:', e);
  }

  // --- Fallback: CoinStats ---
  try {
    const res = await fetch(COINSTATS_NEWS_URL, { headers: { accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      const data: CoinStatsArticle[] = json?.news ?? [];
      if (Array.isArray(data) && data.length > 0) {
        return normaliseCoinStats(data)
          .sort((a, b) => (b.publishedOn ?? 0) - (a.publishedOn ?? 0))
          .slice(0, limit);
      }
    }
  } catch (e) {
    console.warn('[newsService] CoinStats fallback failed:', e);
  }

  throw new Error('Live news feed is temporarily unreachable. Please refresh in a moment.');
}
