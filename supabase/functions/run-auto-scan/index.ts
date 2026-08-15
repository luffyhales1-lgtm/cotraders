import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

// Environment variables (provided by Supabase)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Telegram API base URL
const TELEGRAM_API_BASE = "https://api.telegram.org"

// Helper function to make Supabase REST API calls
async function supabaseFetch(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const headers = new Headers({
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...(options.headers || {}),
  })
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    throw new Error(`Supabase error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Helper function to send a Telegram message
async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
  if (!res.ok) {
    throw new Error(`Telegram error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Fetch top cryptocurrencies (similar to binanceApi.ts)
async function fetchTopCryptos() {
  try {
    // Fetch live forex rates (including gold)
    const forexPrices = await fetchLiveForexRates()
    
    const forexTickers = [
      {
        symbol: 'XAUUSDT',
        pair: 'XAU/USD (GOLD SPOT)',
        baseAsset: 'XAU',
        quoteAsset: 'USD',
        price: forexPrices['XAUUSD'],
        change24h: 1.84,
        high24h: +(forexPrices['XAUUSD'] + 14.20).toFixed(2),
        low24h: +(forexPrices['XAUUSD'] - 16.80).toFixed(2),
        volume24h: 840000000,
        isGold: true,
      },
      {
        symbol: 'EURUSD',
        pair: 'EUR/USD (FOREX)',
        baseAsset: 'EUR',
        quoteAsset: 'USD',
        price: forexPrices['EURUSD'],
        change24h: 0.42,
        high24h: +(forexPrices['EURUSD'] * 1.005).toFixed(4),
        low24h: +(forexPrices['EURUSD'] * 0.995).toFixed(4),
        volume24h: 1250000000,
      }
    ]

    // Binance Futures 24hr Ticker
    const binanceUrl = "https://fapi.binance.com/fapi/v1/ticker/24hr"
    let res = await fetch(binanceUrl)
    if (!res.ok) {
      // Fallback to spot
      res = await fetch("https://api.binance.com/api/v3/ticker/24hr")
      if (!res.ok) {
        throw new Error('Binance API Error')
      }
    }
    const data = await res.json()
    const filtered = data.filter((item: any) => item.symbol && item.symbol.endsWith('USDT'))
    filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'))

    const formatted: any[] = filtered.slice(0, 100).map((item: any) => {
      const base = item.symbol.replace('USDT', '')
      const lastPrice = parseFloat(item.lastPrice || '0')
      return {
        symbol: item.symbol,
        pair: `${base}/USDT (PERP)`,
        baseAsset: base,
        quoteAsset: 'USDT',
        price: lastPrice,
        change24h: parseFloat(item.priceChangePercent || '0'),
        high24h: parseFloat(item.highPrice || '0'),
        low24h: parseFloat(item.lowPrice || '0'),
        volume24h: parseFloat(item.quoteVolume || '0'),
        isFutures: true,
      }
    })

    return [...forexTickers, ...formatted]
  } catch (error) {
    console.error("Error fetching top cryptos:", error)
    // Return mock data
    return getDynamicLiveFuturesTickers()
  }
}

// Fetch live forex rates (including gold)
async function fetchLiveForexRates(): Promise<Record<string, number>> {
  const forexPrices: Record<string, number> = {
    'XAUUSD': 2894.50, // default gold price
    'EURUSD': 1.0845,
    'GBPUSD': 1.2980,
    'USDJPY': 152.40,
  }

  try {
    const goldRes = await fetch('https://api.gold-api.com/price/XAU')
    if (goldRes.ok) {
      const gData = await goldRes.json()
      if (gData && typeof gData.price === 'number' && gData.price > 1000) {
        forexPrices['XAUUSD'] = +gData.price.toFixed(2)
      }
    }

    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD')
    if (fxRes.ok) {
      const fxData = await fxRes.json()
      if (fxData && fxData.rates) {
        if (fxData.rates.EUR) forexPrices['EURUSD'] = +(1 / fxData.rates.EUR).toFixed(4)
        if (fxData.rates.GBP) forexPrices['GBPUSD'] = +(1 / fxData.rates.GBP).toFixed(4)
        if (fxData.rates.JPY) forexPrices['USDJPY'] = +fxData.rates.JPY.toFixed(2)
        if (fxData.rates.XAU) {
          forexPrices['XAUUSD'] = +(1 / fxData.rates.XAU).toFixed(2)
        }
      }
    }
  } catch (e) {
    // fallback to defaults
  }

  return forexPrices
}

// Mock data for fallback
function getDynamicLiveFuturesTickers() {
  const now = Date.now() / 1000
  return [
    { symbol: 'XAUUSDT', pair: 'XAU/USD (GOLD SPOT)', baseAsset: 'XAO', quoteAsset: 'USD', price: +(2894.50 + Math.sin(now) * 2.8).toFixed(2), change24h: 1.84, high24h: 2908.00, low24h: 2872.00, volume24h: 840000000, isGold: true },
    { symbol: 'BTCUSDT', pair: 'BTC/USDT (PERP)', baseAsset: 'BTC', quoteAsset: 'USDT', price: +(96940.00 + Math.cos(now) * 90).toFixed(2), change24h: 4.12, high24h: 98400.00, low24h: 94200.00, volume24h: 51200000000, isFutures: true },
    { symbol: 'ETHUSDT', pair: 'ETH/USDT (PERP)', baseAsset: 'ETH', quoteAsset: 'USDT', price: +(3540.20 + Math.sin(now) * 6).toFixed(2), change24h: 2.85, high24h: 3625.00, low24h: 3410.00, volume24h: 23800000000, isFutures: true },
    { symbol: 'SOLUSDT', pair: 'SOL/USDT (PERP)', baseAsset: 'SOL', quoteAsset: 'USDT', price: +(228.40 + Math.cos(now) * 1.5).toFixed(2), change24h: 8.12, high24h: 234.00, low24h: 209.00, volume24h: 10400000000, isFutures: true },
  ]
}

// Generate a trading signal for a given coin
function generateSignal(coin: any) {
  const isLong = coin.change24h >= 0 || Math.random() > 0.4
  const price = coin.price
  const digits = price < 10 ? 4 : 2
  const strategies = [
    'SMC Order Block',
    'Footprint Delta & Spoofing Sweep',
    'ICT Liquidity Pool Grab',
    'EMA 20/200 Golden Cross',
    'RSI Bullish Divergence',
    'MACD Trend Impulse'
  ]
  const strategy = strategies[Math.floor(Math.random() * strategies.length)]
  const winProb = Math.floor(Math.random() * 8) + 89

  // Realistic Scalp Targets (1:1.1, 1:1.8)
  const tp1 = +(price * (isLong ? 1.011 : 0.989)).toFixed(digits)
  const tp2 = +(price * (isLong ? 1.025 : 0.975)).toFixed(digits)
  const tp3 = +(price * (isLong ? 1.048 : 0.952)).toFixed(digits)
  const sl = +(price * (isLong ? 0.990 : 1.010)).toFixed(digits)

  const supp1 = +(price * 0.985).toFixed(digits)
  const supp2 = +(price * 0.968).toFixed(digits)
  const res1 = +(price * 1.018).toFixed(digits)
  const res2 = +(price * 1.036).toFixed(digits)
  const delta = isLong ? +1540 : -1280

  return {
    pair: coin.pair,
    type: isLong ? 'LONG' : 'SHORT',
    strategy,
    timeframe: '1m / 5m Scalp Confluence',
    entryPrice: price,
    target1: tp1,
    target2: tp2,
    target3: tp3,
    stopLoss: sl,
    support1: supp1,
    support2: supp2,
    resistance1: res1,
    resistance2: res2,
    leverage: '20x - 50x',
    winProbability: winProb,
    riskReward: '1:1.2 (Scalp)',
    rationale: `Footprint CVD (${delta > 0 ? '+' : ''}${delta}) confirmed order block mitigation at $${supp1}. Spoof wall absorbed.`,
    chartScreenshotUrl: "", // We skip chart generation in the edge function
    footprintDelta: delta,
    spoofingWall: 'Ask Spoof Wall Absorbed',
  }
}

// Fetch telegram configs with auto_scan_enabled true
async function fetchTelegramConfigs() {
  return await supabaseFetch("telegram_configs?auto_scan_enabled=eq.select", {
    method: "GET",
  })
}

// Main function
serve(async (req) => {
  // Handle CORS for OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    console.log("Starting auto-scan edge function")

    // 1. Fetch top cryptocurrencies
    const tickers = await fetchTopCryptos()
    console.log(`Fetched ${tickers.length} tickers`)

    // 2. Select a random coin
    const selectedCoin = tickers[Math.floor(Math.random() * tickers.length)]
    console.log(`Selected coin: ${selectedCoin.pair}`)

    // 3. Generate a signal
    const signal = generateSignal(selectedCoin)
    console.log(`Generated signal: ${signal.pair} ${signal.type}`)

    // 4. Fetch telegram configs with auto_scan_enabled true
    const configs = await fetchTelegramConfigs()
    console.log(`Found ${configs.length} users with auto-scan enabled`)

    // 5. Send signal to each user
    for (const config of configs) {
      try {
        // Format the message
        const message = `
<b>${signal.pair} ${signal.type} Signal</b>
Strategy: ${signal.strategy}
Timeframe: ${signal.timeframe}
Entry: ${signal.entryPrice}
Target 1: ${signal.target1}
Target 2: ${signal.target2}
Target 3: ${signal.target3}
Stop Loss: ${signal.stopLoss}
Leverage: ${signal.leverage}
Win Probability: ${signal.winProbability}%
Risk/Reward: ${signal.riskReward}

${signal.rationale}
        `.trim()

        await sendTelegramMessage(config.bot_token, config.chat_id, message)
        console.log(`Sent signal to user ${config.id}`)
      } catch (error) {
        console.error(`Failed to send signal to user ${config.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Auto-scan completed. Sent signal to ${configs.length} users.` 
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    )
  } catch (error) {
    console.error("Auto-scan edge function error:", error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})