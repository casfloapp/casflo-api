
import { Hono } from 'hono';
import type { Env } from './types';
import { registerRoutes } from './routes';

const app = new Hono<{ Bindings: Env }>();

app.get('/', c => c.json({
  ok: true,
  status: "running",
  prefix: "/v1",
  example: "https://api.casflo.id/v1/auth/login"
}));

app.route('/v1', (v1) => {
  registerRoutes(v1);
});

export default app;
