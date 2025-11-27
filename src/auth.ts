import { SignJWT, jwtVerify } from 'jose';
import type { Env } from './env';

const ALG = 'HS256';

export async function createAccessToken(env: Env, userId: string) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const jwt = await new SignJWT({ sub: userId, type: 'access' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
  return jwt;
}

export async function createRefreshToken(env: Env, userId: string) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const jwt = await new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  return jwt;
}

export async function verifyToken(env: Env, token: string) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as { sub: string; type: string; iat: number; exp: number };
}
