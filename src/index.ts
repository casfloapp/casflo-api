import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getPrisma } from './prisma';
import { createAccessToken, createRefreshToken, verifyToken } from './auth';
import { hashPassword, comparePassword } from './password';
import type { Env } from './env';
import { openApiSpec } from './openapi';

const app = new Hono<{ Bindings: Env }>();

// Middleware: auth
app.use('/users/*', authMiddleware);
app.use('/categories/*', authMiddleware);
app.use('/transactions/*', authMiddleware);
app.use('/reports/*', authMiddleware);

async function authMiddleware(c: any, next: any) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const token = auth.substring('Bearer '.length);
  try {
    const payload = await verifyToken(c.env, token);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    c.set('userId', payload.sub);
    await next();
  } catch (e) {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
}

// Root
app.get('/', (c) => c.json({ ok: true, service: 'casflo-api-worker' }));

// OpenAPI JSON
app.get('/openapi.json', (c) => c.json(openApiSpec));

// Auth: register
app.post('/auth/register', async (c) => {
  const prisma = getPrisma(c.env);
  const body = await c.req.json<{ email: string; password: string; name?: string }>();
  if (!body.email || !body.password) {
    throw new HTTPException(400, { message: 'email & password required' });
  }
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    throw new HTTPException(400, { message: 'Email already registered' });
  }
  const hashed = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: hashed,
      name: body.name ?? null,
    },
  });
  const accessToken = await createAccessToken(c.env, user.id);
  const refreshToken = await createRefreshToken(c.env, user.id);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  return c.json({ accessToken, refreshToken });
});

// Auth: login
app.post('/auth/login', async (c) => {
  const prisma = getPrisma(c.env);
  const body = await c.req.json<{ email: string; password: string }>();
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }
  const match = await comparePassword(body.password, user.password);
  if (!match) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }
  const accessToken = await createAccessToken(c.env, user.id);
  const refreshToken = await createRefreshToken(c.env, user.id);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  return c.json({ accessToken, refreshToken });
});

// Auth: refresh
app.post('/auth/refresh', async (c) => {
  const prisma = getPrisma(c.env);
  const body = await c.req.json<{ refreshToken: string }>();
  if (!body.refreshToken) {
    throw new HTTPException(400, { message: 'refreshToken required' });
  }
  const stored = await prisma.refreshToken.findUnique({ where: { token: body.refreshToken } });
  if (!stored) {
    throw new HTTPException(401, { message: 'Invalid refresh token' });
  }
  const payload = await verifyToken(c.env, body.refreshToken).catch(() => null as any);
  if (!payload || payload.type !== 'refresh') {
    throw new HTTPException(401, { message: 'Invalid refresh token' });
  }
  const accessToken = await createAccessToken(c.env, payload.sub as string);
  const newRefreshToken = await createRefreshToken(c.env, payload.sub as string);
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: payload.sub as string } });
  return c.json({ accessToken, refreshToken: newRefreshToken });
});

// Auth: logout
app.post('/auth/logout', async (c) => {
  const prisma = getPrisma(c.env);
  const body = await c.req.json<{ refreshToken: string }>().catch(() => ({ refreshToken: '' }));
  if (body.refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: body.refreshToken } });
  }
  return c.json({ success: true });
});

// Users: me
app.get('/users/me', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return c.json(user);
});

// Categories CRUD
app.get('/categories', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const list = await prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return c.json(list);
});

app.post('/categories', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ name: string }>();
  if (!body.name) {
    throw new HTTPException(400, { message: 'name required' });
  }
  const cat = await prisma.category.create({
    data: { name: body.name, userId },
  });
  return c.json(cat);
});

app.patch('/categories/:id', async (c) => {
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

app.delete('/categories/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.category.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});

// Transactions CRUD
app.get('/transactions', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const list = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

app.post('/transactions', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const body = await c.req.json<{
    amount: number;
    type: 'income' | 'expense';
    categoryId?: string;
    note?: string;
  }>();
  if (typeof body.amount !== 'number' || !body.type) {
    throw new HTTPException(400, { message: 'amount & type required' });
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

app.get('/transactions/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const tx = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!tx) throw new HTTPException(404, { message: 'Not found' });
  return c.json(tx);
});

app.patch('/transactions/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json<{
    amount?: number;
    type?: 'income' | 'expense';
    categoryId?: string;
    note?: string;
  }>();
  const res = await prisma.transaction.updateMany({
    where: { id, userId },
    data: body,
  });
  return c.json({ updated: res.count });
});

app.delete('/transactions/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const res = await prisma.transaction.deleteMany({
    where: { id, userId },
  });
  return c.json({ deleted: res.count });
});

// Reports
app.get('/reports/summary', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const month = c.req.query('month'); // YYYY-MM
  const where: any = { userId };
  if (month) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const m = Number(monthStr);
    const from = new Date(year, m - 1, 1);
    const to = new Date(year, m, 0, 23, 59, 59);
    where.createdAt = { gte: from, lte: to };
  }
  const tx = await prisma.transaction.findMany({ where });
  const income = tx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = tx.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  return c.json({ income, expense, balance: income - expense });
});

app.get('/reports/category', async (c) => {
  const prisma = getPrisma(c.env);
  const userId = c.get('userId') as string;
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId },
    _sum: { amount: true },
  });
  return c.json(grouped);
});

// Error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
