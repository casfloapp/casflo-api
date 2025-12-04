import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'
import { processScanRequest } from '../lib/gemini.js'

export const scanRoutes = new Hono()

// POST /api/v1/scan  (protected)
scanRoutes.post('/', protect, async (c) => {
  try {
    const result = await processScanRequest(c)
    return c.json({ success: true, data: result })
  } catch (err) {
    console.error('Error in /scan:', err)
    return c.json({ error: err.message || 'Scan failed' }, 500)
  }
})
