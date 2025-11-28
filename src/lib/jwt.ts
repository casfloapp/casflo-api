import { SignJWT, jwtVerify } from 'jose';

const enc = (s = '') => new TextEncoder().encode(s);

export const signAccessToken = async (payload: any, env: Env) => {
  const secret = enc(env.JWT_ACCESS_SECRET || env.JWT_SECRET || '');
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_EXPIRES || '15m')
    .sign(secret);
};

export const signRefreshToken = async (payload: any, env: Env) => {
  const secret = enc(env.JWT_REFRESH_SECRET || env.JWT_SECRET || '');
  const days = Number(env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret);
};

export const verifyAccessToken = async (token: string, env: Env) => {
  const secret = enc(env.JWT_ACCESS_SECRET || env.JWT_SECRET || '');
  const { payload } = await jwtVerify(token, secret);
  return payload;
};

export const verifyRefreshToken = async (token: string, env: Env) => {
  const secret = enc(env.JWT_REFRESH_SECRET || env.JWT_SECRET || '');
  const { payload } = await jwtVerify(token, secret);
  return payload;
};
