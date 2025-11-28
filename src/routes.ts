import { Hono } from "hono";
import type { Env } from "./types";

// import semua modules (pastikan tiap routes.ts export Hono)
import { authRoutes } from "./modules/auth/routes";
import { userRoutes } from "./modules/users/routes";
import { bookRoutes } from "./modules/books/routes";
import { categoryRoutes } from "./modules/categories/routes";
import { transactionRoutes } from "./modules/transactions/routes";
import { noteRoutes } from "./modules/notes/routes";
import { summaryRoutes } from "./modules/summary/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { reportsRoutes } from "./modules/reports/routes";
import { scanRoutes } from "./modules/scan/routes";

export const routes = new Hono<{ Bindings: Env }>();

routes.route("/auth", authRoutes);
routes.route("/users", userRoutes);
routes.route("/books", bookRoutes);
routes.route("/categories", categoryRoutes);
routes.route("/transactions", transactionRoutes);
routes.route("/notes", noteRoutes);
routes.route("/summary", summaryRoutes);
routes.route("/settings", settingsRoutes);
routes.route("/reports", reportsRoutes);
routes.route("/scan", scanRoutes);
