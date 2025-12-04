import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'

export const transactionRoutes = new Hono()

transactionRoutes.use('*', protect)

transactionRoutes.get('/', async (c) => {
  return c.json({ transactions: [], note: 'Transaction list stub' })
})
