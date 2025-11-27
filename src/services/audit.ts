import type { Env } from '../types';
import { getPrisma } from './db';

export async function audit(env: Env, action: string, meta?: unknown, userId?: string) {
  try {
    const prisma = getPrisma(env);
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        meta: meta ? JSON.stringify(meta).slice(0, 2000) : null,
      },
    });
  } catch (e) {
    console.error('audit failed', e);
  }
}
