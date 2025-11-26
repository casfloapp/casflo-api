import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbAll, dbGet, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { verifyAccessToken } from "../lib/jwt";

const router = new Hono();
const auth = async (c, next) => { 
  try {
    const header = c.req.headers.get("Authorization") || "";
    const m = header.match(/Bearer (.+)/);
    if (!m) return c.text(JSON.stringify({ status: "error", message: "No auth" }), 401);
    const payload = await verifyAccessToken(m[1], c.env);
    c.set("user", payload);
    await next();
  } catch (e) {
    return c.text(JSON.stringify({ status: "error", message: "Unauthorized" }), 401);
  }
};

router.post("/", auth, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.book_id || !body.transaction_date || !body.created_by) return err("Missing", 400);
    const id = uuid();
    await dbRun(c.env, "INSERT INTO transactions (id, book_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?);", [id, body.book_id, body.contact_id || null, body.description || null, body.transaction_date, body.created_by]);
    if (Array.isArray(body.splits)) {
      for (const s of body.splits) {
        const sid = uuid();
        await dbRun(c.env, "INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type) VALUES (?, ?, ?, ?, ?, ?);", [sid, id, s.account_id, s.category_id || null, s.amount, s.type]);
      }
    }
    return ok({ id }, "Transaction created");
  } catch (e) {
    console.error(e);
    return err("Create tx failed", 500);
  }
});

router.get("/book/:bookId", auth, async (c) => {
  const bids = c.req.param("bookId");
  const rows = await dbAll(c.env, "SELECT * FROM transactions WHERE book_id = ? ORDER BY transaction_date DESC;", [bids]);
  return ok(rows);
});

router.get("/:id", auth, async (c) => {
  const id = c.req.param("id");
  const tx = await dbGet(c.env, "SELECT * FROM transactions WHERE id = ?;", [id]);
  if (!tx) return err("Not found", 404);
  const splits = await dbAll(c.env, "SELECT * FROM transaction_splits WHERE transaction_id = ?;", [id]);
  return ok({ tx, splits });
});

export default router;
