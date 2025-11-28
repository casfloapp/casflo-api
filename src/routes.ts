import { Hono } from 'hono';
import type { Env } from './types';

import { authRoutes } from './modules/auth/routes';
import { userRoutes } from './modules/users/routes';
import { bookRoutes } from './modules/books/routes';
import { categoryRoutes } from './modules/categories/routes';
import { transactionRoutes } from './modules/transactions/routes';
import { noteRoutes } from './modules/notes/routes';
import { summaryRoutes } from './modules/summary/routes';
import { settingsRoutes } from './modules/settings/routes';
import { reportsRoutes } from './modules/reports/routes';
import { scanRoutes } from './modules/scan/routes';

export function registerRoutes(app: Hono<{ Bindings: Env }>) {
  app.route('/auth', authRoutes);
  app.route('/users', userRoutes);
  app.route('/books', bookRoutes);
  app.route('/categories', categoryRoutes);
  app.route('/transactions', transactionRoutes);
  app.route('/notes', noteRoutes);
  app.route('/settings', settingsRoutes);
  app.route('/summary', summaryRoutes);
  app.route('/reports', reportsRoutes);
  app.route('/scan', scanRoutes); // OCR/AI RECEIPT
}
