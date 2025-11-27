import { Hono } from 'hono';
import type { Env } from '../../types';
import { getPrisma } from '../../services/db';
import { authMiddleware } from '../../middlewares/auth';

export const transactionRoutes = new Hono<{ Bindings: Env }>();

transactionRoutes.use('*', authMiddleware);

transactionRoutes.get('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const list = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

transactionRoutes.post('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{
    amount: number;
    type: 'income' | 'expense';
    categoryId?: string;
    note?: string;
  }>();
  if (typeof body.amount !== 'number' || !body.type) {
    return c.json({ error: 'amount & type required' }, 400);
  }
  const tx = await prisma.transaction.create({
    data: {
      userId,
      amount: body.amount,
      type: body.type,
      categoryId: body.categoryId,
      note: body.note,
    },
  });
  return c.json(tx);
});

transactionRoutes.get('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) return c.json({ error: 'Not found' }, 404);
  return c.json(tx);
});

transactionRoutes.patch('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  const res = await prisma.transaction.updateMany({
    where: { id, userId },
    data: body,
  });
  return c.json({ updated: res.count });
});

transactionRoutes.delete('/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.transaction.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});
