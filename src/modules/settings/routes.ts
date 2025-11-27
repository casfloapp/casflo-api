import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.use('*', authMiddleware);

settingsRoutes.get('/', async (c) => {
  const bookId = c.req.query('book_id');
  if (!bookId) return c.json({ error: 'book_id required' }, 400);
  const row = await c.env.DB.prepare(
    'SELECT book_id, start_of_month, theme, language, haptic_feedback_enabled, calculator_layout, sound_effects_enabled FROM book_settings WHERE book_id = ?',
  )
    .bind(bookId)
    .first<any>();
  return c.json(row || null);
});

settingsRoutes.patch('/', async (c) => {
  const body = await c.req.json<{
    book_id: string;
    start_of_month?: number;
    theme?: string;
    language?: string;
    haptic_feedback_enabled?: number;
    calculator_layout?: string;
    sound_effects_enabled?: number;
  }>();
  if (!body.book_id) return c.json({ error: 'book_id required' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT book_id FROM book_settings WHERE book_id = ?',
  )
    .bind(body.book_id)
    .first<any>();

  if (!existing) {
    await c.env.DB.prepare(
      "INSERT INTO book_settings (book_id, start_of_month, theme, language, haptic_feedback_enabled, calculator_layout, sound_effects_enabled) VALUES (?, COALESCE(?,1), COALESCE(?, 'SYSTEM'), COALESCE(?, 'id-ID'), COALESCE(?,1), COALESCE(?, 'default'), COALESCE(?,1))",
    )
      .bind(
        body.book_id,
        body.start_of_month ?? 1,
        body.theme ?? 'SYSTEM',
        body.language ?? 'id-ID',
        body.haptic_feedback_enabled ?? 1,
        body.calculator_layout ?? 'default',
        body.sound_effects_enabled ?? 1,
      )
      .run();
  } else {
    await c.env.DB.prepare(
      'UPDATE book_settings SET start_of_month = COALESCE(?, start_of_month), theme = COALESCE(?, theme), language = COALESCE(?, language), haptic_feedback_enabled = COALESCE(?, haptic_feedback_enabled), calculator_layout = COALESCE(?, calculator_layout), sound_effects_enabled = COALESCE(?, sound_effects_enabled) WHERE book_id = ?',
    )
      .bind(
        body.start_of_month ?? null,
        body.theme ?? null,
        body.language ?? null,
        body.haptic_feedback_enabled ?? null,
        body.calculator_layout ?? null,
        body.sound_effects_enabled ?? null,
        body.book_id,
      )
      .run();
  }

  return c.json({ success: true });
});
