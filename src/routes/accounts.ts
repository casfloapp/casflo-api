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

router.get("/book/:bookId", auth, async (c) => {
  const rows = await dbAll(c.env, "SELECT * FROM accounts WHERE book_id = ?;", [c.req.param("bookId")]);
  return ok(rows);
});

router.post("/", auth, async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.name || !body.type) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO accounts (id, book_id, name, type, balance) VALUES (?, ?, ?, ?, ?);", [id, body.book_id, body.name, body.type, body.balance || 0]);
  return ok({ id }, "Account created");
});

router.put("/:id", auth, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await dbRun(c.env, "UPDATE accounts SET name = ?, type = ?, balance = ?, is_archived = ? WHERE id = ?;", [body.name, body.type, body.balance, body.is_archived || 0, id]);
  return ok(null, "Account updated");
});

router.delete("/:id", auth, async (c) => {
  await dbRun(c.env, "DELETE FROM accounts WHERE id = ?;", [c.req.param("id")]);
  return ok(null, "Account deleted");
});

export default router;
