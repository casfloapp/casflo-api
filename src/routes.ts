import { Hono } from 'hono';
import type { Env } from './types';
import { authRoutes } from './modules/auth/routes';
import { bookRoutes } from './modules/books/routes';
import { categoryRoutes } from './modules/categories/routes';
import { transactionRoutes } from './modules/transactions/routes';
import { noteRoutes } from './modules/notes/routes';
import { settingsRoutes } from './modules/settings/routes';
import { summaryRoutes } from './modules/summary/routes';
import { rateLimit } from './middlewares/rateLimit';

export function registerRoutes(app: Hono<{ Bindings: Env }>) {
  app.route('/auth', authRoutes);
  app.route('/books', rateLimit({ limit: 60, windowMs: 60_000 }), bookRoutes);
  app.route('/categories', rateLimit({ limit: 60, windowMs: 60_000 }), categoryRoutes);
  app.route('/transactions', rateLimit({ limit: 60, windowMs: 60_000 }), transactionRoutes);
  app.route('/notes', rateLimit({ limit: 60, windowMs: 60_000 }), noteRoutes);
  app.route('/settings', settingsRoutes);
  app.route('/summary', rateLimit({ limit: 30, windowMs: 60_000 }), summaryRoutes);
}
