import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { verifyAccessToken } from '../services/jwt';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = auth.substring('Bearer '.length);
  try {
    const payload = await verifyAccessToken(c.env, token);
    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }
    c.set('userId', payload.sub as string);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
