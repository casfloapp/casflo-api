import { Hono } from 'hono';
import { cache } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const healthRoutes = new Hono();

// Basic health check
healthRoutes.get('/',
  cache(60), // 1 minute cache
  asyncHandler(async (c) => {
    const startTime = Date.now();
    
    // Basic health checks
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      version: c.env.API_VERSION || '2.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      responseTime: 0
    };
    
    // Database connectivity check
    try {
      const dbCheck = await c.env.DB.prepare('SELECT 1 as test').first();
      checks.database = {
        status: dbCheck ? 'connected' : 'disconnected',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      checks.database = {
        status: 'error',
        error: error.message
      };
      checks.status = 'degraded';
    }
    
    // KV connectivity check
    try {
      const testKey = 'health_check_test';
      const testValue = { test: true, timestamp: Date.now() };
      
      await c.env.CACHE.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
      const cached = await c.env.CACHE.get(testKey);
      await c.env.CACHE.delete(testKey);
      
      checks.cache = {
        status: cached ? 'connected' : 'disconnected',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      checks.cache = {
        status: 'error',
        error: error.message
      };
      checks.status = 'degraded';
    }
    
    checks.responseTime = Date.now() - startTime;
    
    // Determine overall status
    if (checks.database.status === 'error' || checks.cache.status === 'error') {
      checks.status = 'unhealthy';
    }
    
    const statusCode = checks.status === 'healthy' ? 200 : 
                      checks.status === 'degraded' ? 200 : 503;
    
    return c.json(checks, statusCode);
  })
);

// Detailed health check
healthRoutes.get('/detailed',
  asyncHandler(async (c) => {
    const startTime = Date.now();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      version: c.env.API_VERSION || '2.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      services: {},
      metrics: {
        responseTime: 0,
        memory: process.memoryUsage ? process.memoryUsage() : null
      }
    };
    
    // Database detailed check
    try {
      const dbStartTime = Date.now();
      
      // Test basic connectivity
      await c.env.DB.prepare('SELECT 1 as test').first();
      
      // Test table existence
      const tables = await c.env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      // Test record counts
      const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
      const bookCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM books').first();
      
      health.services.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
        tables: tables.results?.length || 0,
        records: {
          users: userCount?.count || 0,
          books: bookCount?.count || 0
        }
      };
    } catch (error) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      };
      health.status = 'unhealthy';
    }
    
    // KV detailed check
    try {
      const kvStartTime = Date.now();
      
      // Test write/read/delete
      const testKey = `health_check_${Date.now()}`;
      const testValue = { 
        test: true, 
        timestamp: Date.now(),
        service: 'casflo-api'
      };
      
      await c.env.CACHE.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
      const cached = await c.env.CACHE.get(testKey);
      await c.env.CACHE.delete(testKey);
      
      // Test different KV namespaces if available
      const kvTests = {};
      if (c.env.SESSIONS) {
        await c.env.SESSIONS.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
        kvTests.sessions = 'connected';
        await c.env.SESSIONS.delete(testKey);
      }
      
      if (c.env.RATE_LIMIT) {
        await c.env.RATE_LIMIT.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
        kvTests.rateLimit = 'connected';
        await c.env.RATE_LIMIT.delete(testKey);
      }
      
      health.services.cache = {
        status: cached ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - kvStartTime,
        namespaces: kvTests
      };
    } catch (error) {
      health.services.cache = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      };
      health.status = 'unhealthy';
    }
    
    // External services check
    try {
      const externalStartTime = Date.now();
      
      // Test Google OAuth (if configured)
      const googleCheck = c.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured';
      
      // Test email service (mock check)
      const emailCheck = c.env.EMAIL_FROM ? 'configured' : 'not_configured';
      
      health.services.external = {
        status: 'healthy',
        responseTime: Date.now() - externalStartTime,
        google: googleCheck,
        email: emailCheck
      };
    } catch (error) {
      health.services.external = {
        status: 'degraded',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
    
    health.metrics.responseTime = Date.now() - startTime;
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    return c.json(health, statusCode);
  })
);

// Readiness probe (for Kubernetes/container orchestration)
healthRoutes.get('/ready',
  asyncHandler(async (c) => {
    const checks = {
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Check database
    try {
      await c.env.DB.prepare('SELECT 1 as test').first();
      checks.checks.database = true;
    } catch (error) {
      checks.checks.database = false;
      checks.ready = false;
    }
    
    // Check cache
    try {
      await c.env.CACHE.get('health_check');
      checks.checks.cache = true;
    } catch (error) {
      checks.checks.cache = false;
      checks.ready = false;
    }
    
    const statusCode = checks.ready ? 200 : 503;
    return c.json(checks, statusCode);
  })
);

// Liveness probe (for Kubernetes/container orchestration)
healthRoutes.get('/live',
  asyncHandler(async (c) => {
    return c.json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0
    });
  })
);

// Version information
healthRoutes.get('/version',
  cache(3600), // 1 hour cache
  asyncHandler(async (c) => {
    return c.json({
      version: c.env.API_VERSION || '2.0.0',
      build: {
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT || 'development',
        nodeVersion: process.version,
        platform: process.platform
      },
      dependencies: {
        hono: '4.4.7',
        jose: '5.2.3',
        zod: '3.23.8',
        bcryptjs: '2.4.3'
      }
    });
  })
);

// System metrics
healthRoutes.get('/metrics',
  asyncHandler(async (c) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      memory: process.memoryUsage ? process.memoryUsage() : null,
      cpu: process.cpuUsage ? process.cpuUsage() : null,
      performance: {
        eventLoopUtilization: process.performance?.eventLoopUtilization?.() || null
      }
    };
    
    // Database metrics
    try {
      const dbMetrics = await c.env.DB.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM books) as books,
          (SELECT COUNT(*) FROM transactions) as transactions,
          (SELECT COUNT(*) FROM sessions WHERE expires_at > datetime('now')) as activeSessions
      `).first();
      
      metrics.database = dbMetrics;
    } catch (error) {
      metrics.database = { error: error.message };
    }
    
    // Cache metrics
    try {
      const cacheInfo = await c.env.CACHE.list({ limit: 1 });
      metrics.cache = {
        available: true,
        hasKeys: cacheInfo.keys.length > 0
      };
    } catch (error) {
      metrics.cache = { available: false, error: error.message };
    }
    
    return c.json(metrics);
  })
);

export default healthRoutes;