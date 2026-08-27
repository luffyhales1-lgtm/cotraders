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

// Keyless, CORS-friendly RSS outlets read directly in the browser through a
// public CORS proxy. This is the final live tier so the feed keeps working even
// if the edge function isn't deployed AND CryptoCompare is region-blocked.
const RSS_FEEDS: { url: string; source: string }[] = [
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  { url: 'https://cryptoslate.com/feed/', source: 'CryptoSlate' },
  { url: 'https://bitcoinmagazine.com/.rss/full/', source: 'Bitcoin Magazine' },
];

// Multiple proxies tried in order — if one is down/blocked the next is used.
const CORS_PROXIES: ((u: string) => string)[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

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

/** Resolve with a fallback value if the promise doesn't settle within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch(() => { clearTimeout(t); resolve(fallback); });
  });
}

/** fetch() that actually aborts (frees the socket) after `ms`. */
async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Short-lived in-memory cache so re-opening the News page (or an auto-refresh
// tick firing while a load is mid-flight) shows instantly instead of re-waiting
// on the network. Refreshed transparently once stale.
let newsCache: { data: MarketNews[]; at: number } | null = null;
const NEWS_CACHE_TTL = 90 * 1000;

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
    const res = await fetchWithTimeout(CRYPTOCOMPARE_NEWS_URL, 4500, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const json = await res.json();
    const data: CryptoCompareArticle[] = json?.Data ?? [];
    return Array.isArray(data) ? normaliseCryptoCompare(data) : [];
  } catch (e) {
    console.warn('[newsService] CryptoCompare direct call failed:', e);
    return [];
  }
}

/** Parse a raw RSS/XML string into our RawArticle shape. */
function parseRssXml(xml: string, source: string): RawArticle[] {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item, entry')).slice(0, 12);
    return items
      .map((item, idx) => {
        const pick = (sel: string) => item.querySelector(sel)?.textContent?.trim() ?? '';
        const title = pick('title');
        // RSS uses <link>text</link>; Atom uses <link href="...">
        let link = pick('link');
        if (!link) link = item.querySelector('link')?.getAttribute('href') ?? '';
        const descHtml = pick('description') || pick('summary') || pick('content');
        const body = descHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
        const pub = pick('pubDate') || pick('published') || pick('updated');
        const cats = Array.from(item.querySelectorAll('category'))
          .map((c) => (c.textContent?.trim() || c.getAttribute('term') || '').trim())
          .filter(Boolean)
          .slice(0, 4);
        const ts = pub ? new Date(pub).getTime() : Date.now();
        return {
          id: `${source}-${idx}-${link || title}`,
          title,
          source,
          url: link,
          body,
          publishedOn: isFinite(ts) ? ts : Date.now(),
          categories: cats,
        } as RawArticle;
      })
      .filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

/** Source #3 — keyless crypto RSS outlets via a public CORS proxy. */
async function fetchFromRss(): Promise<RawArticle[]> {
  for (const proxy of CORS_PROXIES) {
    const collected: RawArticle[] = [];
    await Promise.all(
      RSS_FEEDS.map(async (feed) => {
        try {
          const res = await fetchWithTimeout(proxy(feed.url), 4500);
          if (!res.ok) return;
          const text = await res.text();
          // allorigins /get returns JSON {contents}; /raw + others return XML directly
          let xml = text;
          if (text.trimStart().startsWith('{')) {
            try { xml = JSON.parse(text)?.contents ?? text; } catch { /* keep text */ }
          }
          collected.push(...parseRssXml(xml, feed.source));
        } catch {
          /* try next feed */
        }
      }),
    );
    if (collected.length > 0) return collected;
  }
  return [];
}

/**
 * Fetches the latest live market news, newest first. Tries the multi-source
 * aggregator first, then a direct CryptoCompare call, then keyless crypto RSS
 * outlets via a CORS proxy — so the page stays live even if the edge function
 * isn't deployed and CryptoCompare is unreachable. Throws only if ALL paths
 * fail — the caller shows a real error state (never fake news).
 */
export async function fetchLiveNews(limit = 30, opts?: { force?: boolean }): Promise<MarketNews[]> {
  // Serve a warm cache instantly (unless the caller forces a hard refresh).
  if (!opts?.force && newsCache && Date.now() - newsCache.at < NEWS_CACHE_TTL) {
    return newsCache.data.slice(0, limit);
  }

  // Kick the two fastest sources off together so CryptoCompare is already
  // in-flight by the time the edge function resolves/times out — no serial wait.
  const edgeP = withTimeout(fetchFromEdge(), 3500, [] as RawArticle[]);
  const ccP = withTimeout(fetchFromCryptoCompare(), 4500, [] as RawArticle[]);

  let raw = await edgeP;
  if (raw.length === 0) raw = await ccP;
  // Last resort: keyless RSS via CORS proxy (bounded so it can't hang the page).
  if (raw.length === 0) raw = await withTimeout(fetchFromRss(), 6000, [] as RawArticle[]);

  if (raw.length === 0) {
    // If we have anything cached, prefer showing that over a hard error.
    if (newsCache && newsCache.data.length > 0) return newsCache.data.slice(0, limit);
    throw new Error('Live news feed is temporarily unreachable. Please refresh in a moment.');
  }

  // De-duplicate by title (different outlets syndicate the same story).
  const seen = new Set<string>();
  const deduped = raw.filter((a) => {
    const key = a.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const result = normaliseRaw(deduped)
    .sort((a, b) => (b.publishedOn ?? 0) - (a.publishedOn ?? 0));

  newsCache = { data: result, at: Date.now() };
  return result.slice(0, limit);
}
