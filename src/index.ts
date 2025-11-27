import { Hono } from 'hono';
import type { Env } from './types';
import { registerRoutes } from './routes';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.json({ ok: true, service: 'casflo-api-worker', version: '1.0.0' }));

// minimalist OpenAPI-ish description (manual)
app.get('/openapi.json', (c) =>
  c.json({
    openapi: '3.0.0',
    info: {
      title: 'Casflo API Worker',
      version: '1.0.0',
    },
    paths: {
      '/auth/register': { post: { summary: 'Register user' } },
      '/auth/login': { post: { summary: 'Login' } },
      '/auth/refresh': { post: { summary: 'Refresh token' } },
      '/summary/ai/hybrid': { post: { summary: 'Hybrid Gemini + GPT' } },
      '/summary/ai/chatgpt': { post: { summary: 'ChatGPT only' } },
      '/summary/ai/gemini': { post: { summary: 'Gemini only' } }
    },
  }),
);

registerRoutes(app);

export default app;
