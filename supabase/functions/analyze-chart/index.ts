import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

/**
 * analyze-chart edge function
 * ---------------------------
 * Receives a chart SCREENSHOT (data-URL / base64) from the app and asks a real
 * vision LLM to read it like a professional price-action / SMC / ICT analyst,
 * returning STRICT JSON: strategies in play, support/resistance, the trade that
 * appears to be taken (entry/SL/targets), Fibonacci levels, and an overall bias.
 *
 * The API key lives ONLY here (server-side) — it is never shipped to the
 * browser. Two provider families are supported so the owner can use whatever
 * they have:
 *   • OpenAI-compatible  (OpenAI, Groq, OpenRouter, Together, ...)
 *       env: OPENAI_API_KEY   [OPENAI_BASE_URL]  [OPENAI_VISION_MODEL]
 *   • Google Gemini
 *       env: GEMINI_API_KEY   [GEMINI_VISION_MODEL]
 *
 * Force a provider with AI_PROVIDER = "openai" | "gemini". Otherwise we prefer
 * OpenAI if its key is present, else Gemini.
 *
 * Set secrets with the Supabase CLI, e.g.:
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *   supabase functions deploy analyze-chart
 * (Gemini is free-tier friendly: supabase secrets set GEMINI_API_KEY=...)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCHEMA_HINT = `Return ONLY a JSON object with EXACTLY this shape (no markdown, no commentary):
{
  "pair": "e.g. BTC/USDT — read it from the chart if visible, else empty string",
  "timeframe": "e.g. 15m, 1h, 4h — read from the chart if visible, else empty string",
  "bias": "LONG | SHORT | NEUTRAL",
  "confidence": 0-100,
  "summary": "3-5 sentence plain-English read of what price is doing and the highest-probability play",
  "priceContext": { "lastPrice": number, "high": number, "low": number },
  "strategies": [
     { "name": "strategy/pattern name", "applied": true/false, "note": "why it does or does not apply here" }
  ],
  "supportLevels":   [ { "price": number, "yRatio": 0..1, "note": "" } ],
  "resistanceLevels":[ { "price": number, "yRatio": 0..1, "note": "" } ],
  "fibonacci": {
     "direction": "up | down",
     "swingHigh": number, "swingLow": number,
     "levels": [ { "label": "0.618", "ratio": 0.618, "price": number, "yRatio": 0..1 } ]
  },
  "detectedTrade": {
     "direction": "LONG | SHORT | NONE",
     "entry": number, "entryYRatio": 0..1,
     "stopLoss": number, "stopYRatio": 0..1,
     "targets": [ { "price": number, "yRatio": 0..1 } ],
     "rationale": "the trade that appears to be taken or the best setup, and why"
  },
  "disclaimer": "one short educational-only line"
}

Rules:
- "yRatio" is the VERTICAL position of that price on the image: 0.0 = very top edge, 1.0 = very bottom edge. Estimate it from where the level visually sits.
- Consider these strategies/concepts and mark which apply: Support/Resistance, Trendline/Channel, Break of Structure (BOS), Change of Character (CHoCH), Order Block (SMC), Fair Value Gap / Imbalance, Liquidity Sweep / stop hunt, Fibonacci retracement (esp. 0.618 golden zone), Supply/Demand zone, EMA/MA trend, RSI/MACD divergence, Bollinger squeeze, Wyckoff, chart patterns (H&S, triangle, flag, double top/bottom), candlestick signals (pin bar, engulfing).
- If the screenshot already shows drawn lines/boxes/arrows, infer the trade the user took from them.
- Give real numeric prices read from the price axis. If a number is genuinely unreadable, estimate and lower "confidence".
- Never invent a trade with no basis: if you cannot see a valid entry/stop, set detectedTrade.direction to "NONE".`

interface Ctx { pair?: string; timeframe?: string; notes?: string }

function buildPrompt(ctx: Ctx): string {
  const hints: string[] = []
  if (ctx.pair) hints.push(`The user says the pair is ${ctx.pair}.`)
  if (ctx.timeframe) hints.push(`The user says the timeframe is ${ctx.timeframe}.`)
  if (ctx.notes) hints.push(`User notes: ${ctx.notes}`)
  return `You are a professional trading analyst specialising in price action, Smart Money Concepts (SMC), ICT, Fibonacci and classic technical analysis. Analyse the attached trading chart screenshot. ${hints.join(' ')}\n\n${SCHEMA_HINT}`
}

/** Pull the first {...} JSON object out of a model response, tolerating fences. */
function extractJson(text: string): any {
  if (!text) throw new Error('empty model response')
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

// -- OpenAI-compatible (OpenAI / Groq / OpenRouter / Together) ---------------
async function callOpenAI(image: string, ctx: Ctx): Promise<any> {
  const key = Deno.env.get('OPENAI_API_KEY')!
  const base = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise trading chart analyst. You always answer with a single valid JSON object and nothing else.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(ctx) },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`vision provider error (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  return extractJson(typeof content === 'string' ? content : JSON.stringify(content))
}

// -- Google Gemini -----------------------------------------------------------
function splitDataUrl(image: string): { mime: string; b64: string } {
  const m = image.match(/^data:([^;]+);base64,(.*)$/s)
  if (m) return { mime: m[1], b64: m[2] }
  return { mime: 'image/png', b64: image } // assume raw base64 PNG
}

async function callGemini(image: string, ctx: Ctx): Promise<any> {
  const key = Deno.env.get('GEMINI_API_KEY')!
  const model = Deno.env.get('GEMINI_VISION_MODEL') || 'gemini-1.5-flash'
  const { mime, b64 } = splitDataUrl(image)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(ctx) },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1800, responseMimeType: 'application/json' },
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`gemini error (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  const content = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? ''
  return extractJson(content)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: jsonHeaders })
    }

    const { image, context } = await req.json().catch(() => ({}))
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "image" (data-URL or base64).' }), { status: 400, headers: jsonHeaders })
    }

    const forced = (Deno.env.get('AI_PROVIDER') || '').toLowerCase()
    const hasOpenAI = !!Deno.env.get('OPENAI_API_KEY')
    const hasGemini = !!Deno.env.get('GEMINI_API_KEY')

    let useGemini: boolean
    if (forced === 'gemini') useGemini = true
    else if (forced === 'openai') useGemini = false
    else useGemini = !hasOpenAI && hasGemini

    if ((useGemini && !hasGemini) || (!useGemini && !hasOpenAI)) {
      return new Response(
        JSON.stringify({
          error:
            'No vision API key configured. In your Supabase project set OPENAI_API_KEY (OpenAI/Groq/OpenRouter) or GEMINI_API_KEY, then redeploy. See SETUP_AI_CHART_ANALYSIS.md.',
        }),
        { status: 503, headers: jsonHeaders },
      )
    }

    const ctx: Ctx = {
      pair: context?.pair?.toString().slice(0, 24),
      timeframe: context?.timeframe?.toString().slice(0, 16),
      notes: context?.notes?.toString().slice(0, 400),
    }

    const analysis = useGemini ? await callGemini(image, ctx) : await callOpenAI(image, ctx)

    return new Response(JSON.stringify({ analysis }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    console.error('[analyze-chart] error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || 'Chart analysis failed. Please try another screenshot.' }),
      { status: 502, headers: jsonHeaders },
    )
  }
})
