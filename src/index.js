import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { WebSocketManager } from './durable-objects/websocket-manager.js';


// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import bookRoutes from './routes/books.js';
import transactionRoutes from './routes/transactions.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import healthRoutes from './routes/health.js';

const app = new Hono().basePath('/api/v2');

// Security and performance middleware
app.use('*', secureHeaders);
app.use('*', logger());
app.use('*', requestLogger);
app.use('*', rateLimit);

// CORS configuration
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      'https://app.casflo.id',
      'https://casflo.id',
      'http://localhost:3000',
      'http://localhost:8787'
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return true;
    
    return allowedOrigins.includes(origin);
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-API-Key', 
    'X-Request-ID',
    'X-Client-Version'
  ],
  exposeHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  credentials: true,
  maxAge: 86400
}));

// Global error handler
app.onError(errorHandler);

// API Routes
app.route('/auth', authRoutes);
app.route('/users', userRoutes);
app.route('/books', bookRoutes);
app.route('/transactions', transactionRoutes);
app.route('/analytics', analyticsRoutes);
app.route('/admin', adminRoutes);
app.route('/webhooks', webhookRoutes);
app.route('/health', healthRoutes);

// API Documentation endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Casflo API Enterprise',
    version: '2.0.0',
    description: 'Enterprise-grade financial management API',
    environment: c.env.ENVIRONMENT || 'development',
    endpoints: {
      auth: '/auth',
      users: '/users',
      books: '/books',
      transactions: '/transactions',
      analytics: '/analytics',
      admin: '/admin',
      webhooks: '/webhooks',
      health: '/health',
      docs: '/docs'
    },
    documentation: 'https://docs.casflo.id/api/v2',
    status: 'https://status.casflo.id'
  });
});

// API Documentation
app.get('/docs', (c) => {
  return c.json({
    title: 'Casflo API v2 Documentation',
    version: '2.0.0',
    baseUrl: `${c.req.url.split('/api/')[0]}/api/v2`,
    authentication: {
      type: 'Bearer Token',
      description: 'JWT token obtained from /auth/login',
      header: 'Authorization: Bearer <token>'
    },
    rateLimit: {
      window: '15 minutes',
      maxRequests: 1000,
      headers: {
        remaining: 'X-Rate-Limit-Remaining',
        reset: 'X-Rate-Limit-Reset'
      }
    },
    responses: {
      success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string' },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPages: { type: 'number' }
            }
          }
        }
      },
      error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
          requestId: { type: 'string' }
        }
      }
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    requestId: c.get('requestId'),
    availableEndpoints: [
      '/auth',
      '/users',
      '/books',
      '/transactions',
      '/analytics',
      '/admin',
      '/webhooks',
      '/health'
    ]
  }, 404);
});

export default {
  // Add Durable Object export
  async fetch(request, env, ctx) {
    // Check if this is a WebSocket request
    if (request.url.includes('/ws')) {
      const id = env.WEBSOCKET_MANAGER.idFromName('global');
      const stub = env.WEBSOCKET_MANAGER.get(id);
      return stub.fetch(request);
    }
    
    const jwtSecret = env.JWT_SECRET;
    const googleClientSecret = env.GOOGLE_CLIENT_SECRET;
    const encryptionKey = env.ENCRYPTION_KEY;

    // Continue with normal API processing
    return app.fetch(request, env, ctx);
  },
  
  // Durable Object class
  WebSocketManager: WebSocketManager
};