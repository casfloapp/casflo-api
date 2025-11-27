import { Hono } from 'hono';
import type { Env } from '../../types';
import { getPrisma } from '../../services/db';
import { authMiddleware } from '../../middlewares/auth';

export const categoryRoutes = new Hono<{ Bindings: Env }>();

categoryRoutes.use('*', authMiddleware);

categoryRoutes.get('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return c.json(categories);
});

categoryRoutes.post('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ name: string }>();
  if (!body.name) return c.json({ error: 'name required' }, 400);
  const cat = await prisma.category.create({
    data: { name: body.name, userId },
  });
  return c.json(cat);
});

categoryRoutes.patch('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<{ name: string }>();
  const res = await prisma.category.updateMany({
    where: { id, userId },
    data: { name: body.name },
  });
  return c.json({ updated: res.count });
});

categoryRoutes.delete('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.category.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});
