import { Hono } from 'hono'
import { protect } from '../middleware/auth.js'

export const userRoutes = new Hono()

userRoutes.use('*', protect)

userRoutes.get('/', async (c) => {
  return c.json({ users: [], note: 'User list stub' })
})

userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json({ id, note: 'User detail stub' })
})
