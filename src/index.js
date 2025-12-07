import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import { protect } from './middleware/auth.js'; // [BARU] Impor middleware 'protect'
import { processScanRequest } from './lib/gemini.js'; // [BARU] Impor fungsi AI kita

const app = new Hono().basePath('/api/v1');

// Terapkan middleware CORS
app.use('*', cors({
  origin: [
    'https://app.casflo.id', 
    'http://localhost:8787', 
    'http://127.0.0.1:8787' 
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));


// Rute dasar
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'Selamat datang di casflo API v1!',
  });
});

// Mendaftarkan grup rute
app.route('/auth', authRoutes);
app.route('/books', bookRoutes);

// --- [BLOK BARU UNTUK SCAN STRUK] ---
// Endpoint ini akan berada di /api/v1/scan
app.post('/scan', protect, async (c) => {
    try {
        // Panggil fungsi pemroses utama dari gemini.js
        // Kita teruskan 'c' (context) dan 'c.env' (environment)
        const resultData = await processScanRequest(c, c.env);
        
        // Kembalikan data yang sudah diproses ke frontend
        return c.json({ success: true, data: resultData });

    } catch (error) {
        console.error("Error di /api/v1/scan:", error.message);
        return c.json({ error: error.message }, 500);
    }
});
// --- [AKHIR BLOK BARU] ---

// Export aplikasi sebagai default
export default app;