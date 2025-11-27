import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const noteRoutes = new Hono<{ Bindings: Env }>();

noteRoutes.use('*', authMiddleware);

noteRoutes.get('/', async (c) => {
  const bookId = c.req.query('book_id');
  if (!bookId) return c.json({ error: 'book_id required' }, 400);
  const result = await c.env.DB.prepare(
    'SELECT id, book_id, title, content, note_date, created_at, updated_at FROM notes WHERE book_id = ? ORDER BY note_date DESC',
  )
    .bind(bookId)
    .all<any>();
  return c.json(result.results);
});

noteRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{
    book_id: string;
    title: string;
    content?: string;
    note_date: string;
  }>();
  if (!body.book_id || !body.title || !body.note_date) {
    return c.json({ error: 'book_id, title, note_date required' }, 400);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO notes (id, book_id, title, content, note_date, created_at, created_by) VALUES (?, ?, ?, ?, ?, datetime(\'now\',\'localtime\'), ?)',
  )
    .bind(
      id,
      body.book_id,
      body.title,
      body.content ?? '',
      body.note_date,
      userId,
    )
    .run();
  return c.json({ id, ...body });
});

noteRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; content?: string; note_date?: string }>();
  await c.env.DB.prepare(
    'UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), note_date = COALESCE(?, note_date), updated_at = datetime(\'now\',\'localtime\'), updated_by = ? WHERE id = ?',
  )
    .bind(
      body.title ?? null,
      body.content ?? null,
      body.note_date ?? null,
      userId,
      id,
    )
    .run();
  return c.json({ updated: true });
});

noteRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});
