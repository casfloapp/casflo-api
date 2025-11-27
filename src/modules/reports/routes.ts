import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';
import { sum } from '../../utils/math';

export const reportsRoutes = new Hono<{ Bindings: Env }>();

reportsRoutes.use('*', authMiddleware);

/**
 * GET /reports/summary?month=YYYY-MM
 * Aggregate income/expense for current user in given month (across all books).
 */
reportsRoutes.get('/summary', async (c) => {
  const userId = c.get('userId') as string;
  const month = c.req.query('month'); // YYYY-MM

  if (!month) {
    return c.json({ error: 'month (YYYY-MM) is required' }, 400);
  }

  // use strftime to filter by year-month
  const rows = await c.env.DB.prepare(
    """SELECT t.type as type, t.amount as amount
         FROM transactions t
         JOIN books b ON t.book_id = b.id
         WHERE b.created_by = ? AND strftime('%Y-%m', t.created_at) = ?""",
  )
    .bind(userId, month)
    .all<{ type: string; amount: number }>();

  const income = sum(
    (rows.results || []).filter((r) => r.type === 'INCOME').map((r) => Number(r.amount)),
  );
  const expense = sum(
    (rows.results || []).filter((r) => r.type === 'EXPENSE').map((r) => Number(r.amount)),
  );

  return c.json({
    month,
    income,
    expense,
    balance: income - expense,
  });
});

/**
 * GET /reports/category?month=YYYY-MM (optional)
 * Aggregate amount per category name for current user.
 */
reportsRoutes.get('/category', async (c) => {
  const userId = c.get('userId') as string;
  const month = c.req.query('month'); // optional YYYY-MM

 let sql = `
  SELECT 
    COALESCE(c.name, 'Uncategorized') AS category,
    SUM(t.amount) AS total
  FROM transactions t
  JOIN books b ON t.book_id = b.id
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE b.created_by = ?
`;

const binds:any[] = [userId];

if (month) {
  sql += ` AND strftime('%Y-%m', t.created_at) = ?`;
  binds.push(month);
}

sql += ` GROUP BY category ORDER BY total DESC`;

const result = await c.env.DB.prepare(sql).bind(...binds).all<any>();
return c.json(result.results);

});
