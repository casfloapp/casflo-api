import { Hono } from 'hono';
import { authenticate, requireBookAccess, validate, cache } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { TransactionModel } from '../models/transaction.js';
import {
  TransactionCreateSchema,
  TransactionUpdateSchema,
  TransactionFilterSchema,
  BookIdParamSchema,
  TransactionIdParamSchema
} from '../types/schemas.js';

const transactionRoutes = new Hono();

// Get transactions for a book
transactionRoutes.get('/books/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  validate(TransactionFilterSchema, 'query'),
  cache(300), // 5 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const filters = c.get('validatedData');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const result = await transactionModel.findByBook(bookId, filters);
    
    return c.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: result.pagination,
        filters
      }
    });
  })
);

// Get specific transaction
transactionRoutes.get('/books/:bookId/transactions/:transactionId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  cache(600), // 10 minutes cache
  asyncHandler(async (c) => {
    const { transactionId } = c.get('validatedData');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const transaction = await transactionModel.findById(transactionId);
    
    return c.json({
      success: true,
      data: { transaction }
    });
  })
);

// Create new transaction
transactionRoutes.post('/books/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  validate(TransactionCreateSchema),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const transactionData = c.get('validatedData');
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const transaction = await transactionModel.create({
      ...transactionData,
      bookId
    }, userId);
    
    return c.json({
      success: true,
      message: 'Transaction created successfully',
      data: { transaction }
    }, 201);
  })
);

// Update transaction
transactionRoutes.put('/books/:bookId/transactions/:transactionId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  validate(TransactionUpdateSchema),
  asyncHandler(async (c) => {
    const { transactionId } = c.get('validatedData');
    const updateData = c.get('validatedData');
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const transaction = await transactionModel.update(transactionId, updateData, userId);
    
    return c.json({
      success: true,
      message: 'Transaction updated successfully',
      data: { transaction }
    });
  })
);

// Delete transaction
transactionRoutes.delete('/books/:bookId/transactions/:transactionId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { transactionId } = c.get('validatedData');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const result = await transactionModel.delete(transactionId);
    
    return c.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: result
    });
  })
);

// Batch create transactions
transactionRoutes.post('/books/:bookId/batch',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { transactions } = await c.req.json();
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return c.json({
        success: false,
        error: 'Transactions array is required',
        code: 'MISSING_TRANSACTIONS'
      }, 400);
    }
    
    const result = await transactionModel.createBatch(
      transactions.map(t => ({ ...t, bookId })),
      userId
    );
    
    return c.json({
      success: true,
      message: 'Batch transactions processed',
      data: result
    }, 201);
  })
);

// Get transaction summary
transactionRoutes.get('/books/:bookId/summary',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  cache(900), // 15 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { period = 'month', startDate, endDate } = c.req.query();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const summary = await transactionModel.getSummary(bookId, { period, startDate, endDate });
    
    return c.json({
      success: true,
      data: { summary }
    });
  })
);

// Get transaction analytics
transactionRoutes.get('/books/:bookId/analytics',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  cache(1800), // 30 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { 
      period = 'month', 
      groupBy = 'category',
      startDate, 
      endDate 
    } = c.req.query();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const analytics = await transactionModel.getAnalytics(bookId, {
      period,
      groupBy,
      startDate,
      endDate
    });
    
    return c.json({
      success: true,
      data: { analytics }
    });
  })
);

// Search transactions
transactionRoutes.get('/books/:bookId/search',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { q, page = 1, limit = 20 } = c.req.query();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    if (!q) {
      return c.json({
        success: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      }, 400);
    }
    
    const result = await transactionModel.search(bookId, q, { page, limit });
    
    return c.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: result.pagination,
        query: q
      }
    });
  })
);

// Get recurring transactions
transactionRoutes.get('/books/:bookId/recurring',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  cache(600),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const recurringTransactions = await transactionModel.getRecurring(bookId);
    
    return c.json({
      success: true,
      data: { recurringTransactions }
    });
  })
);

// Create recurring transaction
transactionRoutes.post('/books/:bookId/recurring',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const recurringData = await c.req.json();
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const recurringTransaction = await transactionModel.createRecurring({
      ...recurringData,
      bookId
    }, userId);
    
    return c.json({
      success: true,
      message: 'Recurring transaction created successfully',
      data: { recurringTransaction }
    }, 201);
  })
);

// Update recurring transaction
transactionRoutes.put('/books/:bookId/recurring/:recurringId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { recurringId } = c.req.param();
    const updateData = await c.req.json();
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const recurringTransaction = await transactionModel.updateRecurring(recurringId, updateData, userId);
    
    return c.json({
      success: true,
      message: 'Recurring transaction updated successfully',
      data: { recurringTransaction }
    });
  })
);

// Delete recurring transaction
transactionRoutes.delete('/books/:bookId/recurring/:recurringId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { recurringId } = c.req.param();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const result = await transactionModel.deleteRecurring(recurringId);
    
    return c.json({
      success: true,
      message: 'Recurring transaction deleted successfully',
      data: result
    });
  })
);

// Process recurring transactions (admin endpoint)
transactionRoutes.post('/books/:bookId/recurring/process',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { date } = await c.req.json();
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const result = await transactionModel.processRecurring(bookId, date, userId);
    
    return c.json({
      success: true,
      message: 'Recurring transactions processed',
      data: result
    });
  })
);

// Export transactions
transactionRoutes.get('/books/:bookId/export',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { format = 'json', startDate, endDate } = c.req.query();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const exportData = await transactionModel.export(bookId, {
      format,
      startDate,
      endDate
    });
    
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="transactions-${bookId}.csv"`);
      return c.text(exportData);
    }
    
    return c.json({
      success: true,
      data: { export: exportData }
    });
  })
);

// Import transactions
transactionRoutes.post('/books/:bookId/import',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { format = 'json', data, options = {} } = await c.req.json();
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const importResult = await transactionModel.import(bookId, format, data, userId, options);
    
    return c.json({
      success: true,
      message: 'Transactions imported successfully',
      data: importResult
    });
  })
);

// Get transaction attachments
transactionRoutes.get('/books/:bookId/transactions/:transactionId/attachments',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  asyncHandler(async (c) => {
    const { transactionId } = c.get('validatedData');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const attachments = await transactionModel.getAttachments(transactionId);
    
    return c.json({
      success: true,
      data: { attachments }
    });
  })
);

// Upload transaction attachment
transactionRoutes.post('/books/:bookId/transactions/:transactionId/attachments',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { transactionId } = c.get('validatedData');
    const userId = c.get('userId');
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    // Handle file upload (implement file upload logic)
    const attachment = await handleAttachmentUpload(c, transactionId, userId);
    
    return c.json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: { attachment }
    }, 201);
  })
);

// Delete transaction attachment
transactionRoutes.delete('/books/:bookId/transactions/:transactionId/attachments/:attachmentId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  validate(TransactionIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { attachmentId } = c.req.param();
    const transactionModel = new TransactionModel(c.env.DB, c.env.CACHE);
    
    const result = await transactionModel.deleteAttachment(attachmentId);
    
    return c.json({
      success: true,
      message: 'Attachment deleted successfully',
      data: result
    });
  })
);

// Helper function for attachment upload
async function handleAttachmentUpload(c, transactionId, userId) {
  // Implement file upload logic here
  // For now, return a placeholder
  return {
    id: `att_${Date.now()}`,
    transactionId,
    filename: 'receipt.jpg',
    url: `https://api.casflo.id/attachments/${transactionId}/receipt.jpg`,
    size: 1024000,
    mimeType: 'image/jpeg',
    uploadedBy: userId,
    uploadedAt: new Date().toISOString()
  };
}

export default transactionRoutes;