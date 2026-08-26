# COTRADERS — Edge Functions Setup (News + AI Chart Analysis)

Two Supabase Edge Functions power the new features. Both are already written for
you in `supabase/functions/`. You just need to deploy them (and, for the AI
analyzer, add ONE API key). Everything runs server-side — no secret key ever
ships to the browser.

Your Supabase project ref (from `src/integrations/supabase/client.ts`):
**qslwflcwtpmbiqssjgvu**

---

## 0. One-time: install & link the Supabase CLI

```bash
npm install -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref qslwflcwtpmbiqssjgvu
```

---

## 1. `market-news` — live multi-source news (no key needed)

Aggregates CryptoCompare + CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine,
CryptoSlate and CoinJournal server-side.

```bash
supabase functions deploy market-news
```

That's it. The News page tries this function first and automatically falls back
to a direct CryptoCompare call if it isn't deployed yet, so news works either
way — deploying just gives you many more sources.

---

## 2. `analyze-chart` — AI Chart Screenshot Analysis (needs a vision key)

Pick **one** provider and set its key. Gemini has a generous free tier and is
the cheapest way to start; OpenAI is the most reliable for structured output.

### Option A — Google Gemini (free tier friendly)

Get a key at https://aistudio.google.com/apikey then:

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
supabase functions deploy analyze-chart
```

### Option B — OpenAI (or any OpenAI-compatible provider)

```bash
supabase secrets set OPENAI_API_KEY=sk-your_key_here
supabase functions deploy analyze-chart
```

Optional overrides (only if you want to change the default model or use Groq /
OpenRouter, which are OpenAI-compatible):

```bash
supabase secrets set OPENAI_VISION_MODEL=gpt-4o-mini          # default
# Groq example:
supabase secrets set OPENAI_BASE_URL=https://api.groq.com/openai/v1
supabase secrets set OPENAI_VISION_MODEL=llama-3.2-90b-vision-preview
# Force a provider if you set more than one key:
supabase secrets set AI_PROVIDER=gemini      # or "openai"
```

---

## 3. Verify

- Open the app → **Menu → AI Chart Analysis** (VIP-only; the owner account is
  always VIP/admin).
- Upload a chart screenshot → **Analyze Chart with AI**.
- You should get: a written breakdown, strategies detected, support/resistance,
  Fibonacci, the detected trade, an annotated PNG, and a **Take Paper Trade**
  button that opens the trade in your Paper Journal.

If you see a message about a missing key, re-check step 2 (the secret must be set
in the **same** project you deploy to) and redeploy.

---

## Notes

- The analyzer is intentionally VIP-gated to control API cost — your admin
  account already has full access.
- Nothing is fabricated: if a provider/key is missing the app shows a clear
  error rather than inventing analysis.
- The annotated image and the "AI-estimated" labels make clear these are model
  estimates for education, not financial advice.
