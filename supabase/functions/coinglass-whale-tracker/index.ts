import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HyperliquidWhaleAlert {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  size: number
  entry_price: number
  mark_price: number
  leverage: number
  value: number
  timestamp: number
  liquidation_price: number
  wallet: string
}

interface ChainWhaleTransfer {
  id: string
  from: string
  to: string
  symbol: string
  amount: number
  usd_value: number
  block_timestamp: number
  tx_hash: string
}

interface WhaleEvent {
  id: string
  source: 'hyperliquid' | 'chain'
  timestamp: number
  asset: string
  action: 'BUY' | 'SELL' | 'TRANSFER'
  usdValue: number
  amount: number
  price: number
  wallet: string
  detail?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const coinglassApiKey = 'cl_d7956c832867921bed556d842d84f0e0c279f66f6cc15ba0' // Provided API key

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[coinglass-whale-tracker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({ error: 'Missing Supabase server environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get symbol filter from query params or JSON body
    let symbolFilter: string | undefined
    const url = new URL(req.url)
    symbolFilter = url.searchParams.get('symbol')?.toUpperCase()

    if (!symbolFilter) {
      try {
        const body = await req.json()
        symbolFilter = body.symbol?.toUpperCase()
      } catch {
        // Ignore JSON parsing errors
      }
    }

    // Fetch from CoinGlass API using the provided endpoint and API key
    let whaleData: any[] = []
    let whaleError: string | null = null

    try {
      const response = await fetch('https://open-api-v4.coinglass.com/api/public/crypto-whales', {
        headers: { 'CG-API-KEY': coinglassApiKey },
      })

      if (!response.ok) {
        whaleError = `CoinGlass API error: ${response.status}`
        console.warn('[coinglass-whale-tracker]', whaleError)
      } else {
        try {
          const json = await response.json()
          if (json.code === '0' && Array.isArray(json.data)) {
            whaleData = json.data
          } else {
            whaleError = `CoinGlass API returned error: ${json.msg || 'Unknown error'}`
            console.warn('[coinglass-whale-tracker]', whaleError)
          }
        } catch (e) {
          whaleError = `Failed to parse CoinGlass response: ${e}`
          console.warn('[coinglass-whale-tracker]', whaleError)
        }
      }
    } catch (e) {
      whaleError = `Failed to fetch from CoinGlass: ${e}`
      console.warn('[coinglass-whale-tracker]', whaleError)
    }

    // Normalize whale data to our WhaleEvent format
    const events: WhaleEvent[] = whaleData
      .filter(item => !symbolFilter || item.symbol.toUpperCase() === symbolFilter)
      .map(item => {
        const asset = item.symbol.replace('USDT', '')
        const isLong = item.side === 'Long'
        const price = item.entry_price || item.mark_price
        const amount = item.size
        const usdValue = item.value
        const timestamp = Math.floor(item.timestamp / 1000) // Convert to seconds if needed
        const wallet = `${item.wallet.slice(0, 6)}...${item.wallet.slice(-4)}`
        
        return {
          id: `${item.symbol}-${item.timestamp}`, // Generate unique ID
          source: 'chain' as const, // Using chain source for compatibility
          timestamp,
          asset,
          action: isLong ? 'BUY' : 'SELL',
          usdValue,
          amount,
          price,
          wallet,
          detail: `Leverage: ${item.leverage}x, Liquidation: ${item.liquidation_price}`
        }
      })

    // Sort events by timestamp descending and limit to 60
    const sortedEvents = events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60)

    const response = {
      events: sortedEvents,
      sourceErrors: {
        hyperliquid: 'Not implemented (using new CoinGlass endpoint for chain data)',
        chain: whaleError
      },
      fetchedAt: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[coinglass-whale-tracker] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})