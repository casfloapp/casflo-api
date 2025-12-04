import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'

export const adminRoutes = new Hono()

adminRoutes.use('*', protect)

adminRoutes.get('/stats', async (c) => {
  return c.json({ note: 'Admin stats stub' })
})
