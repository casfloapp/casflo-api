import type { Context, Next } from 'hono';

type BucketKey = string;

// simple ephemeral bucket; resets when worker instance recycled
const buckets = new Map<BucketKey, { tokens: number; resetAt: number }>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || 'ip-unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt < now) {
      buckets.set(key, { tokens: options.limit - 1, resetAt: now + options.windowMs });
      return next();
    }
    if (existing.tokens <= 0) {
      const retrySec = Math.ceil((existing.resetAt - now) / 1000);
      c.header('Retry-After', String(retrySec));
      return c.json({ error: 'Too many requests' }, 429);
    }
    existing.tokens -= 1;
    buckets.set(key, existing);
    return next();
  };
}
