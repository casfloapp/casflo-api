import { Hono } from 'hono';
import type { Env } from '../../types';
import { getPrisma } from '../../services/db';
import { authMiddleware } from '../../middlewares/auth';

export const bookRoutes = new Hono<{ Bindings: Env }>();

bookRoutes.use('*', authMiddleware);

bookRoutes.get('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const list = await prisma.book.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

bookRoutes.post('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ title: string; author?: string; notes?: string }>();
  if (!body.title) return c.json({ error: 'title required' }, 400);
  const book = await prisma.book.create({
    data: { userId, title: body.title, author: body.author ?? null, notes: body.notes ?? null },
  });
  return c.json(book);
});

bookRoutes.patch('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; author?: string; notes?: string }>();
  const res = await prisma.book.updateMany({
    where: { id, userId },
    data: body,
  });
  return c.json({ updated: res.count });
});

bookRoutes.delete('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.book.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});
