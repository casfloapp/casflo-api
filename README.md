# Casflo API (NestJS + Prisma + D1)

## Setup

1. Install dependencies

```bash
npm install
```

2. Set environment

Create `.env`:

```bash
DATABASE_URL="file:./dev.db" # for local dev, D1 for production
JWT_SECRET="changeme"
```

3. Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Run dev

```bash
npm run start:dev
```

Then open `http://localhost:3000/docs` for Swagger.

## Deploy to Cloudflare

- Configure `wrangler.toml` with your D1 binding.
- Build:

```bash
npm run build
npx wrangler deploy
```
