import { Hono } from "hono";
import { dbRun, dbGet } from "../lib/db";
import { ok, err } from "../lib/response";
import { v4 as uuid } from "uuid";

const router = new Hono();

router.post("/send", async (c) => {
  const { email } = await c.req.json();
  if (!email) return err("Missing email", 400);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 1000 * 60 * 10).toISOString();
  await dbRun(c.env, "INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?);", [email, code, expires]);
  // TODO: integrate email provider
  return ok({ code }, "Code generated (DEV)");
});

router.post("/check", async (c) => {
  const { email, code } = await c.req.json();
  const row = await dbGet(c.env, "SELECT * FROM verification_codes WHERE email = ?;", [email]);
  if (!row) return err("No code", 400);
  if (row.code !== code) return err("Invalid code", 400);
  if (row.expires_at < new Date().toISOString()) return err("Expired", 400);
  return ok(null, "Verified");
});

export default router;
