import type { Env } from '../types';
import { getEnv } from '../config/env';

async function hashPasswordInternal(password: string, salt: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt + pepper);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

export async function hashPassword(env: Env, password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const cfg = getEnv(env);
  return hashPasswordInternal(password, salt, cfg.passwordPepper);
}

export async function comparePassword(env: Env, password: string, hashed: string): Promise<boolean> {
  const [salt, hash] = hashed.split(':');
  const cfg = getEnv(env);
  const hashedAttempt = await hashPasswordInternal(password, salt, cfg.passwordPepper);
  return hashedAttempt === hashed;
}
