import { Hono } from 'hono';
import type { Env } from '../../types';
import { validateJson } from '../../middlewares/validator';
import { registerSchema, loginSchema, refreshSchema } from './schema';
import { hashPassword, comparePassword } from '../../utils/password';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../../services/jwt';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/register', validateJson(registerSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof registerSchema._type;

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?',
  )
    .bind(body.email)
    .first<any>();

  if (existing) {
    return c.json({ error: 'Email already registered' }, 400);
  }

  const hashed = await hashPassword(c.env, body.password);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO users (id, full_name, email, hashed_password, created_at) VALUES (?, ?, ?, ?, datetime(\'now\',\'localtime\'))',
  )
    .bind(id, body.full_name, body.email, hashed)
    .run();

  const accessToken = await createAccessToken(c.env, id);
  const refreshToken = await createRefreshToken(c.env, id);

  return c.json({ accessToken, refreshToken });
});

authRoutes.post('/login', validateJson(loginSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof loginSchema._type;

  const user = await c.env.DB.prepare(
    'SELECT id, full_name, email, hashed_password FROM users WHERE email = ?',
  )
    .bind(body.email)
    .first<{ id: string; full_name: string; email: string; hashed_password: string }>();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const ok = await comparePassword(c.env, body.password, user.hashed_password);
  if (!ok) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const accessToken = await createAccessToken(c.env, user.id);
  const refreshToken = await createRefreshToken(c.env, user.id);

  return c.json({ accessToken, refreshToken });
});

authRoutes.post('/refresh', validateJson(refreshSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof refreshSchema._type;

  const payload = await verifyRefreshToken(c.env, body.refreshToken).catch(() => null as any);
  if (!payload || payload.type !== 'refresh') {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
  const accessToken = await createAccessToken(c.env, payload.sub as string);
  const refreshToken = await createRefreshToken(c.env, payload.sub as string);

  return c.json({ accessToken, refreshToken });
});

authRoutes.post('/logout', async (c) => {
  // Stateless JWT → cukup hapus di client
  return c.json({ success: true });
});
