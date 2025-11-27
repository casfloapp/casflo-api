import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const transactionRoutes = new Hono<{ Bindings: Env }>();

transactionRoutes.use('*', authMiddleware);

transactionRoutes.get('/', async (c) => {
  const bookId = c.req.query('book_id');
  if (!bookId) return c.json({ error: 'book_id required' }, 400);

  const result = await c.env.DB.prepare(
    'SELECT id, book_id, description, amount, type, category_id, created_at FROM transactions WHERE book_id = ? ORDER BY created_at DESC',
  )
    .bind(bookId)
    .all<any>();

  return c.json(result.results);
});

transactionRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    book_id: string;
    description: string;
    amount: number;
    type: string;
    category_id?: string;
  }>();
  if (!body.book_id || typeof body.amount !== 'number' || !body.type) {
    return c.json({ error: 'book_id, amount, type required' }, 400);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO transactions (id, book_id, description, amount, type, category_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\',\'localtime\'))',
  )
    .bind(
      id,
      body.book_id,
      body.description ?? '',
      body.amount,
      body.type,
      body.category_id ?? null,
    )
    .run();
  return c.json({ id, ...body });
});

transactionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT id, book_id, description, amount, type, category_id, created_at FROM transactions WHERE id = ?',
  )
    .bind(id)
    .first<any>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

transactionRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    description?: string;
    amount?: number;
    type?: string;
    category_id?: string;
  }>();

  await c.env.DB.prepare(
    'UPDATE transactions SET description = COALESCE(?, description), amount = COALESCE(?, amount), type = COALESCE(?, type), category_id = COALESCE(?, category_id) WHERE id = ?',
  )
    .bind(
      body.description ?? null,
      body.amount ?? null,
      body.type ?? null,
      body.category_id ?? null,
      id,
    )
    .run();

  return c.json({ updated: true });
});

transactionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});
