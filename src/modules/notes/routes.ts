import { Hono } from 'hono';
import type { Env } from '../../types';
import { getPrisma } from '../../services/db';
import { authMiddleware } from '../../middlewares/auth';

export const noteRoutes = new Hono<{ Bindings: Env }>();

noteRoutes.use('*', authMiddleware);

noteRoutes.get('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const list = await prisma.note.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  return c.json(list);
});

noteRoutes.post('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ title: string; content: string }>();
  if (!body.title || !body.content) return c.json({ error: 'title & content required' }, 400);
  const note = await prisma.note.create({
    data: { userId, title: body.title, content: body.content },
  });
  return c.json(note);
});

noteRoutes.patch('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; content?: string }>();
  const res = await prisma.note.updateMany({
    where: { id, userId },
    data: body,
  });
  return c.json({ updated: res.count });
});

noteRoutes.delete('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.note.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});
