import { Hono } from "hono";
import auth from "./routes/auth";
import books from "./routes/books";
import contacts from "./routes/contacts";
import categories from "./routes/categories";
import members from "./routes/members";
import accounts from "./routes/accounts";
import budgets from "./routes/budgets";
import recurring from "./routes/recurring";
import settings from "./routes/settings";
import transactions from "./routes/transactions";
import tx_splits from "./routes/tx_splits";
import verification from "./routes/verification";
import notes from "./routes/notes";
import summary from "./routes/summary";

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", c.req.headers.get("Origin") || "*");
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (c.req.method === "OPTIONS") return c.text("");
  await next();
});

app.route("/api/auth", auth);
app.route("/api/books", books);
app.route("/api/contacts", contacts);
app.route("/api/categories", categories);
app.route("/api/members", members);
app.route("/api/accounts", accounts);
app.route("/api/budgets", budgets);
app.route("/api/recurring", recurring);
app.route("/api/settings", settings);
app.route("/api/transactions", transactions);
app.route("/api/tx_splits", tx_splits);
app.route("/api/verification", verification);
app.route("/api/notes", notes);
app.route("/api/summary", summary);

export default {
  fetch: app.fetch
};
