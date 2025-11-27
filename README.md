# Casflo API - Cloudflare Worker + D1

API keuangan pribadi (mirip casflo) berjalan 100% di Cloudflare Worker, pakai:

- Hono (framework HTTP untuk Worker)
- Cloudflare D1
- Prisma Client Edge + adapter D1
- JWT Access + Refresh
- Endpoint:
  - /auth/register, /auth/login, /auth/refresh, /auth/logout
  - /users/me
  - /categories (CRUD)
  - /transactions (CRUD)
  - /reports/summary, /reports/category
  - /openapi.json (minimal OpenAPI spec)

## Setup Lokal

```bash
npm install
npx prisma generate
```

Buat file `.env` (hanya untuk prisma generate lokal):

```env
DATABASE_URL="file:./dev.db"
```

Lalu:

```bash
npx prisma db push   # hanya jika ingin buat DB lokal baru
```

## Cloudflare D1

- Buat D1 database di Cloudflare Dashboard
- Catat `database_id` dan `database_name`
- Update di `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "casflo"
database_id = "YOUR_D1_ID"
```

Set `JWT_SECRET` di Dashboard (Project → Settings → Variables).

## Dev

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

Worker entry: `src/index.ts` (tidak butuh dist/main.js).
