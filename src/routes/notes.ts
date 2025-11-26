import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbAll, dbGet, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  const rows = await dbAll(c.env, "SELECT * FROM notes WHERE book_id = ? ORDER BY note_date DESC;", [c.req.param("bookId")]);
  return ok(rows);
});

router.post("/", requireAuth(), async (c) => {
  const b = await c.req.json();
  if (!b.book_id || !b.title || !b.note_date) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO notes (id, book_id, title, content, note_date, created_by) VALUES (?, ?, ?, ?, ?, ?);", [id, b.book_id, b.title, b.content || null, b.note_date, c.get("user").id]);
  return ok({ id }, "Note created");
});

router.put("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json();
  await dbRun(c.env, "UPDATE notes SET title = ?, content = ?, note_date = ?, updated_at = datetime('now','localtime'), updated_by = ? WHERE id = ?;", [b.title, b.content, b.note_date, c.get("user").id, id]);
  return ok(null, "Note updated");
});

router.delete("/:id", requireAuth(), async (c) => {
  await dbRun(c.env, "DELETE FROM notes WHERE id = ?;", [c.req.param("id")]);
  return ok(null, "Note deleted");
});

export default router;
