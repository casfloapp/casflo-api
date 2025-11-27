# Casflo API - Cloudflare Worker + D1 + Hybrid AI

Struktur:

- `src/index.ts` → Worker entry
- `src/routes.ts` → daftar routes
- `src/config/env.ts` → mapping ENV (ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES_DAYS, JWT_SECRET, JWT_REFRESH_SECRET, PASSWORD_PEPPER, OPENAI_API_KEY, GEMINI_API_KEY)
- `src/middlewares/*` → auth, rate limit, validator (Zod)
- `src/modules/*` → auth, books, categories, transactions, notes, summary (AI), settings
- `src/services/*` → db (Prisma + D1), jwt, audit log
- `src/utils/*` → helper

## Setup lokal

```bash
npm install
npx prisma generate
```

Buat `.env` hanya untuk Prisma lokal:

```env
DATABASE_URL="file:./dev.db"
```

Lalu:

```bash
npx prisma db push   # jika mau DB lokal baru
npm run dev
```

## ENV yang dipakai (Cloudflare Dashboard)

- `ACCESS_TOKEN_EXPIRES` → contoh `15m`
- `REFRESH_TOKEN_EXPIRES_DAYS` → contoh `30`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PASSWORD_PEPPER`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

## D1

Atur di `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "casflo"
database_id = "YOUR_D1_ID"
```

## Endpoint AI

- `POST /summary/ai/hybrid` → otomatis pilih Gemini / GPT
- `POST /summary/ai/chatgpt` → pakai OpenAI saja
- `POST /summary/ai/gemini` → pakai Gemini saja

Body:

```json
{
  "prompt": "tuliskan summary dari catatan ini ...",
  "type": "summary",
  "system": "optional instruction"
}
```
