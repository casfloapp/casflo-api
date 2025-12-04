import { Hono } from 'hono';
import { authenticate, authorize, validate } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AdminModel } from '../models/admin.js';
import {
  PaginationSchema,
  SystemConfigSchema,
  WebhookCreateSchema,
  WebhookUpdateSchema,
  IdParamSchema
} from '../types/schemas.js';

const adminRoutes = new Hono();

// System overview
adminRoutes.get('/overview',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const overview = await adminModel.getSystemOverview();
    
    return c.json({
      success: true,
      data: { overview }
    });
  })
);

// User management
adminRoutes.get('/users',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { page, limit, search, role, status } = c.get('validatedData');
    
    const result = await adminModel.getUsers({
      page,
      limit,
      search,
      role,
      status
    });
    
    return c.json({
      success: true,
      data: result
    });
  })
);

adminRoutes.get('/users/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const user = await adminModel.getUserById(id);
    
    return c.json({
      success: true,
      data: { user }
    });
  })
);

adminRoutes.put('/users/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const updateData = await c.req.json();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const user = await adminModel.updateUser(id, updateData);
    
    return c.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  })
);

adminRoutes.post('/users/:id/suspend',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const { reason, duration } = await c.req.json();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.suspendUser(id, { reason, duration });
    
    return c.json({
      success: true,
      message: 'User suspended successfully',
      data: result
    });
  })
);

adminRoutes.post('/users/:id/unsuspend',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.unsuspendUser(id);
    
    return c.json({
      success: true,
      message: 'User unsuspended successfully',
      data: result
    });
  })
);

// Book management
adminRoutes.get('/books',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { page, limit, search, status, moduleType } = c.get('validatedData');
    
    const result = await adminModel.getBooks({
      page,
      limit,
      search,
      status,
      moduleType
    });
    
    return c.json({
      success: true,
      data: result
    });
  })
);

adminRoutes.get('/books/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const book = await adminModel.getBookById(id);
    
    return c.json({
      success: true,
      data: { book }
    });
  })
);

adminRoutes.post('/books/:id/archive',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const { reason } = await c.req.json();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.archiveBook(id, { reason });
    
    return c.json({
      success: true,
      message: 'Book archived successfully',
      data: result
    });
  })
);

// System configuration
adminRoutes.get('/config',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const config = await adminModel.getSystemConfig();
    
    return c.json({
      success: true,
      data: { config }
    });
  })
);

adminRoutes.put('/config',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(SystemConfigSchema),
  asyncHandler(async (c) => {
    const configData = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const config = await adminModel.updateSystemConfig(configData);
    
    return c.json({
      success: true,
      message: 'System configuration updated successfully',
      data: { config }
    });
  })
);

adminRoutes.post('/config/:key/reset',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const { key } = c.req.param();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.resetConfigKey(key);
    
    return c.json({
      success: true,
      message: 'Configuration key reset successfully',
      data: result
    });
  })
);

// Webhook management
adminRoutes.get('/webhooks',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { page, limit, search, isActive } = c.get('validatedData');
    
    const result = await adminModel.getWebhooks({
      page,
      limit,
      search,
      isActive
    });
    
    return c.json({
      success: true,
      data: result
    });
  })
);

adminRoutes.post('/webhooks',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(WebhookCreateSchema),
  asyncHandler(async (c) => {
    const webhookData = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const webhook = await adminModel.createWebhook(webhookData);
    
    return c.json({
      success: true,
      message: 'Webhook created successfully',
      data: { webhook }
    }, 201);
  })
);

adminRoutes.get('/webhooks/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const webhook = await adminModel.getWebhookById(id);
    
    return c.json({
      success: true,
      data: { webhook }
    });
  })
);

adminRoutes.put('/webhooks/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  validate(WebhookUpdateSchema),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const updateData = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const webhook = await adminModel.updateWebhook(id, updateData);
    
    return c.json({
      success: true,
      message: 'Webhook updated successfully',
      data: { webhook }
    });
  })
);

adminRoutes.delete('/webhooks/:id',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.deleteWebhook(id);
    
    return c.json({
      success: true,
      message: 'Webhook deleted successfully',
      data: result
    });
  })
);

adminRoutes.post('/webhooks/:id/test',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.testWebhook(id);
    
    return c.json({
      success: true,
      message: 'Webhook test completed',
      data: result
    });
  })
);

// Audit logs
adminRoutes.get('/audit-logs',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { page, limit, userId, action, resource, startDate, endDate } = c.get('validatedData');
    
    const result = await adminModel.getAuditLogs({
      page,
      limit,
      userId,
      action,
      resource,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: result
    });
  })
);

// System health and metrics
adminRoutes.get('/health',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const health = await adminModel.getSystemHealth();
    
    return c.json({
      success: true,
      data: { health }
    });
  })
);

adminRoutes.get('/metrics',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { period = '24h' } = c.req.query();
    
    const metrics = await adminModel.getSystemMetrics({ period });
    
    return c.json({
      success: true,
      data: { metrics }
    });
  })
);

// Database management
adminRoutes.get('/database/stats',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const stats = await adminModel.getDatabaseStats();
    
    return c.json({
      success: true,
      data: { stats }
    });
  })
);

adminRoutes.post('/database/optimize',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.optimizeDatabase();
    
    return c.json({
      success: true,
      message: 'Database optimization completed',
      data: result
    });
  })
);

adminRoutes.post('/database/backup',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.createBackup();
    
    return c.json({
      success: true,
      message: 'Database backup created successfully',
      data: result
    });
  })
);

// Cache management
adminRoutes.post('/cache/clear',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const { pattern } = await c.req.json();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const result = await adminModel.clearCache(pattern);
    
    return c.json({
      success: true,
      message: 'Cache cleared successfully',
      data: result
    });
  })
);

adminRoutes.get('/cache/stats',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    const stats = await adminModel.getCacheStats();
    
    return c.json({
      success: true,
      data: { stats }
    });
  })
);

// Security monitoring
adminRoutes.get('/security/threats',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { page, limit, level, status } = c.get('validatedData');
    
    const result = await adminModel.getSecurityThreats({
      page,
      limit,
      level,
      status
    });
    
    return c.json({
      success: true,
      data: result
    });
  })
);

adminRoutes.get('/security/ip-reputation',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const { ip } = c.req.query();
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    
    if (!ip) {
      return c.json({
        success: false,
        error: 'IP address is required',
        code: 'MISSING_IP'
      }, 400);
    }
    
    const reputation = await adminModel.getIPReputation(ip);
    
    return c.json({
      success: true,
      data: { reputation }
    });
  })
);

// Reports
adminRoutes.get('/reports/users',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { period = 'month', format = 'json' } = c.req.query();
    
    const report = await adminModel.generateUserReport({ period, format });
    
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="users-report.csv"');
      return c.text(report);
    }
    
    return c.json({
      success: true,
      data: { report }
    });
  })
);

adminRoutes.get('/reports/financial',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const adminModel = new AdminModel(c.env.DB, c.env.CACHE);
    const { period = 'month', format = 'json' } = c.req.query();
    
    const report = await adminModel.generateFinancialReport({ period, format });
    
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="financial-report.csv"');
      return c.text(report);
    }
    
    return c.json({
      success: true,
      data: { report }
    });
  })
);

export default adminRoutes;