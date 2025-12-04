import { Hono } from 'hono'
import jwt from 'jsonwebtoken'

export const authRoutes = new Hono()

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  // For now just accept anything and issue dummy token
  const payload = { sub: email, email }
  const token = jwt.sign(payload, c.env.JWT_SECRET, { expiresIn: '7d' })

  return c.json({
    access_token: token,
    token_type: 'Bearer'
  })
})

authRoutes.get('/me', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) return c.json({ user: null }, 200)

  try {
    const decoded = jwt.verify(token, c.env.JWT_SECRET)
    return c.json({ user: decoded })
  } catch {
    return c.json({ user: null }, 200)
  }
})
