import { Hono } from 'hono';
import auth from './routes/auth';
import books from './routes/books';
import categories from './routes/categories';
import transactions from './routes/transactions';
import scan from './routes/scan';

const app = new Hono();

app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', c.req.headers.get('Origin') || '*');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (c.req.method === 'OPTIONS') return c.text('');
  await next();
});

app.get('/health', (c) => c.text('ok'));

app.route('/api/auth', auth);
app.route('/api/books', books);
app.route('/api/categories', categories);
app.route('/api/transactions', transactions);
app.route('/api/scan', scan);

export default {
  fetch: app.fetch,
};
