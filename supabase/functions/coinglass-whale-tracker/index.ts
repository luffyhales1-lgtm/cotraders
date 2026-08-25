import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

// ⚠️ DEPRECATED — this function is no longer used.
//
// The whale tracker now runs 100% client-side against Hyperliquid's FREE public
// WebSocket API (see src/services/whaleTrackerApi.ts). It requires no API key
// and no server cost. The previous implementation called a paid CoinGlass
// endpoint and — critically — had an API key hardcoded in source. That key has
// been removed. This stub is kept only so any stale deployment stops returning
// data and callers fall back to the client-side stream.
//
// If you ever re-introduce a server-side provider, read the key from
// Deno.env.get('...') — never hardcode secrets in this file.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      events: [],
      sourceErrors: {
        hyperliquid: null,
        chain: 'This edge function is deprecated — whale data now streams client-side from Hyperliquid.',
      },
      fetchedAt: new Date().toISOString(),
      deprecated: true,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
