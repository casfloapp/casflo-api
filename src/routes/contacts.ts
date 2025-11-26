import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { dbAll, dbGet, dbRun } from "../lib/db";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/book/:bookId", requireAuth(), async (c) => {
  const bookId = c.req.param("bookId");
  const rows = await dbAll(c.env, "SELECT * FROM contacts WHERE book_id = ?;", [bookId]);
  return ok(rows);
});

router.post("/", requireAuth(), async (c) => {
  const body = await c.req.json();
  if (!body.book_id || !body.name) return err("Missing", 400);
  const id = uuid();
  await dbRun(c.env, "INSERT INTO contacts (id, book_id, name, phone, description, created_by) VALUES (?, ?, ?, ?, ?, ?);", [id, body.book_id, body.name, body.phone || null, body.description || null, c.get("user").id]);
  const created = await dbGet(c.env, "SELECT * FROM contacts WHERE id = ?;", [id]);
  return ok(created, "Contact created");
});

router.put("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await dbRun(c.env, "UPDATE contacts SET name = ?, phone = ?, description = ? WHERE id = ?;", [body.name, body.phone, body.description, id]);
  return ok(null, "Contact updated");
});

router.delete("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  await dbRun(c.env, "DELETE FROM contacts WHERE id = ?;", [id]);
  return ok(null, "Contact deleted");
});

export default router;
