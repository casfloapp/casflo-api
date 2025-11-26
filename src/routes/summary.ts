import { Hono } from "hono";
import { dbAll } from "../lib/db";
import { ok, err } from "../lib/response";

const router = new Hono();
const auth = async (c, next) => { 
  try {
    const header = c.req.headers.get("Authorization") || "";
    const m = header.match(/Bearer (.+)/);
    if (!m) return c.text(JSON.stringify({ status: "error", message: "No auth" }), 401);
    const payload = await import("../lib/jwt").then(m=>m.verifyAccessToken(m[1], c.env));
    c.set("user", payload);
    await next();
  } catch (e) {
    return c.text(JSON.stringify({ status: "error", message: "Unauthorized" }), 401);
  }
};

router.get("/book/:bookId", auth, async (c) => {
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
