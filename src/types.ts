export interface Env {
  DB: D1Database;

  ACCESS_TOKEN_EXPIRES: string;
  REFRESH_TOKEN_EXPIRES_DAYS: number;

  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;

  PASSWORD_PEPPER: string;

  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}
