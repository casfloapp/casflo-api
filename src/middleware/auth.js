import jwt from 'jsonwebtoken'

export const protect = async (c, next) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = jwt.verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch (err) {
    console.error('JWT error:', err)
    return c.json({ error: 'Invalid token' }, 401)
  }
}
