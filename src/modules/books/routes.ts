import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const bookRoutes = new Hono<{ Bindings: Env }>();

bookRoutes.use('*', authMiddleware);

// list books by current user
bookRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const result = await c.env.DB.prepare(
    'SELECT id, name, module_type, created_at, icon FROM books WHERE created_by = ? ORDER BY created_at DESC',
  )
    .bind(userId)
    .all<any>();
  return c.json(result.results);
});

bookRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ name: string; module_type: string; icon?: string }>();
  if (!body.name || !body.module_type) {
    return c.json({ error: 'name & module_type required' }, 400);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO books (id, name, module_type, created_at, created_by, icon) VALUES (?, ?, ?, datetime(\'now\',\'localtime\'), ?, COALESCE(?, \"📚\"))',
  )
    .bind(id, body.name, body.module_type, userId, body.icon ?? '📚')
    .run();
  return c.json({ id, name: body.name, module_type: body.module_type });
});
