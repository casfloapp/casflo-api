import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { callGemini, callChatGPT } from '../services/scan';
import { dbAll } from '../lib/db';

const router = new Hono();

// POST /scan  body: { image: base64, book_id, provider: 'gemini'|'chatgpt' }
router.post('/', requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { image, book_id, provider='gemini' } = body;
    if (!image || !book_id) return c.json({ error: 'image & book_id required' }, 400);

    // load user's expense categories
    const res = await dbAll(c.env, 'SELECT id, name FROM categories WHERE book_id = ? AND type = "EXPENSE";', [book_id]);
    const categories = res || [];

    let scanResult;
    if (provider === 'chatgpt') {
      if (!c.env.OPENAI_API_KEY) return c.json({ error: 'OPENAI_API_KEY not set' }, 500);
      scanResult = await callChatGPT(image, c.env.OPENAI_API_KEY, categories);
    } else {
      if (!c.env.GEMINI_API_KEY) return c.json({ error: 'GEMINI_API_KEY not set' }, 500);
      scanResult = await callGemini(image, c.env.GEMINI_API_KEY, categories);
    }

    return c.json({ success: true, data: scanResult });
  } catch (err) {
    console.error('Error in /scan:', err);
    return c.json({ error: err.message || 'Scan failed' }, 500);
  }
});

export default router;
