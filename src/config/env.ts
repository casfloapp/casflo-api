import type { Env as CFEnv } from '../types';

export interface EnvConfig {
  accessTokenExpires: string;
  refreshTokenExpiresDays: number;
  jwtSecret: string;
  jwtRefreshSecret: string;
  passwordPepper: string;
  openAiKey?: string;
  geminiKey?: string;
}

export function getEnv(env: CFEnv): EnvConfig {
  const access = env.ACCESS_TOKEN_EXPIRES || '15m';
  const rawDays = env.REFRESH_TOKEN_EXPIRES_DAYS;
  const days = typeof rawDays === 'number' ? rawDays : Number(rawDays || 30);

  return {
    accessTokenExpires: access,
    refreshTokenExpiresDays: Number.isFinite(days) ? days : 30,
    jwtSecret: env.JWT_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
    passwordPepper: env.PASSWORD_PEPPER || '',
    openAiKey: env.OPENAI_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
  };
}
