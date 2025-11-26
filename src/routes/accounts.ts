import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbAll, dbGet, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  const rows = await dbAll(c.env, "SELECT * FROM accounts WHERE book_id = ?;", [c.req.param("bookId")]);
  return ok(rows);
});

router.post("/", requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.name || !body.type) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO accounts (id, book_id, name, type, balance) VALUES (?, ?, ?, ?, ?);", [id, body.book_id, body.name, body.type, body.balance || 0]);
  return ok({ id }, "Account created");
});

router.put("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await dbRun(c.env, "UPDATE accounts SET name = ?, type = ?, balance = ?, is_archived = ? WHERE id = ?;", [body.name, body.type, body.balance, body.is_archived || 0, id]);
  return ok(null, "Account updated");
});

router.delete("/:id", requireAuth(), async (c) => {
  await dbRun(c.env, "DELETE FROM accounts WHERE id = ?;", [c.req.param("id")]);
  return ok(null, "Account deleted");
});

export default router;
