# AI Trading Terminal — XAUUSD

Standalone private AI Trading Copilot. This repository is independent from Nexora Alpha.

## Current implementation status

- [x] Institutional dark dashboard shell
- [x] Lightweight Charts integration (renders only verified provider candles)
- [x] Market-data API adapter contract
- [x] OpenAI-compatible AI API adapter contract
- [x] Supabase SQL schema with owner-scoped RLS policies
- [ ] Market data provider selected and connected
- [ ] AI model selected and connected
- [ ] Technical detection engine implemented and tested
- [ ] Signal validation and performance evaluation implemented

**Nothing is live by default.** The app intentionally displays NOT CONNECTED / NOT CONFIGURED until real providers are configured. No sample prices, fake win rates, fabricated signals, or broker execution are included.

## 1. Create services

1. Create a new GitHub repository and upload this project's files.
2. Create a new Supabase project. Do not reuse Nexora Alpha's project.
3. In Supabase → SQL Editor, run `supabase/schema.sql`.
4. In Supabase → Authentication, configure your sign-in method and allowed redirect URLs.
5. Import the GitHub repository into Vercel.

## 2. Environment variables

Copy `.env.example` values into Vercel → Project → Settings → Environment Variables. For local development, copy it to `.env.local`.

Required for Supabase browser access:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `MARKET_DATA_API_KEY`, or `AI_API_KEY` in browser code. The current starter does not need the service role key; leave it unset.

## 3. Market data provider contract

Provider is deliberately undecided. `MARKET_DATA_URL` must point to a server-side adapter endpoint that accepts POST JSON:

```json
{ "symbol": "XAUUSD", "timeframe": "M15" }
```

It must return this normalized shape:

```json
{
  "quote": {
    "bid": 2300.10,
    "ask": 2300.35,
    "timestamp": "2026-01-01T10:15:00.000Z",
    "source": "YOUR_PROVIDER"
  },
  "candles": [
    { "time": 1767261600, "open": 2300, "high": 2302, "low": 2298, "close": 2301 }
  ]
}
```

The values above are schema examples only, not current prices. `time` is Unix seconds. Provider terms must allow your intended use and redistribution/display. Check whether the feed is broker-specific, delayed, or licensed for personal use.

The adapter endpoint should be under your control or supplied by a provider. Do not paste a provider secret into frontend code.

## 4. Free AI option: Ollama local

For zero API usage fees, the practical first option is running an open model locally with Ollama on a computer you control.

1. Install Ollama on your own computer from https://ollama.com.
2. Download a model suitable for your hardware using Ollama's official model library.
3. Start the Ollama service and verify its OpenAI-compatible API is available.
4. For local development only, set:
   - `AI_BASE_URL=http://127.0.0.1:11434/v1`
   - `AI_API_KEY=ollama` (placeholder accepted by many local setups)
   - `AI_MODEL=<exact-installed-model-name>`
5. Restart `npm run dev`.

Important: a Vercel deployment cannot reach `127.0.0.1` on your personal computer. To use a local model with a hosted Vercel website, you would need a separately secured, reachable inference service or run the full app locally. Do not expose Ollama publicly without authentication, network restrictions, and a security review. Free hosted model tiers may have quotas and can change.

The AI endpoint is a generic OpenAI-compatible adapter. Confirm your chosen provider supports `/chat/completions` and the request format before connecting it.

## 5. Run locally

Requires a current Node.js LTS release.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Build check:

```bash
npm run build
```

## 6. Deploy

1. Push the repository to GitHub.
2. Import it in Vercel.
3. Add the environment variables.
4. Deploy.
5. Open the deployment and confirm it shows NOT CONNECTED until a real market provider is configured.

## 7. Security notes

- Enable and keep RLS enabled.
- Use Supabase anon/publishable key in browser only with correct RLS policies.
- Never put service-role or provider secrets in `NEXT_PUBLIC_*` variables.
- Restrict Supabase Auth redirect URLs to your real domains.
- Add rate limiting before exposing API endpoints beyond personal use.
- Review provider terms, data licensing, and model terms.
- This starter does not execute trades and is not financial advice.

## 8. Known limitations of this starter

- Authentication client helper and SQL schema are included, but a complete login/logout screen and route protection still need implementation before production.
- Market provider selection and adapter are not included because no provider has been chosen.
- The AI endpoint is a connector, not an AI model. It stays disabled until a compatible model endpoint is configured.
- Technical concepts such as BOS, CHoCH, FVG, liquidity sweep, and order blocks are not yet implemented. Do not interpret the AI text as verified technical detection.
- Signal storage, risk calculations, backtesting, and performance metrics are schema/planning items, not complete features.
