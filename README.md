# Casflo Worker API (Mode D - Gemini + ChatGPT Hybrid)

Cloudflare Worker backend for Casflo-style app:
- Auth (JWT access + refresh)
- Books (instead of wallets)
- Categories
- Transactions + splits
- Receipt scan endpoint with hybrid AI:
  - Google Gemini via REST API (no @google/genai SDK)
  - OpenAI (ChatGPT Vision) via REST API

## Env / Secrets

Set via `npx wrangler secret put` atau via dashboard:

- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- GEMINI_API_KEY
- OPENAI_API_KEY

## D1 Database

Bind: `DB`  
Apply: `migrations/d1-init.sql`

## Run

```bash
bun install   # atau npm install
npx wrangler dev
npx wrangler deploy
```
