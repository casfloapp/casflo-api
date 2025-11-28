import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { dbAll, dbRun } from '../lib/db';
import { ok, err } from '../lib/response';
import { requireAuth } from '../middleware/auth';

const router = new Hono();

router.get('/book/:bookId', requireAuth(), async (c) => {
  const bookId = c.req.param('bookId');
  const rows = await dbAll(c.env, 'SELECT * FROM categories WHERE book_id = ?;', [bookId]);
  return ok(rows);
});

router.post('/book/:bookId', requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.name) return err('Missing', 400);
  const id = uuid();
  await dbRun(
    c.env,
    'INSERT INTO categories (id, book_id, name, type, icon) VALUES (?, ?, ?, ?, ?);',
    [id, c.req.param('bookId'), body.name, body.type || 'EXPENSE', body.icon || null]
  );
  return ok({ id }, 'Category created');
});

export default router;
