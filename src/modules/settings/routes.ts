import { Hono } from 'hono';
import type { Env } from '../../types';
import { getPrisma } from '../../services/db';
import { authMiddleware } from '../../middlewares/auth';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.use('*', authMiddleware);

settingsRoutes.get('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const setting = await prisma.setting.findUnique({ where: { userId } });
  return c.json(setting);
});

settingsRoutes.patch('/', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ theme?: string; language?: string; aiMode?: string }>();
  const existing = await prisma.setting.findUnique({ where: { userId } });
  const setting = existing
    ? await prisma.setting.update({
        where: { userId },
        data: body,
      })
    : await prisma.setting.create({
        data: { userId, ...body },
      });
  return c.json(setting);
});
