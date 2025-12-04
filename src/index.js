import { Hono } from 'hono'
import { secureHeaders, rateLimit, requestLogger } from './middleware/security.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { bookRoutes } from './routes/books.js'
import { transactionRoutes } from './routes/transactions.js'
import { analyticsRoutes } from './routes/analytics.js'
import { adminRoutes } from './routes/admin.js'
import { webhookRoutes } from './routes/webhooks.js'
import { healthRoutes } from './routes/health.js'
import { scanRoutes } from './routes/scan.js'

// Base app with /api/v1 prefix
const app = new Hono().basePath('/api/v1')

// Global middlewares
app.use('*', secureHeaders)
app.use('*', requestLogger)
app.use('*', rateLimit)

// Health & docs
app.route('/health', healthRoutes)

app.get('/', (c) => {
  return c.json({
    name: 'Casflo API (rewritten)',
    basePath: '/api/v1',
    status: 'ok',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      users: '/users/*',
      books: '/books/*',
      transactions: '/transactions/*',
      analytics: '/analytics/*',
      admin: '/admin/*',
      webhooks: '/webhooks/*',
      scan: '/scan'
    }
  })
})

// Feature routes
app.route('/auth', authRoutes)
app.route('/users', userRoutes)
app.route('/books', bookRoutes)
app.route('/transactions', transactionRoutes)
app.route('/analytics', analyticsRoutes)
app.route('/admin', adminRoutes)
app.route('/webhooks', webhookRoutes)
app.route('/scan', scanRoutes)

// Error handler (must be last)
app.onError((err, c) => errorHandler(err, c))

export default app

// Durable Object export (for WebSocket etc. if needed later)
export { WebSocketManager } from './durable-objects/websocket-manager.js'
