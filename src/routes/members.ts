import { Hono } from "hono";
import { dbAll, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { v4 as uuid } from "uuid";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  const b = c.req.param("bookId");
  const rows = await dbAll(c.env, "SELECT bm.*, u.full_name, u.email FROM book_members bm LEFT JOIN users u ON u.id = bm.user_id WHERE bm.book_id = ?;", [b]);
  return ok(rows);
});

router.post("/", requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.user_id || !body.role) return err("Missing", 400);
  await dbRun(c.env, "INSERT OR REPLACE INTO book_members (book_id, user_id, role, label) VALUES (?, ?, ?, ?);", [body.book_id, body.user_id, body.role, body.label || null]);
  return ok(null, "Member added");
});

router.delete("/", requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.user_id) return err("Missing", 400);
  await dbRun(c.env, "DELETE FROM book_members WHERE book_id = ? AND user_id = ?;", [body.book_id, body.user_id]);
  return ok(null, "Member removed");
});

export default router;
