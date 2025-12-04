import { Logger, CacheUtils, IdGenerator, StringUtils } from '../utils/index.js';
import { AuthenticationError, AuthorizationError, RateLimitError } from '../types/index.js';

// Security headers middleware
export const secureHeaders = async (c, next) => {
  // Set security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  c.header('Content-Security-Policy', csp);
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  await next();
};

// Request logging middleware
export const requestLogger = async (c, next) => {
  const requestId = IdGenerator.generateRequestId();
  const startTime = Date.now();
  
  c.set('requestId', requestId);
  c.set('startTime', startTime);
  
  const clientIP = c.req.header('CF-Connecting-IP') || 
                   c.req.header('X-Forwarded-For') || 
                   c.req.header('X-Real-IP') || 
                   'unknown';
  
  const userAgent = c.req.header('User-Agent') || 'unknown';
  const method = c.req.method;
  const url = c.req.url;
  
  Logger.info('Request started', {
    requestId,
    method,
    url,
    clientIP: StringUtils.maskIP(clientIP),
    userAgent: userAgent.substring(0, 200),
    timestamp: new Date().toISOString()
  });
  
  await next();
  
  const duration = Date.now() - startTime;
  const status = c.res.status;
  
  Logger.info('Request completed', {
    requestId,
    status,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  });
};

// Rate limiting middleware
export const rateLimit = (options = {}) => {
  return async (c, next) => {
    const {
      windowMs = parseInt(c.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
      maxRequests = parseInt(c.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
      keyGenerator = (c) => {
        const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
        return `rate_limit:${ip}:${c.req.path}`;
      }
    } = options;
    
    const rateLimitKV = c.env.RATE_LIMIT;
    if (!rateLimitKV) {
      // Skip rate limiting if KV is not available
      await next();
      return;
    }
    
    const key = keyGenerator(c);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      // Get current requests
      const existing = await rateLimitKV.get(key);
      let requests = existing ? JSON.parse(existing) : [];
      
      // Clean old requests
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (requests.length >= maxRequests) {
        const resetTime = Math.ceil((requests[0] + windowMs - now) / 1000);
        
        c.header('X-Rate-Limit-Limit', maxRequests);
        c.header('X-Rate-Limit-Remaining', 0);
        c.header('X-Rate-Limit-Reset', resetTime);
        c.header('Retry-After', resetTime);
        
        Logger.warn('Rate limit exceeded', {
          key,
          requests: requests.length,
          maxRequests,
          windowMs,
          resetTime
        });
        
        throw new RateLimitError(`Rate limit exceeded. Try again in ${resetTime} seconds.`);
      }
      
      // Add current request
      requests.push(now);
      
      // Update KV with expiration
      await rateLimitKV.put(key, JSON.stringify(requests), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });
      
      // Set headers
      c.header('X-Rate-Limit-Limit', maxRequests);
      c.header('X-Rate-Limit-Remaining', maxRequests - requests.length);
      c.header('X-Rate-Limit-Reset', Math.ceil((requests[0] + windowMs - now) / 1000));
      
      await next();
      
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      
      // Log error but don't block request if rate limiting fails
      Logger.error('Rate limiting error', error, { key });
      await next();
    }
  };
};

// Authentication middleware
export const authenticate = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    throw new AuthenticationError('Authorization header required');
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Invalid authorization header format');
  }
  
  const token = authHeader.substring(7);
  
  if (!token) {
    throw new AuthenticationError('Token required');
  }
  
  try {
    // Verify JWT token
    const { payload } = await jwtVerify(token, new TextEncoder().encode(c.env.JWT_SECRET));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError('Token expired');
    }
    
    // Get user from cache or database
    const cacheKey = `user:${payload.sub}`;
    let user = await CacheUtils.get(c.env.CACHE, cacheKey);
    
    if (!user) {
      user = await c.env.DB.prepare(
        'SELECT id, email, full_name, avatar_url, role, status, email_verified FROM users WHERE id = ?'
      ).bind(payload.sub).first();
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      // Cache user for 5 minutes
      await CacheUtils.set(c.env.CACHE, cacheKey, user, 300);
    }
    
    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('User account is not active');
    }
    
    // Set user context
    c.set('user', user);
    c.set('userId', user.id);
    c.set('userRole', user.role);
    
    await next();
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    if (error.code === 'JWT_EXPIRED') {
      throw new AuthenticationError('Token expired');
    }
    
    if (error.code === 'JWT_INVALID') {
      throw new AuthenticationError('Invalid token');
    }
    
    Logger.error('Authentication error', error);
    throw new AuthenticationError('Authentication failed');
  }
};

// Authorization middleware factory
export const authorize = (requiredRoles = [], requiredPermissions = []) => {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    
    // Check role-based access
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new AuthorizationError(`Required role: ${requiredRoles.join(' or ')}`);
    }
    
    // Check permission-based access (if implemented)
    if (requiredPermissions.length > 0) {
      // This would require a permissions system
      // For now, only admins can access permission-protected routes
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('Insufficient permissions');
      }
    }
    
    await next();
  };
};

// Book access middleware
export const requireBookAccess = (requiredRole = 'MEMBER') => {
  return async (c, next) => {
    const userId = c.get('userId');
    const bookId = c.req.param('bookId') || c.get('bookId');
    
    if (!userId || !bookId) {
      throw new AuthorizationError('User authentication and book ID required');
    }
    
    // Check user's access to the book
    const membership = await c.env.DB.prepare(`
      SELECT role FROM book_members 
      WHERE book_id = ? AND user_id = ?
    `).bind(bookId, userId).first();
    
    if (!membership) {
      throw new AuthorizationError('Access denied to this book');
    }
    
    // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
    const roleHierarchy = {
      'VIEWER': 1,
      'MEMBER': 2,
      'ADMIN': 3,
      'OWNER': 4
    };
    
    const userRoleLevel = roleHierarchy[membership.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    
    if (userRoleLevel < requiredRoleLevel) {
      throw new AuthorizationError(`Insufficient privileges. Required: ${requiredRole}`);
    }
    
    // Set book context
    c.set('bookId', bookId);
    c.set('bookRole', membership.role);
    
    await next();
  };
};

// API Key authentication middleware
export const authenticateApiKey = async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    throw new AuthenticationError('API key required');
  }
  
  try {
    // Find API key in database
    const keyRecord = await c.env.DB.prepare(`
      SELECT ak.*, u.id as user_id, u.role, u.status
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key = ? AND ak.is_active = 1 AND u.status = 'ACTIVE'
    `).bind(apiKey).first();
    
    if (!keyRecord) {
      throw new AuthenticationError('Invalid API key');
    }
    
    // Check if key has expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      throw new AuthenticationError('API key expired');
    }
    
    // Update last used timestamp
    await c.env.DB.prepare(`
      UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?
    `).bind(keyRecord.id).run();
    
    // Set user context
    c.set('user', {
      id: keyRecord.user_id,
      role: keyRecord.role,
      apiKey: true
    });
    c.set('userId', keyRecord.user_id);
    c.set('userRole', keyRecord.role);
    c.set('apiKeyId', keyRecord.id);
    
    await next();
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    Logger.error('API key authentication error', error);
    throw new AuthenticationError('API key authentication failed');
  }
};

// Webhook signature verification middleware
export const verifyWebhookSignature = async (c, next) => {
  const signature = c.req.header('X-Webhook-Signature');
  const timestamp = c.req.header('X-Webhook-Timestamp');
  
  if (!signature || !timestamp) {
    throw new AuthenticationError('Webhook signature and timestamp required');
  }
  
  // Check timestamp to prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp);
  
  if (Math.abs(now - webhookTime) > 300) { // 5 minutes
    throw new AuthenticationError('Webhook timestamp expired');
  }
  
  try {
    // Get raw body
    const body = await c.req.text();
    const rawBody = new TextEncoder().encode(body);
    
    // Create expected signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(c.env.WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, rawBody);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare signatures
    if (!crypto.subtle.timingSafeEqual(
      new TextEncoder().encode(signature),
      new TextEncoder().append(expectedHex)
    )) {
      throw new AuthenticationError('Invalid webhook signature');
    }
    
    // Set verified body back for other middleware
    c.set('webhookBody', body);
    c.set('webhookVerified', true);
    
    await next();
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    Logger.error('Webhook signature verification error', error);
    throw new AuthenticationError('Webhook signature verification failed');
  }
};

// Input validation middleware
export const validate = (schema, source = 'json') => {
  return async (c, next) => {
    try {
      let data;
      
      switch (source) {
        case 'query':
          data = c.req.query();
          break;
        case 'param':
          data = c.req.param();
          break;
        case 'body':
          data = await c.req.json();
          break;
        default:
          data = await c.req.json();
      }
      
      const validatedData = schema.parse(data);
      c.set('validatedData', validatedData);
      
      await next();
      
    } catch (error) {
      if (error.errors) {
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
        
        throw new ValidationError('Validation failed', null, fieldErrors);
      }
      
      throw new ValidationError(error.message);
    }
  };
};

// Content type validation middleware
export const requireContentType = (allowedTypes = ['application/json']) => {
  return async (c, next) => {
    const contentType = c.req.header('Content-Type');
    
    if (!contentType) {
      throw new ValidationError('Content-Type header required');
    }
    
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      throw new ValidationError(`Content-Type must be one of: ${allowedTypes.join(', ')}`);
    }
    
    await next();
  };
};

// IP whitelist middleware
export const requireWhitelistedIP = (whitelist = []) => {
  return async (c, next) => {
    const clientIP = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     'unknown';
    
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      Logger.warn('IP not whitelisted', { clientIP });
      throw new AuthorizationError('Access denied from this IP address');
    }
    
    await next();
  };
};

// Request size limit middleware
export const limitRequestSize = (maxSize = 10 * 1024 * 1024) => { // 10MB default
  return async (c, next) => {
    const contentLength = c.req.header('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new ValidationError(`Request too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
    }
    
    await next();
  };
};

// Import JWT verification function
import { jwtVerify } from 'jose';

export default {
  secureHeaders,
  requestLogger,
  rateLimit,
  authenticate,
  authorize,
  requireBookAccess,
  authenticateApiKey,
  verifyWebhookSignature,
  validate,
  requireContentType,
  requireWhitelistedIP,
  limitRequestSize
};