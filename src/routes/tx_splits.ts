import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.post("/", requireAuth(), async (c) => {
  const b = await c.req.json();
  if (!b.transaction_id || !b.account_id || !b.amount || !b.type) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type) VALUES (?, ?, ?, ?, ?, ?);", [id, b.transaction_id, b.account_id, b.category_id || null, b.amount, b.type]);
  return ok({ id }, "Split added");
});

router.delete("/:id", requireAuth(), async (c) => {
  await dbRun(c.env, "DELETE FROM transaction_splits WHERE id = ?;", [c.req.param("id")]);
  return ok(null, "Split deleted");
});

export default router;
