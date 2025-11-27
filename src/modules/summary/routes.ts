import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';
import { getPrisma } from '../../services/db';
import { monthRange } from '../../utils/date';
import { sum } from '../../utils/math';
import { callHybrid, callOpenAI, callGemini } from '../../services/ai';

export const summaryRoutes = new Hono<{ Bindings: Env }>();

summaryRoutes.use('*', authMiddleware);

// financial summary
summaryRoutes.get('/finance', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const month = c.req.query('month'); // YYYY-MM
  const where: any = { userId };
  if (month) {
    const { from, to } = monthRange(month);
    where.createdAt = { gte: from, lte: to };
  }
  const tx = await prisma.transaction.findMany({ where });
  const income = sum(tx.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sum(tx.filter((t) => t.type === 'expense').map((t) => t.amount));
  return c.json({ income, expense, balance: income - expense });
});

// AI Hybrid summary
summaryRoutes.post('/ai/hybrid', async (c) => {
  const body = await c.req.json<{ prompt: string; type?: 'chat' | 'summary' | 'classification'; system?: string }>();
  const res = await callHybrid(c.env, {
    prompt: body.prompt,
    type: body.type || 'summary',
    system: body.system,
  });
  return c.json(res);
});

// AI OpenAI only
summaryRoutes.post('/ai/chatgpt', async (c) => {
  const body = await c.req.json<{ prompt: string; type?: 'chat' | 'summary' | 'classification'; system?: string }>();
  const res = await callOpenAI(c.env, {
    prompt: body.prompt,
    type: body.type || 'chat',
    system: body.system,
  });
  return c.json(res);
});

// AI Gemini only
summaryRoutes.post('/ai/gemini', async (c) => {
  const body = await c.req.json<{ prompt: string; type?: 'chat' | 'summary' | 'classification'; system?: string }>();
  const res = await callGemini(c.env, {
    prompt: body.prompt,
    type: body.type || 'summary',
    system: body.system,
  });
  return c.json(res);
});
