import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { processScanRequest } from '../services/scan';

const router = new Hono();

router.post('/', requireAuth(), async (c) => {
  try {
    const result = await processScanRequest(c, c.env);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Error in /api/scan:', err);
    return c.json({ success: false, error: err.message || 'Scan failed' }, 500);
  }
});

export default router;
