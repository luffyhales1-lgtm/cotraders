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
    const coinglassApiKey = Deno.env.get('COINGLASS_API_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[coinglass-whale-tracker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({ error: 'Missing Supabase server environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!coinglassApiKey) {
      console.error('[coinglass-whale-tracker] Missing COINGLASS_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Missing CoinGlass API key' }),
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

    // Fetch from CoinGlass APIs
    const [hyperliquidResponse, chainResponse] = await Promise.all([
      fetch('https://open-api-v4.coinglass.com/api/hyperliquid/whale-alert', {
        headers: { 'CG-API-KEY': coinglassApiKey },
      }),
      fetch('https://open-api-v4.coinglass.com/api/chain/v2/whale-transfer', {
        headers: { 'CG-API-KEY': coinglassApiKey },
      }),
    ])

    let hyperliquidData: HyperliquidWhaleAlert[] = []
    let chainData: ChainWhaleTransfer[] = []
    let hyperliquidError: string | null = null
    let chainError: string | null = null

    // Process Hyperliquid response
    if (!hyperliquidResponse.ok) {
      hyperliquidError = `Hyperliquid API error: ${hyperliquidResponse.status}`
      console.warn('[coinglass-whale-tracker]', hyperliquidError)
    } else {
      try {
        const hlJson = await hyperliquidResponse.json()
        if (hlJson.code === '0' && Array.isArray(hlJson.data)) {
          hyperliquidData = hlJson.data
        } else {
          hyperliquidError = `Hyperliquid API returned error: ${hlJson.msg || 'Unknown error'}`
          console.warn('[coinglass-whale-tracker]', hyperliquidError)
        }
      } catch (e) {
        hyperliquidError = `Failed to parse Hyperliquid response: ${e}`
        console.warn('[coinglass-whale-tracker]', hyperliquidError)
      }
    }

    // Process Chain response
    if (!chainResponse.ok) {
      chainError = `Chain API error: ${chainResponse.status}`
      console.warn('[coinglass-whale-tracker]', chainError)
    } else {
      try {
        const chainJson = await chainResponse.json()
        if (chainJson.code === '0' && Array.isArray(chainJson.data)) {
          chainData = chainJson.data
        } else {
          // Check if it's a plan restriction error
          if (chainJson.msg && chainJson.msg.includes('plan')) {
            chainError = 'Chain data requires CoinGlass Startup plan or higher'
            console.warn('[coinglass-whale-tracker]', chainError)
          } else {
            chainError = `Chain API returned error: ${chainJson.msg || 'Unknown error'}`
            console.warn('[coinglass-whale-tracker]', chainError)
          }
        }
      } catch (e) {
        chainError = `Failed to parse Chain response: ${e}`
        console.warn('[coinglass-whale-tracker]', chainError)
      }
    }

    // Normalize Hyperliquid data
    const hyperliquidEvents: WhaleEvent[] = hyperliquidData
      .filter(item => !symbolFilter || item.symbol.toUpperCase() === symbolFilter)
      .map(item => {
        const asset = item.symbol.replace('USDT', '')
        const isLong = item.side === 'Long'
        const price = item.mark_price || item.entry_price
        const amount = isLong ? item.size : -item.size
        const usdValue = Math.abs(item.value)
        
        return {
          id: item.id,
          source: 'hyperliquid' as const,
          timestamp: Math.floor(item.timestamp / 1000),
          asset,
          action: isLong ? 'BUY' : 'SELL',
          usdValue,
          amount: Math.abs(amount),
          price,
          wallet: `${item.wallet.slice(0, 6)}...${item.wallet.slice(-4)}`,
          detail: `Leverage: ${item.leverage}x, Liquidation: ${item.liquidation_price}`
        }
      })

    // Normalize Chain data
    const chainEvents: WhaleEvent[] = chainData
      .filter(item => !symbolFilter || item.symbol.toUpperCase() === symbolFilter)
      .map(item => {
        const asset = item.symbol.replace('USDT', '')
        // Determine action based on transfer direction (simplified)
        const action: 'BUY' | 'SELL' | 'TRANSFER' = 'TRANSFER'
        const usdValue = item.usd_value
        const amount = item.amount
        const price = usdValue / amount
        
        return {
          id: item.id,
          source: 'chain' as const,
          timestamp: Math.floor(item.block_timestamp / 1000),
          asset,
          action,
          usdValue,
          amount,
          price,
          wallet: `${item.from.slice(0, 6)}...${item.from.slice(-4)}`,
          detail: `To: ${item.to.slice(0, 6)}...${item.to.slice(-4)}, Tx: ${item.tx_hash.slice(0, 10)}...`
        }
      })

    // Merge and sort events
    const allEvents = [...hyperliquidEvents, ...chainEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60)

    const response = {
      events: allEvents,
      sourceErrors: {
        hyperliquid: hyperliquidError,
        chain: chainError
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