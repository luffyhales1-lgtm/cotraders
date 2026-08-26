import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

/**
 * market-news edge function
 * -------------------------
 * Aggregates LIVE crypto/macro headlines from MULTIPLE real sources, server
 * side (so there are no browser CORS limits and no API keys shipped to the
 * client). Sources:
 *   1. CryptoCompare / CCData news API  (itself aggregates CoinDesk, Cointelegraph,
 *      Decrypt, The Block, Reuters crypto desk, ... dozens of outlets)
 *   2. CoinDesk RSS
 *   3. Cointelegraph RSS
 *   4. Decrypt RSS
 *   5. Bitcoin Magazine RSS
 *   6. CryptoSlate RSS
 *   7. CoinJournal RSS
 *
 * Everything is merged, de-duplicated by title, sorted newest-first and returned
 * as a normalised article list. Nothing is fabricated: if every source fails we
 * return an empty list and a non-200 so the client can show a real error state.
 *
 * Response shape:  { articles: RawArticle[], sources: string[] }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface RawArticle {
  id: string
  title: string
  source: string
  url: string
  imageUrl?: string
  body?: string
  publishedOn: number // unix ms
  categories?: string[]
}

const RSS_FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  { url: 'https://bitcoinmagazine.com/.rss/full/', source: 'Bitcoin Magazine' },
  { url: 'https://cryptoslate.com/feed/', source: 'CryptoSlate' },
  { url: 'https://coinjournal.net/news/feed/', source: 'CoinJournal' },
]

const CRYPTOCOMPARE_URL =
  'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest'

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? decodeEntities(m[1]) : ''
}

function pickAttr(block: string, tag: string, attr: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*\\b${attr}\\s*=\\s*"([^"]+)"[^>]*>`, 'i'))
  return m ? m[1] : ''
}

async function fetchRss(feed: { url: string; source: string }): Promise<RawArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; COTRADERS-News/1.0)' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.split(/<item[\s>]/i).slice(1)
    const out: RawArticle[] = []
    for (const raw of items.slice(0, 15)) {
      const block = '<item ' + raw
      const title = pick(block, 'title')
      const link = pick(block, 'link') || pickAttr(block, 'link', 'href')
      if (!title || !link) continue
      const pub = pick(block, 'pubDate') || pick(block, 'dc:date') || pick(block, 'published')
      const publishedOn = pub ? new Date(pub).getTime() : Date.now()
      const desc = pick(block, 'description') || pick(block, 'content:encoded')
      const image =
        pickAttr(block, 'media:content', 'url') ||
        pickAttr(block, 'media:thumbnail', 'url') ||
        pickAttr(block, 'enclosure', 'url') ||
        (block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? '')
      out.push({
        id: `${feed.source}-${link}`,
        title,
        source: feed.source,
        url: link,
        imageUrl: image || undefined,
        body: desc.slice(0, 400),
        publishedOn: isNaN(publishedOn) ? Date.now() : publishedOn,
        categories: [],
      })
    }
    return out
  } catch (e) {
    console.warn(`[market-news] RSS ${feed.source} failed:`, e)
    return []
  }
}

async function fetchCryptoCompare(): Promise<RawArticle[]> {
  try {
    const res = await fetch(CRYPTOCOMPARE_URL, { headers: { accept: 'application/json' } })
    if (!res.ok) return []
    const json = await res.json()
    const data: any[] = json?.Data ?? []
    return data.map((a, idx) => ({
      id: a.id ?? a.guid ?? `cc-${idx}`,
      title: a.title,
      source: a.source_info?.name ?? a.source ?? 'Crypto Newswire',
      url: a.url,
      imageUrl: a.imageurl || undefined,
      body: (a.body ?? '').slice(0, 400),
      publishedOn: (a.published_on ?? 0) * 1000,
      categories: (a.categories ?? '').split('|').map((c: string) => c.trim()).filter(Boolean).slice(0, 4),
    })) as RawArticle[]
  } catch (e) {
    console.warn('[market-news] CryptoCompare failed:', e)
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const results = await Promise.allSettled<RawArticle[]>([
      fetchCryptoCompare(),
      ...RSS_FEEDS.map((f) => fetchRss(f)),
    ])

    const merged: RawArticle[] = []
    const usedSources = new Set<string>()
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.length) {
        merged.push(...r.value)
        r.value.forEach((a) => usedSources.add(a.source))
      }
    }

    // De-dupe by normalised title, keep the newest.
    const byTitle = new Map<string, RawArticle>()
    for (const a of merged) {
      if (!a.title) continue
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
      const existing = byTitle.get(key)
      if (!existing || a.publishedOn > existing.publishedOn) byTitle.set(key, a)
    }

    const articles = Array.from(byTitle.values())
      .filter((a) => a.title && a.url)
      .sort((a, b) => b.publishedOn - a.publishedOn)
      .slice(0, 60)

    const status = articles.length > 0 ? 200 : 502
    return new Response(
      JSON.stringify({ articles, sources: Array.from(usedSources) }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[market-news] Unexpected error:', err)
    return new Response(JSON.stringify({ articles: [], sources: [], error: 'aggregation_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
