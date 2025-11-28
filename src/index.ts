import { Hono } from "hono";
import type { Env } from "./types";
import { routes } from "./routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/v1", routes);  // ⬅ cukup ini, pastikan `routes` Hono instance

app.get("/", (c) => c.json({ status: "OK", name: "Casflo API Worker v1" }));

export default app;
