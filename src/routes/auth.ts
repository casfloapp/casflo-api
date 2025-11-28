import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { dbGet, dbRun } from '../lib/db';
import { hashPassword, verifyPassword } from '../lib/hash';
import { signAccessToken, signRefreshToken } from '../lib/jwt';
import { ok, err } from '../lib/response';
import { validate } from '../lib/validator';
import { z } from 'zod';

const router = new Hono();

const registerSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const data = validate(registerSchema, body);
    const existing = await dbGet(c.env, 'SELECT id FROM users WHERE email = ?;', [data.email]);
    if (existing) return err('Email already registered', 400);
    const { hash, salt } = await hashPassword(data.password);
    const id = uuid();
    await dbRun(
      c.env,
      'INSERT INTO users (id, full_name, email, hashed_password, salt) VALUES (?, ?, ?, ?, ?);',
      [id, data.full_name, data.email, hash, salt]
    );
    return ok({ id, full_name: data.full_name, email: data.email }, 'User created');
  } catch (e: any) {
    console.error(e);
    if (e?.issues) return err(JSON.stringify(e.issues), 400);
    return err('Registration failed', 500);
  }
});

router.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = validate(loginSchema, body);
    const user: any = await dbGet(c.env, 'SELECT * FROM users WHERE email = ?;', [email]);
    if (!user) return err('Invalid credentials', 401);
    const okPw = await verifyPassword(password, user.hashed_password);
    if (!okPw) return err('Invalid credentials', 401);
    const accessToken = await signAccessToken({ id: user.id }, c.env);
    const refreshToken = await signRefreshToken({ id: user.id }, c.env);
    const rtId = uuid();
    const expiresAt = new Date(
      Date.now() + Number(c.env.REFRESH_TOKEN_EXPIRES_DAYS || 30) * 24 * 3600 * 1000
    ).toISOString();
    await dbRun(
      c.env,
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?);',
      [rtId, user.id, refreshToken, expiresAt]
    );
    const cookie = `refreshToken=${encodeURIComponent(
      refreshToken
    )}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * Number(
      c.env.REFRESH_TOKEN_EXPIRES_DAYS || 30
    )}; SameSite=Strict; Secure`;
    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          accessToken,
          user: { id: user.id, full_name: user.full_name, email: user.email },
        },
        message: 'Logged in',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    );
  } catch (e: any) {
    console.error(e);
    return err('Login failed', 500);
  }
});

router.post('/refresh', async (c) => {
  try {
    const cookie = c.req.headers.get('Cookie') || '';
    const m = cookie.match(/refreshToken=([^;]+)/);
    if (!m) return err('No refresh token', 401);
    const token = decodeURIComponent(m[1]);
    const jwtLib = await import('../lib/jwt');
    const payload: any = await jwtLib.verifyRefreshToken(token, c.env);
    const saved: any = await dbGet(
      c.env,
      'SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0;',
      [token]
    );
    if (!saved) return err('Invalid refresh token', 401);
    if (saved.expires_at < new Date().toISOString()) return err('Refresh token expired', 401);
    await dbRun(c.env, 'UPDATE refresh_tokens SET revoked = 1 WHERE id = ?;', [saved.id]);

    const newRefresh = await jwtLib.signRefreshToken({ id: payload.id }, c.env);
    const newId = uuid();
    const expiresAt = new Date(
      Date.now() + Number(c.env.REFRESH_TOKEN_EXPIRES_DAYS || 30) * 24 * 3600 * 1000
    ).toISOString();
    await dbRun(
      c.env,
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?);',
      [newId, payload.id, newRefresh, expiresAt]
    );
    const accessToken = await jwtLib.signAccessToken({ id: payload.id }, c.env);
    const newCookie = `refreshToken=${encodeURIComponent(
      newRefresh
    )}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * Number(
      c.env.REFRESH_TOKEN_EXPIRES_DAYS || 30
    )}; SameSite=Strict; Secure`;

    return new Response(
      JSON.stringify({
        status: 'success',
        data: { accessToken },
        message: 'Token refreshed',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': newCookie,
        },
      }
    );
  } catch (e: any) {
    console.error(e);
    return err('Refresh failed', 401);
  }
});

router.get('/me', async (c) => {
  try {
    const header = c.req.headers.get('Authorization') || '';
    const m = header.match(/Bearer (.+)/);
    if (!m) return err('No auth', 401);
    const jwtLib = await import('../lib/jwt');
    const payload: any = await jwtLib.verifyAccessToken(m[1], c.env);
    const db = await import('../lib/db');
    const user = await db.dbGet(c.env, 'SELECT id, full_name, email FROM users WHERE id = ?;', [
      payload.id,
    ]);
    return ok(user);
  } catch (e: any) {
    console.error(e);
    return err('Failed', 500);
  }
});

export default router;
