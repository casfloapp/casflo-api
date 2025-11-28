import { Hono } from 'hono';
import type { Env } from './types';
import { registerRoutes } from './routes';

const app = new Hono<{ Bindings: Env }>();

// Prefix API /v1
app.route('/v1', (r) => {
  registerRoutes(r); // ⬅ Jangan return — hanya inject route
});

// Root Check
app.get('/', (c) => c.json({ status: 'OK', service: 'Casflo API Worker v1' }));

export default app;
