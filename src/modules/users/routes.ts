import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';

export const userRoutes = new Hono<{ Bindings: Env }>();

// protected route: get current user profile
userRoutes.use('*', authMiddleware);

userRoutes.get('/me', async (c) => {
  const userId = c.get('userId') as string;
  const row = await c.env.DB.prepare(
    'SELECT id, full_name, email, created_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<any>();

  if (!row) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(row);
});
