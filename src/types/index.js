// Core application types and enums
export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

export const BookRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN', 
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER'
};

export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER'
};

export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY'
};

export const CategoryType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
};

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION'
};

export const BookStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED'
};

export const SessionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

// API Response types
export const ApiResponse = {
  success: (data, message = 'Success', meta = {}) => ({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString()
  }),
  
  error: (message, code = 'ERROR', details = null, statusCode = 500) => ({
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString()
  }),
  
  paginated: (data, pagination, message = 'Success') => ({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasNext: pagination.page < pagination.totalPages,
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  })
};

// Custom error classes
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error') {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    this.name = 'ExternalServiceError';
  }
}

// Environment types
export const Environment = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Log levels
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Cache keys
export const CacheKeys = {
  USER: (id) => `user:${id}`,
  BOOK: (id) => `book:${id}`,
  BOOK_MEMBERS: (bookId) => `book:${bookId}:members`,
  TRANSACTIONS: (bookId, filters) => `book:${bookId}:transactions:${JSON.stringify(filters)}`,
  ANALYTICS: (bookId, period) => `book:${bookId}:analytics:${period}`,
  RATE_LIMIT: (ip, endpoint) => `rate_limit:${ip}:${endpoint}`,
  SESSION: (userId, sessionId) => `session:${userId}:${sessionId}`
};

// Webhook events
export const WebhookEvents = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  BOOK_CREATED: 'book.created',
  BOOK_UPDATED: 'book.updated',
  BOOK_DELETED: 'book.deleted',
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_DELETED: 'transaction.deleted',
  MEMBER_ADDED: 'member.added',
  MEMBER_REMOVED: 'member.removed'
};

export default {
  UserRole,
  BookRole,
  TransactionType,
  AccountType,
  CategoryType,
  UserStatus,
  BookStatus,
  SessionStatus,
  ApiResponse,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  Environment,
  LogLevel,
  CacheKeys,
  WebhookEvents
};