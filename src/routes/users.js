import { Hono } from 'hono';
import { authenticate, authorize, validate } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { UserModel } from '../models/index.js';
import {
  UserUpdateSchema,
  PaginationSchema,
  UserAdminUpdateSchema,
  SearchQuerySchema
} from '../types/schemas.js';

const userRoutes = new Hono();

// Get current user profile
userRoutes.get('/me',
  authenticate,
  asyncHandler(async (c) => {
    const user = c.get('user');
    
    return c.json({
      success: true,
      data: { user }
    });
  })
);

// Update current user profile
userRoutes.put('/me',
  authenticate,
  validate(UserUpdateSchema),
  asyncHandler(async (c) => {
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    const userId = c.get('userId');
    const updateData = c.get('validatedData');
    
    const updatedUser = await userModel.update(userId, updateData);
    
    return c.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  })
);

// Upload user avatar
userRoutes.post('/me/avatar',
  authenticate,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    // Handle file upload (implement file upload logic)
    const avatarUrl = await handleAvatarUpload(c, userId);
    
    const updatedUser = await userModel.update(userId, { avatarUrl });
    
    return c.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { user: updatedUser }
    });
  })
);

// Delete user account
userRoutes.delete('/me',
  authenticate,
  asyncHandler(async (c) => {
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    const userId = c.get('userId');
    
    const result = await userModel.delete(userId);
    
    return c.json({
      success: true,
      message: 'Account deleted successfully',
      data: result
    });
  })
);

// Get user preferences
userRoutes.get('/me/preferences',
  authenticate,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    
    const preferences = await c.env.DB.prepare(`
      SELECT preferences FROM user_preferences WHERE user_id = ?
    `).bind(userId).first();
    
    return c.json({
      success: true,
      data: {
        preferences: preferences?.preferences ? JSON.parse(preferences.preferences) : {}
      }
    });
  })
);

// Update user preferences
userRoutes.put('/me/preferences',
  authenticate,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const { preferences } = await c.req.json();
    
    if (!preferences || typeof preferences !== 'object') {
      return c.json({
        success: false,
        error: 'Valid preferences object is required',
        code: 'INVALID_PREFERENCES'
      }, 400);
    }
    
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO user_preferences (user_id, preferences, updated_at)
      VALUES (?, ?, ?)
    `).bind(userId, JSON.stringify(preferences), new Date().toISOString()).run();
    
    return c.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences }
    });
  })
);

// Get user statistics
userRoutes.get('/me/stats',
  authenticate,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    
    // Get book count
    const bookCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM book_members WHERE user_id = ?
    `).bind(userId).first();
    
    // Get transaction count
    const transactionCount = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT t.id) as count
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ?
    `).bind(userId).first();
    
    // Get total balance across all books
    const totalBalance = await c.env.DB.prepare(`
      SELECT SUM(a.balance) as total
      FROM accounts a
      JOIN books b ON a.book_id = b.id
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ? AND a.is_archived = 0
    `).bind(userId).first();
    
    return c.json({
      success: true,
      data: {
        stats: {
          booksCount: bookCount?.count || 0,
          transactionsCount: transactionCount?.count || 0,
          totalBalance: totalBalance?.total || 0
        }
      }
    });
  })
);

// Search users (admin only)
userRoutes.get('/search',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(SearchQuerySchema),
  asyncHandler(async (c) => {
    const { q, page, limit } = c.get('validatedData');
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    const offset = (page - 1) * limit;
    
    const users = await c.env.DB.prepare(`
      SELECT id, email, full_name, avatar_url, role, status, email_verified, created_at
      FROM users
      WHERE (full_name LIKE ? OR email LIKE ?) AND status != 'DELETED'
      ORDER BY full_name ASC
      LIMIT ? OFFSET ?
    `).bind(`%${q}%`, `%${q}%`, limit, offset).all();
    
    const count = await c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM users
      WHERE (full_name LIKE ? OR email LIKE ?) AND status != 'DELETED'
    `).bind(`%${q}%`, `%${q}%`).first();
    
    return c.json({
      success: true,
      data: {
        users: users.results || [],
        pagination: {
          page,
          limit,
          total: count?.total || 0,
          totalPages: Math.ceil((count?.total || 0) / limit)
        }
      }
    });
  })
);

// Get all users (admin only)
userRoutes.get('/',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const { page, limit, sort, order } = c.get('validatedData');
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    const options = {
      page,
      limit,
      sortBy: sort || 'created_at',
      sortOrder: order || 'desc'
    };
    
    const result = await userModel.list(options);
    
    return c.json({
      success: true,
      data: {
        users: result.users,
        pagination: result.pagination
      }
    });
  })
);

// Get specific user (admin only)
userRoutes.get('/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    const user = await userModel.findById(id);
    
    return c.json({
      success: true,
      data: { user }
    });
  })
);

// Update user (admin only)
userRoutes.put('/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(UserAdminUpdateSchema),
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const updateData = c.get('validatedData');
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    const updatedUser = await userModel.update(id, updateData);
    
    return c.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  })
);

// Delete user (admin only)
userRoutes.delete('/:id',
  authenticate,
  authorize(['SUPER_ADMIN']),
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const userModel = new UserModel(c.env.DB, c.env.CACHE);
    
    const result = await userModel.delete(id);
    
    return c.json({
      success: true,
      message: 'User deleted successfully',
      data: result
    });
  })
);

// Get user activity logs (admin only)
userRoutes.get('/:id/activity',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  validate(PaginationSchema),
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const { page, limit } = c.get('validatedData');
    const offset = (page - 1) * limit;
    
    const activities = await c.env.DB.prepare(`
      SELECT action, resource, details, ip_address, user_agent, created_at
      FROM user_activity_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(id, limit, offset).all();
    
    const count = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM user_activity_logs WHERE user_id = ?
    `).bind(id).first();
    
    return c.json({
      success: true,
      data: {
        activities: activities.results || [],
        pagination: {
          page,
          limit,
          total: count?.total || 0,
          totalPages: Math.ceil((count?.total || 0) / limit)
        }
      }
    });
  })
);

// Helper function for avatar upload
async function handleAvatarUpload(c, userId) {
  // Implement file upload logic here
  // For now, return a placeholder URL
  return `https://api.casflo.id/avatars/${userId}.jpg`;
}

export default userRoutes;