import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'

export const analyticsRoutes = new Hono()

analyticsRoutes.use('*', protect)

analyticsRoutes.get('/summary', async (c) => {
  return c.json({
    summary: {
      total_users: 0,
      total_books: 0,
      total_transactions: 0
    },
    note: 'Analytics stub'
  })
})
