import { Hono } from "hono";
import { dbAll, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { verifyAccessToken } from "../lib/jwt";
import { v4 as uuid } from "uuid";

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

router.get("/book/:bookId", auth, async (c) => {
  const b = c.req.param("bookId");
  const rows = await dbAll(c.env, "SELECT bm.*, u.full_name, u.email FROM book_members bm LEFT JOIN users u ON u.id = bm.user_id WHERE bm.book_id = ?;", [b]);
  return ok(rows);
});

router.post("/", auth, async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.user_id || !body.role) return err("Missing", 400);
  await dbRun(c.env, "INSERT OR REPLACE INTO book_members (book_id, user_id, role, label) VALUES (?, ?, ?, ?);", [body.book_id, body.user_id, body.role, body.label || null]);
  return ok(null, "Member added");
});

router.delete("/", auth, async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.user_id) return err("Missing", 400);
  await dbRun(c.env, "DELETE FROM book_members WHERE book_id = ? AND user_id = ?;", [body.book_id, body.user_id]);
  return ok(null, "Member removed");
});

export default router;
