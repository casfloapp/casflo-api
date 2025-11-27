import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const categoryRoutes = new Hono<{ Bindings: Env }>();

categoryRoutes.use('*', authMiddleware);

categoryRoutes.get('/', async (c) => {
  const bookId = c.req.query('book_id');
  if (!bookId) return c.json({ error: 'book_id required' }, 400);

  const result = await c.env.DB.prepare(
    'SELECT id, book_id, name, type, icon FROM categories WHERE book_id = ? ORDER BY name ASC',
  )
    .bind(bookId)
    .all<any>();

  return c.json(result.results);
});

categoryRoutes.post('/', async (c) => {
  const body = await c.req.json<{ book_id: string; name: string; type: string; icon?: string }>();
  if (!body.book_id || !body.name || !body.type) {
    return c.json({ error: 'book_id, name, type required' }, 400);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO categories (id, book_id, name, type, icon) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, body.book_id, body.name, body.type, body.icon ?? null)
    .run();
  return c.json({ id, ...body });
});

categoryRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; type?: string; icon?: string }>();

  await c.env.DB.prepare(
    'UPDATE categories SET name = COALESCE(?, name), type = COALESCE(?, type), icon = COALESCE(?, icon) WHERE id = ?',
  )
    .bind(body.name ?? null, body.type ?? null, body.icon ?? null, id)
    .run();

  return c.json({ updated: true });
});

categoryRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});
