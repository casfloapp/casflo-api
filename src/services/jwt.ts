import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../types';
import { getEnv } from '../config/env';

const ALG = 'HS256';

export async function createAccessToken(env: Env, userId: string) {
  const cfg = getEnv(env);
  const secret = new TextEncoder().encode(cfg.jwtSecret);
  const jwt = await new SignJWT({ sub: userId, type: 'access' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(cfg.accessTokenExpires)
    .sign(secret);
  return jwt;
}

export async function createRefreshToken(env: Env, userId: string) {
  const cfg = getEnv(env);
  const secret = new TextEncoder().encode(cfg.jwtRefreshSecret);
  const jwt = await new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${cfg.refreshTokenExpiresDays}d`)
    .sign(secret);
  return jwt;
}

export async function verifyAccessToken(env: Env, token: string) {
  const cfg = getEnv(env);
  const secret = new TextEncoder().encode(cfg.jwtSecret);
  const { payload } = await jwtVerify(token, secret);
  return payload as { sub: string; type: string; iat: number; exp: number };
}

export async function verifyRefreshToken(env: Env, token: string) {
  const cfg = getEnv(env);
  const secret = new TextEncoder().encode(cfg.jwtRefreshSecret);
  const { payload } = await jwtVerify(token, secret);
  return payload as { sub: string; type: string; iat: number; exp: number };
}
