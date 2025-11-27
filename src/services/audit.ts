import type { Env } from '../types';
import { truncate } from '../utils/text';

export async function audit(
  env: Env,
  action: string,
  meta?: unknown,
  userId?: string,
) {
  try {
    const metaStr = meta ? truncate(JSON.stringify(meta), 1900) : null;
    await env.DB.prepare(
      "INSERT INTO audit_logs (id, user_id, action, meta, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))",
    )
      .bind(crypto.randomUUID(), userId ?? null, action, metaStr)
      .run();
  } catch (e) {
    // kalau tabel audit_logs belum ada, jangan bikin gagal
    console.error('audit failed (safe to ignore if table missing)', e);
  }
}
