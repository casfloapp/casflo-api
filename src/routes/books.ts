import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { dbAll, dbGet, dbRun } from '../lib/db';
import { ok, err } from '../lib/response';
import { requireAuth } from '../middleware/auth';

const router = new Hono();

router.get('/', requireAuth(), async (c) => {
  const user: any = c.get('user');
  const rows = await dbAll(
    c.env,
    `SELECT b.* FROM books b
     LEFT JOIN book_members bm ON bm.book_id = b.id
     WHERE b.created_by = ? OR bm.user_id = ?
     GROUP BY b.id`,
    [user.id, user.id]
  );
  return ok(rows);
});

router.post('/', requireAuth(), async (c) => {
  try {
    const user: any = c.get('user');
    const body = await c.req.json();
    const name = body.name;
    if (!name) return err('Missing name', 400);
    const id = uuid();
    await dbRun(
      c.env,
      'INSERT INTO books (id, name, module_type, created_by, icon) VALUES (?, ?, ?, ?, ?);',
      [id, name, body.module_type || 'GENERAL', user.id, body.icon || '📚']
    );
    await dbRun(
      c.env,
      'INSERT INTO book_members (book_id, user_id, role, label) VALUES (?, ?, "OWNER", ?);',
      [id, user.id, 'Owner']
    );
    const created = await dbGet(c.env, 'SELECT * FROM books WHERE id = ?;', [id]);
    return ok(created, 'Book created');
  } catch (e: any) {
    console.error(e);
    return err('Create book failed', 500);
  }
});

export default router;
