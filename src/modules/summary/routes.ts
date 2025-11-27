import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';
import { sum } from '../../utils/math';
import { callHybrid } from '../../ai/hybrid';
import { callOpenAI } from '../../ai/chatgpt';
import { callGemini } from '../../ai/gemini';

export const summaryRoutes = new Hono<{ Bindings: Env }>();

summaryRoutes.use('*', authMiddleware);

// Finance summary: income vs expense per book
summaryRoutes.get('/finance', async (c) => {
  const bookId = c.req.query('book_id');
  if (!bookId) return c.json({ error: 'book_id required' }, 400);

  const rows = await c.env.DB.prepare(
    'SELECT type, amount FROM transactions WHERE book_id = ?',
  )
    .bind(bookId)
    .all<{ type: string; amount: number }>();

  const income = sum(
    (rows.results || []).filter((r) => r.type === 'INCOME').map((r) => Number(r.amount)),
  );
  const expense = sum(
    (rows.results || []).filter((r) => r.type === 'EXPENSE').map((r) => Number(r.amount)),
  );

  return c.json({ income, expense, balance: income - expense });
});

// Hybrid AI endpoint
summaryRoutes.post('/ai/hybrid', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    type?: 'chat' | 'summary' | 'classification';
    system?: string;
  }>();
  if (!body.prompt) return c.json({ error: 'prompt required' }, 400);
  const res = await callHybrid(c.env, {
    prompt: body.prompt,
    type: body.type || 'summary',
    system: body.system,
  });
  return c.json(res);
});

// ChatGPT only
summaryRoutes.post('/ai/chatgpt', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    type?: 'chat' | 'summary' | 'classification';
    system?: string;
  }>();
  if (!body.prompt) return c.json({ error: 'prompt required' }, 400);
  const res = await callOpenAI(c.env, {
    prompt: body.prompt,
    type: body.type || 'chat',
    system: body.system,
  });
  return c.json(res);
});

// Gemini only
summaryRoutes.post('/ai/gemini', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    type?: 'chat' | 'summary' | 'classification';
    system?: string;
  }>();
  if (!body.prompt) return c.json({ error: 'prompt required' }, 400);
  const res = await callGemini(c.env, {
    prompt: body.prompt,
    type: body.type || 'summary',
    system: body.system,
  });
  return c.json(res);
});
