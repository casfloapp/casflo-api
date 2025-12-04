import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'

export const bookRoutes = new Hono()

bookRoutes.use('*', protect)

bookRoutes.get('/', async (c) => {
  return c.json({ books: [], note: 'Book list stub' })
})

bookRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json({ created: body, note: 'Book create stub' }, 201)
})
