import { Logger } from '../utils/index.js';
import { ApiResponse, AppError } from '../types/index.js';

// Global error handler
export const errorHandler = (error, c) => {
  const requestId = c.get('requestId');
  const startTime = c.get('startTime');
  const duration = startTime ? Date.now() - startTime : null;
  
  // Log the error
  Logger.error('Request error', error, {
    requestId,
    method: c.req.method,
    url: c.req.url,
    duration: duration ? `${duration}ms` : null,
    userAgent: c.req.header('User-Agent'),
    clientIP: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  });
  
  // Handle different error types
  if (error instanceof AppError) {
    const response = ApiResponse.error(
      error.message,
      error.code,
      error.details,
      error.statusCode
    );
    
    return c.json(response, error.statusCode);
  }
  
  // Handle validation errors from Zod
  if (error.name === 'ZodError') {
    const fieldErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received
    }));
    
    const response = ApiResponse.error(
      'Validation failed',
      'VALIDATION_ERROR',
      { fieldErrors },
      400
    );
    
    return c.json(response, 400);
  }
  
  // Handle JWT errors
  if (error.code === 'JWT_EXPIRED') {
    const response = ApiResponse.error(
      'Token expired',
      'TOKEN_EXPIRED',
      null,
      401
    );
    
    return c.json(response, 401);
  }
  
  if (error.code === 'JWT_INVALID') {
    const response = ApiResponse.error(
      'Invalid token',
      'TOKEN_INVALID',
      null,
      401
    );
    
    return c.json(response, 401);
  }
  
  // Handle database errors
  if (error.message?.includes('UNIQUE constraint failed')) {
    const response = ApiResponse.error(
      'Resource already exists',
      'DUPLICATE_RESOURCE',
      null,
      409
    );
    
    return c.json(response, 409);
  }
  
  if (error.message?.includes('NOT NULL constraint failed')) {
    const response = ApiResponse.error(
      'Required field missing',
      'MISSING_REQUIRED_FIELD',
      null,
      400
    );
    
    return c.json(response, 400);
  }
  
  if (error.message?.includes('FOREIGN KEY constraint failed')) {
    const response = ApiResponse.error(
      'Referenced resource not found',
      'REFERENCE_NOT_FOUND',
      null,
      400
    );
    
    return c.json(response, 400);
  }
  
  // Handle network/timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    const response = ApiResponse.error(
      'Request timeout',
      'TIMEOUT_ERROR',
      null,
      504
    );
    
    return c.json(response, 504);
  }
  
  // Handle rate limiting errors
  if (error.message?.includes('Rate limit')) {
    const response = ApiResponse.error(
      error.message,
      'RATE_LIMIT_EXCEEDED',
      null,
      429
    );
    
    return c.json(response, 429);
  }
  
  // Handle parsing errors
  if (error instanceof SyntaxError && error.message?.includes('JSON')) {
    const response = ApiResponse.error(
      'Invalid JSON format',
      'INVALID_JSON',
      null,
      400
    );
    
    return c.json(response, 400);
  }
  
  // Default error response for production
  if (process?.env?.NODE_ENV === 'production') {
    const response = ApiResponse.error(
      'Internal server error',
      'INTERNAL_ERROR',
      { requestId },
      500
    );
    
    return c.json(response, 500);
  }
  
  // Default error response for development (includes stack trace)
  const response = ApiResponse.error(
    error.message || 'Internal server error',
    'INTERNAL_ERROR',
    {
      requestId,
      stack: error.stack,
      name: error.name
    },
    500
  );
  
  return c.json(response, 500);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn) => {
  return (c, next) => {
    return Promise.resolve(fn(c, next)).catch(next);
  };
};

// Validation error handler
export const handleValidationError = (error, c) => {
  const requestId = c.get('requestId');
  
  Logger.warn('Validation error', error, { requestId });
  
  if (error.errors) {
    const fieldErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received,
      expected: err.expected
    }));
    
    const response = ApiResponse.error(
      'Validation failed',
      'VALIDATION_ERROR',
      { fieldErrors, requestId },
      400
    );
    
    return c.json(response, 400);
  }
  
  const response = ApiResponse.error(
    error.message,
    'VALIDATION_ERROR',
    { requestId },
    400
  );
  
  return c.json(response, 400);
};

// Not found handler
export const notFoundHandler = (c) => {
  const requestId = c.get('requestId');
  const method = c.req.method;
  const path = c.req.path;
  
  Logger.warn('Route not found', {
    requestId,
    method,
    path,
    url: c.req.url
  });
  
  const response = ApiResponse.error(
    `Route ${method} ${path} not found`,
    'NOT_FOUND',
    {
      requestId,
      method,
      path,
      availableEndpoints: [
        '/api/v2/auth',
        '/api/v2/users',
        '/api/v2/books',
        '/api/v2/transactions',
        '/api/v2/analytics',
        '/api/v2/admin',
        '/api/v2/webhooks',
        '/api/v2/health'
      ]
    },
    404
  );
  
  return c.json(response, 404);
};

// Method not allowed handler
export const methodNotAllowedHandler = (c) => {
  const requestId = c.get('requestId');
  const method = c.req.method;
  const path = c.req.path;
  
  Logger.warn('Method not allowed', {
    requestId,
    method,
    path
  });
  
  const response = ApiResponse.error(
    `Method ${method} not allowed for ${path}`,
    'METHOD_NOT_ALLOWED',
    {
      requestId,
      method,
      path,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    405
  );
  
  return c.json(response, 405);
};

// Service unavailable handler
export const serviceUnavailableHandler = (c) => {
  const requestId = c.get('requestId');
  
  Logger.error('Service unavailable', null, { requestId });
  
  const response = ApiResponse.error(
    'Service temporarily unavailable',
    'SERVICE_UNAVAILABLE',
    { requestId },
    503
  );
  
  return c.json(response, 503);
};

// Circuit breaker pattern for external services
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async call(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new AppError('Circuit breaker is OPEN', 'SERVICE_UNAVAILABLE', 503);
      }
    }
    
    try {
      const result = await fn(...args);
      
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = 'CLOSED';
          this.failureCount = 0;
        }
      } else {
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
}

// Retry mechanism
export const withRetry = async (fn, maxAttempts = 3, delay = 1000, backoff = 2) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Don't retry on client errors (4xx)
      if (error.statusCode >= 400 && error.statusCode < 500) {
        break;
      }
      
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      Logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${waitTime}ms`, {
        error: error.message,
        attempt
      });
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

export default {
  errorHandler,
  asyncHandler,
  handleValidationError,
  notFoundHandler,
  methodNotAllowedHandler,
  serviceUnavailableHandler,
  CircuitBreaker,
  withRetry
};