import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { dbAll, dbGet, dbRun } from '../lib/db';
import { ok, err } from '../lib/response';
import { requireAuth } from '../middleware/auth';

const router = new Hono();

router.get('/book/:bookId', requireAuth(), async (c) => {
  const bookId = c.req.param('bookId');
  const rows = await dbAll(c.env, 'SELECT * FROM categories WHERE book_id = ?;', [bookId]);
  return ok(rows);
});

router.post('/', requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.name || !body.type) return err('Missing', 400);
  const id = uuid();
  await dbRun(c.env, 'INSERT INTO categories (id, book_id, name, type, icon) VALUES (?, ?, ?, ?, ?);', [id, body.book_id, body.name, body.type, body.icon || null]);
  return ok({ id }, 'Category created');
});

router.put('/:id', requireAuth(), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await dbRun(c.env, 'UPDATE categories SET name = ?, type = ?, icon = ? WHERE id = ?;', [body.name, body.type, body.icon, id]);
  return ok(null, 'Category updated');
});

router.delete('/:id', requireAuth(), async (c) => {
  const id = c.req.param('id');
  await dbRun(c.env, 'DELETE FROM categories WHERE id = ?;', [id]);
  return ok(null, 'Category deleted');
});

export default router;
