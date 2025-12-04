import { Hono } from 'hono';
import { authenticate, authorize, validate, cache } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AnalyticsModel } from '../models/analytics.js';
import {
  AnalyticsQuerySchema,
  BookIdParamSchema,
  PaginationSchema
} from '../types/schemas.js';

const analyticsRoutes = new Hono();

// Get comprehensive book analytics
analyticsRoutes.get('/books/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(AnalyticsQuerySchema, 'query'),
  cache(1800), // 30 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const query = c.get('validatedData');
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const analytics = await analyticsModel.getBookAnalytics(bookId, query);
    
    return c.json({
      success: true,
      data: { analytics }
    });
  })
);

// Get income vs expense trends
analyticsRoutes.get('/books/:bookId/trends',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const trends = await analyticsModel.getIncomeExpenseTrends(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { trends }
    });
  })
);

// Get category breakdown
analyticsRoutes.get('/books/:bookId/categories',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', type = 'ALL', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const categoryBreakdown = await analyticsModel.getCategoryBreakdown(bookId, {
      period,
      type,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { categoryBreakdown }
    });
  })
);

// Get account balances over time
analyticsRoutes.get('/books/:bookId/accounts',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const accountTrends = await analyticsModel.getAccountTrends(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { accountTrends }
    });
  })
);

// Get top spending categories
analyticsRoutes.get('/books/:bookId/top-categories',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', limit = 10, startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const topCategories = await analyticsModel.getTopCategories(bookId, {
      period,
      limit: parseInt(limit),
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { topCategories }
    });
  })
);

// Get cash flow analysis
analyticsRoutes.get('/books/:bookId/cashflow',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const cashflow = await analyticsModel.getCashflowAnalysis(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { cashflow }
    });
  })
);

// Get budget vs actual analysis
analyticsRoutes.get('/books/:bookId/budgets',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const budgetAnalysis = await analyticsModel.getBudgetAnalysis(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { budgetAnalysis }
    });
  })
);

// Get monthly summary
analyticsRoutes.get('/books/:bookId/monthly-summary',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { months = 12 } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const monthlySummary = await analyticsModel.getMonthlySummary(bookId, {
      months: parseInt(months)
    });
    
    return c.json({
      success: true,
      data: { monthlySummary }
    });
  })
);

// Get year-over-year comparison
analyticsRoutes.get('/books/:bookId/yoy',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(3600), // 1 hour cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { years = 2 } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const yoyComparison = await analyticsModel.getYearOverYearComparison(bookId, {
      years: parseInt(years)
    });
    
    return c.json({
      success: true,
      data: { yoyComparison }
    });
  })
);

// Get financial health score
analyticsRoutes.get('/books/:bookId/health-score',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(3600),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const healthScore = await analyticsModel.getFinancialHealthScore(bookId);
    
    return c.json({
      success: true,
      data: { healthScore }
    });
  })
);

// Get forecast and predictions
analyticsRoutes.get('/books/:bookId/forecast',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(3600),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', months = 6 } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const forecast = await analyticsModel.getForecast(bookId, {
      period,
      months: parseInt(months)
    });
    
    return c.json({
      success: true,
      data: { forecast }
    });
  })
);

// Get expense patterns
analyticsRoutes.get('/books/:bookId/expense-patterns',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month' } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const patterns = await analyticsModel.getExpensePatterns(bookId, { period });
    
    return c.json({
      success: true,
      data: { patterns }
    });
  })
);

// Get revenue streams (for business books)
analyticsRoutes.get('/books/:bookId/revenue-streams',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const revenueStreams = await analyticsModel.getRevenueStreams(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { revenueStreams }
    });
  })
);

// Get profit margins (for business books)
analyticsRoutes.get('/books/:bookId/profit-margins',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const profitMargins = await analyticsModel.getProfitMargins(bookId, {
      period,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { profitMargins }
    });
  })
);

// Get customer analytics (for business books)
analyticsRoutes.get('/books/:bookId/customers',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(1800),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', limit = 20 } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const customerAnalytics = await analyticsModel.getCustomerAnalytics(bookId, {
      period,
      limit: parseInt(limit)
    });
    
    return c.json({
      success: true,
      data: { customerAnalytics }
    });
  })
);

// Get dashboard summary
analyticsRoutes.get('/books/:bookId/dashboard',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  cache(900), // 15 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const dashboard = await analyticsModel.getDashboardSummary(bookId);
    
    return c.json({
      success: true,
      data: { dashboard }
    });
  })
);

// Export analytics data
analyticsRoutes.get('/books/:bookId/export',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { format = 'json', type = 'summary', startDate, endDate } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const exportData = await analyticsModel.exportAnalytics(bookId, {
      format,
      type,
      startDate,
      endDate
    });
    
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="analytics-${bookId}-${type}.csv"`);
      return c.text(exportData);
    }
    
    return c.json({
      success: true,
      data: { export: exportData }
    });
  })
);

// Get user's combined analytics across all books
analyticsRoutes.get('/user/summary',
  authenticate,
  cache(1800),
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const { period = 'month' } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const userSummary = await analyticsModel.getUserAnalyticsSummary(userId, {
      period
    });
    
    return c.json({
      success: true,
      data: { userSummary }
    });
  })
);

// Get system-wide analytics (admin only)
analyticsRoutes.get('/system/overview',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  cache(3600),
  asyncHandler(async (c) => {
    const { period = 'month' } = c.req.query();
    const analyticsModel = new AnalyticsModel(c.env.DB, c.env.CACHE);
    
    const systemOverview = await analyticsModel.getSystemAnalytics({
      period
    });
    
    return c.json({
      success: true,
      data: { systemOverview }
    });
  })
);

export default analyticsRoutes;