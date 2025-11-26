import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbAll, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  const rows = await dbAll(c.env, "SELECT * FROM reminders WHERE book_id = ?;", [c.req.param("bookId")]);
  return ok(rows);
});

router.post("/", requireAuth(), async (c) => {
  const b = await c.req.json();
  if (!b.book_id || !b.description || !b.reminder_date) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO reminders (id, book_id, description, amount, reminder_date, is_active) VALUES (?, ?, ?, ?, ?, ?);", [id, b.book_id, b.description, b.amount || null, b.reminder_date, b.is_active ?? 1]);
  return ok({ id }, "Reminder created");
});

router.delete("/:id", requireAuth(), async (c) => {
  await dbRun(c.env, "DELETE FROM reminders WHERE id = ?;", [c.req.param("id")]);
  return ok(null, "Reminder deleted");
});

export default router;
