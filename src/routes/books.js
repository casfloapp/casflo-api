import { Hono } from 'hono';
import { authenticate, authorize, requireBookAccess, validate, cache } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { BookModel } from '../models/book.js';
import {
  BookCreateSchema,
  BookUpdateSchema,
  BookMemberSchema,
  BookIdParamSchema,
  PaginationSchema,
  SearchQuerySchema
} from '../types/schemas.js';

const bookRoutes = new Hono();

// Get all books for current user
bookRoutes.get('/',
  authenticate,
  validate(PaginationSchema),
  cache(300), // 5 minutes cache
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const { page, limit, sort, order } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const options = {
      page,
      limit,
      sortBy: sort || 'created_at',
      sortOrder: order || 'desc',
      userId
    };
    
    const result = await bookModel.findByUser(userId, options);
    
    return c.json({
      success: true,
      data: {
        books: result.books,
        pagination: result.pagination
      }
    });
  })
);

// Search books
bookRoutes.get('/search',
  authenticate,
  validate(SearchQuerySchema),
  cache(180), // 3 minutes cache
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const { q, page, limit } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const result = await bookModel.search(userId, q, { page, limit });
    
    return c.json({
      success: true,
      data: {
        books: result.books,
        pagination: result.pagination,
        query: q
      }
    });
  })
);

// Create new book
bookRoutes.post('/',
  authenticate,
  validate(BookCreateSchema),
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const bookData = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const book = await bookModel.create(bookData, userId);
    
    return c.json({
      success: true,
      message: 'Book created successfully',
      data: { book }
    }, 201);
  })
);

// Get specific book details
bookRoutes.get('/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('VIEWER'),
  cache(600), // 10 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const book = await bookModel.findById(bookId);
    
    return c.json({
      success: true,
      data: { book }
    });
  })
);

// Update book
bookRoutes.put('/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  validate(BookUpdateSchema),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const updateData = c.get('validatedData');
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const book = await bookModel.update(bookId, updateData, userId);
    
    return c.json({
      success: true,
      message: 'Book updated successfully',
      data: { book }
    });
  })
);

// Delete book
bookRoutes.delete('/:bookId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const result = await bookModel.delete(bookId);
    
    return c.json({
      success: true,
      message: 'Book deleted successfully',
      data: result
    });
  })
);

// Archive book
bookRoutes.post('/:bookId/archive',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const book = await bookModel.update(bookId, { status: 'ARCHIVED' }, userId);
    
    return c.json({
      success: true,
      message: 'Book archived successfully',
      data: { book }
    });
  })
);

// Restore archived book
bookRoutes.post('/:bookId/restore',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const book = await bookModel.update(bookId, { status: 'ACTIVE' }, userId);
    
    return c.json({
      success: true,
      message: 'Book restored successfully',
      data: { book }
    });
  })
);

// Get book members
bookRoutes.get('/:bookId/members',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  cache(300),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const members = await bookModel.getMembers(bookId);
    
    return c.json({
      success: true,
      data: { members }
    });
  })
);

// Add member to book
bookRoutes.post('/:bookId/members',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  validate(BookMemberSchema),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const memberData = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const member = await bookModel.addMember(bookId, memberData);
    
    return c.json({
      success: true,
      message: 'Member added successfully',
      data: { member }
    }, 201);
  })
);

// Update member role
bookRoutes.put('/:bookId/members/:userId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { userId } = c.req.param();
    const { role, label } = await c.req.json();
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const member = await bookModel.updateMember(bookId, userId, { role, label });
    
    return c.json({
      success: true,
      message: 'Member updated successfully',
      data: { member }
    });
  })
);

// Remove member from book
bookRoutes.delete('/:bookId/members/:userId',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { userId } = c.req.param();
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const result = await bookModel.removeMember(bookId, userId);
    
    return c.json({
      success: true,
      message: 'Member removed successfully',
      data: result
    });
  })
);

// Leave book (current user leaves)
bookRoutes.post('/:bookId/leave',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const result = await bookModel.removeMember(bookId, userId);
    
    return c.json({
      success: true,
      message: 'You have left the book successfully',
      data: result
    });
  })
);

// Get book statistics
bookRoutes.get('/:bookId/stats',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  cache(900), // 15 minutes cache
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const stats = await bookModel.getStatistics(bookId);
    
    return c.json({
      success: true,
      data: { stats }
    });
  })
);

// Get book settings
bookRoutes.get('/:bookId/settings',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  cache(600),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const settings = await bookModel.getSettings(bookId);
    
    return c.json({
      success: true,
      data: { settings }
    });
  })
);

// Update book settings
bookRoutes.put('/:bookId/settings',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('OWNER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const settings = await c.req.json();
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const updatedSettings = await bookModel.updateSettings(bookId, settings);
    
    return c.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: updatedSettings }
    });
  })
);

// Duplicate book
bookRoutes.post('/:bookId/duplicate',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { name, includeTransactions } = await c.req.json();
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const duplicatedBook = await bookModel.duplicate(bookId, name, userId, includeTransactions);
    
    return c.json({
      success: true,
      message: 'Book duplicated successfully',
      data: { book: duplicatedBook }
    }, 201);
  })
);

// Export book data
bookRoutes.get('/:bookId/export',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('MEMBER'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { format = 'json' } = c.req.query();
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const exportData = await bookModel.export(bookId, format);
    
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="book-${bookId}.csv"`);
      return c.text(exportData);
    }
    
    return c.json({
      success: true,
      data: { export: exportData }
    });
  })
);

// Import book data
bookRoutes.post('/:bookId/import',
  authenticate,
  validate(BookIdParamSchema, 'param'),
  requireBookAccess('ADMIN'),
  asyncHandler(async (c) => {
    const { bookId } = c.get('validatedData');
    const { format = 'json', data } = await c.req.json();
    const userId = c.get('userId');
    const bookModel = new BookModel(c.env.DB, c.env.CACHE);
    
    const importResult = await bookModel.import(bookId, format, data, userId);
    
    return c.json({
      success: true,
      message: 'Data imported successfully',
      data: importResult
    });
  })
);

export default bookRoutes;