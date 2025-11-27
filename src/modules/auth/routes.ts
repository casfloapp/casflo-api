import type { Env } from '../../types';
import { Hono } from 'hono';
import { validateJson } from '../../middlewares/validator';
import { registerSchema, loginSchema, refreshSchema } from './schema';
import { getPrisma } from '../../services/db';
import { hashPassword, comparePassword } from '../../utils/password';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../../services/jwt';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/register', validateJson(registerSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof registerSchema._type;
  const prisma = getPrisma(c.env);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return c.json({ error: 'Email already registered' }, 400);
  }
  const hashed = await hashPassword(c.env, body.password);
  const user = await prisma.user.create({
    data: { email: body.email, password: hashed, name: body.name ?? null },
  });
  const accessToken = await createAccessToken(c.env, user.id);
  const refreshToken = await createRefreshToken(c.env, user.id);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  return c.json({ accessToken, refreshToken });
});

authRoutes.post('/login', validateJson(loginSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof loginSchema._type;
  const prisma = getPrisma(c.env);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  const ok = await comparePassword(c.env, body.password, user.password);
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401);
  const accessToken = await createAccessToken(c.env, user.id);
  const refreshToken = await createRefreshToken(c.env, user.id);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  return c.json({ accessToken, refreshToken });
});

authRoutes.post('/refresh', validateJson(refreshSchema), async (c) => {
  // @ts-ignore
  const body = c.req.valid as typeof refreshSchema._type;
  const prisma = getPrisma(c.env);
  const stored = await prisma.refreshToken.findUnique({ where: { token: body.refreshToken } });
  if (!stored) return c.json({ error: 'Invalid refresh token' }, 401);
  const payload = await verifyRefreshToken(c.env, body.refreshToken).catch(() => null as any);
  if (!payload || payload.type !== 'refresh') {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
  const accessToken = await createAccessToken(c.env, payload.sub as string);
  const newRefreshToken = await createRefreshToken(c.env, payload.sub as string);
  await prisma.refreshToken.create({
    data: { token: newRefreshToken, userId: payload.sub as string },
  });
  return c.json({ accessToken, refreshToken: newRefreshToken });
});

authRoutes.post('/logout', async (c) => {
  const prisma = getPrisma(c.env);
  const body = await c.req.json().catch(() => ({ refreshToken: '' }));
  if (body.refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: body.refreshToken } });
  }
  return c.json({ success: true });
});
