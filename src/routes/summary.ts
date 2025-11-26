import { Hono } from "hono";
import { dbAll } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  try {
    const bookId = c.req.param("bookId");
    const rows = await dbAll(c.env, `
      SELECT s.type, SUM(s.amount) as total
      FROM transactions t
      JOIN transaction_splits s ON s.transaction_id = t.id
      WHERE t.book_id = ?
      GROUP BY s.type
    `, [bookId]);
    let income = 0, expense = 0;
    for (const r of rows) {
      if (r.type === 'DEBIT') expense += Number(r.total);
      else income += Number(r.total);
    }
    return ok({ total_income: income, total_expense: expense, balance: income - expense });
  } catch (e) {
    console.error(e);
    return err("Summary failed", 500);
  }
});

export default router;
