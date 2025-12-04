export const secureHeaders = async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  await next()
}

export const requestLogger = async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`[${c.req.method}] ${c.req.url} - ${ms}ms`)
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 120

const store = new Map()

export const rateLimit = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  const record = store.get(ip) || { count: 0, start: now }

  if (now - record.start > WINDOW_MS) {
    record.count = 0
    record.start = now
  }

  record.count += 1
  store.set(ip, record)

  if (record.count > MAX_REQUESTS) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  await next()
}
