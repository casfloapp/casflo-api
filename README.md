# Casflo API Worker (Full, No Prisma)

Cloudflare Worker + D1 (native SQL) + Hybrid AI (Gemini + ChatGPT)

## Fitur

- Auth: register, login, refresh, logout (JWT stateless)
- Books: buku keuangan / modul
- Categories: kategori per buku
- Transactions: pemasukan / pengeluaran
- Notes: catatan per buku
- Settings: `book_settings` per buku
- Summary:
  - `/summary/finance` → income/expense/balance per book
  - `/summary/ai/hybrid` → Gemini+GPT otomatis
  - `/summary/ai/chatgpt` → hanya OpenAI
  - `/summary/ai/gemini` → hanya Gemini

## Struktur

Lihat folder `src/` sesuai yang kamu minta.

## ENV di Cloudflare

Wajib:

- `ACCESS_TOKEN_EXPIRES` (misal `15m`)
- `REFRESH_TOKEN_EXPIRES_DAYS` (misal `30`)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PASSWORD_PEPPER`

Opsional:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

## Deploy

```bash
npm install
npx wrangler deploy
```

Worker akan tersedia di:

- `https://api.casflo.id/` (sesuai routes di wrangler.toml)
