import { SignJWT, jwtVerify } from "jose";

const encoderText = (s: string) => new TextEncoder().encode(s);

export const signAccessToken = async (payload: object, env: Env) => {
  const secret = encoderText(env.JWT_ACCESS_SECRET);
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(env.ACCESS_TOKEN_EXPIRES || "15m").sign(secret);
};

export const signRefreshToken = async (payload: object, env: Env) => {
  const secret = encoderText(env.JWT_REFRESH_TOKEN || env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET);
  const days = Number(env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${days}d`).sign(secret);
};

export const verifyAccessToken = async (token: string, env: Env) => {
  const secret = encoderText(env.JWT_ACCESS_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as any;
};

export const verifyRefreshToken = async (token: string, env: Env) => {
  const secret = encoderText(env.JWT_REFRESH_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as any;
};
