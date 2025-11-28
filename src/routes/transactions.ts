import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { dbAll, dbRun } from '../lib/db';
import { ok, err } from '../lib/response';
import { requireAuth } from '../middleware/auth';

const router = new Hono();

router.post('/book/:bookId', requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const bookId = c.req.param('bookId');
    if (!body.transaction_date) return err('transaction_date required', 400);
    const id = uuid();
    await dbRun(
      c.env,
      'INSERT INTO transactions (id, book_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?);',
      [id, bookId, body.contact_id || null, body.description || null, body.transaction_date, c.get('user').id]
    );
    if (Array.isArray(body.splits)) {
      for (const s of body.splits) {
        const sid = uuid();
        await dbRun(
          c.env,
          'INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type) VALUES (?, ?, ?, ?, ?, ?);',
          [sid, id, s.account_id, s.category_id || null, s.amount, s.type]
        );
      }
    }
    return ok({ id }, 'Transaction created');
  } catch (e: any) {
    console.error(e);
    return err('Create tx failed', 500);
  }
});

router.get('/book/:bookId', requireAuth(), async (c) => {
  const bookId = c.req.param('bookId');
  const rows = await dbAll(
    c.env,
    'SELECT * FROM transactions WHERE book_id = ? ORDER BY transaction_date DESC;',
    [bookId]
  );
  return ok(rows);
});

export default router;
