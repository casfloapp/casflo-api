import { z } from 'zod';

// Common schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const EmailSchema = z.string().email('Invalid email format');
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// User schemas
export const UserRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const UserLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

export const UserUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  avatarUrl: z.string().url('Invalid URL').optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional()
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"]
});

// Book schemas
export const BookCreateSchema = z.object({
  name: z.string().min(1, 'Book name is required'),
  moduleType: z.enum(['FINANCE', 'BUSINESS'], {
    errorMap: () => ({ message: 'Module type must be either FINANCE or BUSINESS' })
  }),
  icon: z.string().emoji().optional().default('📚'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  currency: z.string().length(3).default('IDR'),
  timezone: z.string().default('Asia/Jakarta')
});

export const BookUpdateSchema = z.object({
  name: z.string().min(1, 'Book name is required').optional(),
  icon: z.string().emoji().optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional()
});

export const BookMemberSchema = z.object({
  email: EmailSchema,
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  label: z.string().max(50, 'Label must be less than 50 characters').optional()
});

// Transaction schemas
export const TransactionCreateSchema = z.object({
  bookId: UUIDSchema,
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  transactionDate: z.string().datetime(),
  categoryId: UUIDSchema.optional(),
  accountId: UUIDSchema,
  toAccountId: UUIDSchema.optional(),
  contactId: UUIDSchema.optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  attachments: z.array(z.string().url()).max(5, 'Maximum 5 attachments allowed').optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional()
}).refine((data) => {
  if (data.type === 'TRANSFER' && !data.toAccountId) {
    return false;
  }
  if (data.type !== 'TRANSFER' && data.toAccountId) {
    return false;
  }
  return true;
}, {
  message: "toAccountId is required for TRANSFER type and not allowed for other types",
  path: ["toAccountId"]
});

export const TransactionUpdateSchema = z.object({
  description: z.string().min(1, 'Description is required').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  transactionDate: z.string().datetime().optional(),
  categoryId: UUIDSchema.optional(),
  contactId: UUIDSchema.optional(),
  tags: z.array(z.string()).max(10).optional(),
  attachments: z.array(z.string().url()).max(5).optional(),
  notes: z.string().max(1000).optional()
});

export const TransactionFilterSchema = z.object({
  ...PaginationSchema.shape,
  ...DateRangeSchema.shape,
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId: UUIDSchema.optional(),
  accountId: UUIDSchema.optional(),
  contactId: UUIDSchema.optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional()
});

// Category schemas
export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().emoji().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  parentId: UUIDSchema.optional()
});

export const CategoryUpdateSchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  icon: z.string().emoji().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  isActive: z.boolean().optional()
});

// Account schemas
export const AccountCreateSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY']),
  balance: z.number().default(0),
  currency: z.string().length(3).default('IDR'),
  description: z.string().max(500).optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional()
});

export const AccountUpdateSchema = z.object({
  name: z.string().min(1, 'Account name is required').optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY']).optional(),
  description: z.string().max(500).optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  isActive: z.boolean().optional()
});

// Contact schemas
export const ContactCreateSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  email: EmailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
  company: z.string().optional(),
  notes: z.string().max(1000).optional(),
  isVendor: z.boolean().default(false),
  isCustomer: z.boolean().default(false)
});

export const ContactUpdateSchema = z.object({
  name: z.string().min(1, 'Contact name is required').optional(),
  email: EmailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
  company: z.string().optional(),
  notes: z.string().max(1000).optional(),
  isVendor: z.boolean().optional(),
  isCustomer: z.boolean().optional()
});

// Analytics schemas
export const AnalyticsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  bookId: UUIDSchema,
  groupBy: z.enum(['category', 'account', 'contact', 'day', 'week', 'month']).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'ALL']).default('ALL')
});

// Admin schemas
export const UserAdminUpdateSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  emailVerified: z.boolean().optional()
});

export const SystemConfigSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  description: z.string().optional(),
  isPublic: z.boolean().default(false)
});

// Webhook schemas
export const WebhookCreateSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().min(8, 'Webhook secret must be at least 8 characters'),
  isActive: z.boolean().default(true),
  description: z.string().max(500).optional()
});

export const WebhookUpdateSchema = z.object({
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.string()).min(1, 'At least one event is required').optional(),
  secret: z.string().min(8, 'Webhook secret must be at least 8 characters').optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional()
});

// Parameter schemas
export const IdParamSchema = z.object({
  id: UUIDSchema
});

export const BookIdParamSchema = z.object({
  bookId: UUIDSchema
});

export const TransactionIdParamSchema = z.object({
  transactionId: UUIDSchema
});

// Query schemas
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  ...PaginationSchema.shape
});

// Runtime validation functions
export const validate = (schema, source = 'json') => {
  return async (data) => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error.errors) {
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        throw new ValidationError('Validation failed', null, fieldErrors);
      }
      throw new ValidationError(error.message);
    }
  };
};

export default {
  // Basic schemas
  UUIDSchema,
  EmailSchema,
  PasswordSchema,
  PaginationSchema,
  DateRangeSchema,
  
  // User schemas
  UserRegistrationSchema,
  UserLoginSchema,
  UserUpdateSchema,
  PasswordChangeSchema,
  
  // Book schemas
  BookCreateSchema,
  BookUpdateSchema,
  BookMemberSchema,
  
  // Transaction schemas
  TransactionCreateSchema,
  TransactionUpdateSchema,
  TransactionFilterSchema,
  
  // Category schemas
  CategoryCreateSchema,
  CategoryUpdateSchema,
  
  // Account schemas
  AccountCreateSchema,
  AccountUpdateSchema,
  
  // Contact schemas
  ContactCreateSchema,
  ContactUpdateSchema,
  
  // Analytics schemas
  AnalyticsQuerySchema,
  
  // Admin schemas
  UserAdminUpdateSchema,
  SystemConfigSchema,
  
  // Webhook schemas
  WebhookCreateSchema,
  WebhookUpdateSchema,
  
  // Parameter schemas
  IdParamSchema,
  BookIdParamSchema,
  TransactionIdParamSchema,
  
  // Query schemas
  SearchQuerySchema,
  
  // Validation helper
  validate
};