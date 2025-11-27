import { Hono } from 'hono';
import type { Env } from './types';
import { registerRoutes } from './routes';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) =>
  c.json({
    ok: true,
    service: 'casflo-api-worker',
    version: '1.0.0',
  }),
);

app.get('/openapi.json', (c) =>
  c.json({
    openapi: '3.0.0',
    info: {
      title: 'Casflo API Worker (no Prisma)',
      version: '1.0.0',
    },
    paths: {
      '/auth/register': { post: { summary: 'Register user' } },
      '/auth/login': { post: { summary: 'Login user' } },
      '/auth/refresh': { post: { summary: 'Refresh JWT' } },
      '/books': { get: { summary: 'List books' }, post: { summary: 'Create book' } },
      '/categories': {
        get: { summary: 'List categories' },
        post: { summary: 'Create category' },
      },
      '/transactions': {
        get: { summary: 'List transactions' },
        post: { summary: 'Create transaction' },
      },
      '/notes': { get: { summary: 'List notes' }, post: { summary: 'Create note' } },
      '/summary/finance': { get: { summary: 'Finance summary per book' } },
      '/summary/ai/hybrid': { post: { summary: 'Hybrid Gemini + GPT' } },
      '/summary/ai/chatgpt': { post: { summary: 'OpenAI only' } },
      '/summary/ai/gemini': { post: { summary: 'Gemini only' } },
    },
  }),
);

registerRoutes(app);

export default app;
