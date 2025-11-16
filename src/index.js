import { Hono } from 'hono';
import { cors } from 'hono/cors'; // <-- 1. Import middleware CORS
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallets.js';

const app = new Hono().basePath('/api/v1');

// 2. Terapkan middleware CORS di paling atas
// Ini akan berlaku untuk semua rute di bawahnya
app.use('*', cors({
  origin: [
    'https://app.casflo.id', // <-- Izinkan domain frontend produksi Anda
    'http://localhost:8787', // <-- Izinkan untuk testing lokal (opsional)
    'http://127.0.0.1:8787' // <-- Izinkan untuk testing lokal (opsional)
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));


// Rute dasar untuk memastikan worker berjalan
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'Selamat datang di casflo API v1!',
  });
});

// Mendaftarkan grup rute dari file lain
app.route('/auth', authRoutes);
app.route('/wallets', walletRoutes);

// Export aplikasi sebagai default
export default app;
