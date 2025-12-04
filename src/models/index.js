import { Logger, CacheUtils, IdGenerator, Performance } from '../utils/index.js';
import { NotFoundError, DatabaseError } from '../types/index.js';

// Database query utilities
export class DatabaseUtils {
  static async executeQuery(db, query, params = [], options = {}) {
    const timer = Performance.startTimer('db_query');
    
    try {
      const stmt = db.prepare(query);
      const result = await stmt.bind(...params).all();
      
      const duration = timer.end();
      Logger.info('Database query executed', {
        query: query.substring(0, 100),
        params: params.length,
        resultCount: result.results?.length || 0,
        duration: Performance.formatDuration(duration.duration)
      });
      
      return result;
    } catch (error) {
      const duration = timer.end();
      Logger.error('Database query failed', error, {
        query: query.substring(0, 100),
        params: params.length,
        duration: Performance.formatDuration(duration.duration)
      });
      
      throw new DatabaseError(`Database query failed: ${error.message}`);
    }
  }
  
  static async executeGet(db, query, params = [], options = {}) {
    const timer = Performance.startTimer('db_get');
    
    try {
      const stmt = db.prepare(query);
      const result = await stmt.bind(...params).first();
      
      const duration = timer.end();
      Logger.info('Database get executed', {
        query: query.substring(0, 100),
        params: params.length,
        found: !!result,
        duration: Performance.formatDuration(duration.duration)
      });
      
      return result;
    } catch (error) {
      const duration = timer.end();
      Logger.error('Database get failed', error, {
        query: query.substring(0, 100),
        params: params.length,
        duration: Performance.formatDuration(duration.duration)
      });
      
      throw new DatabaseError(`Database get failed: ${error.message}`);
    }
  }
  
  static async executeRun(db, query, params = [], options = {}) {
    const timer = Performance.startTimer('db_run');
    
    try {
      const stmt = db.prepare(query);
      const result = await stmt.bind(...params).run();
      
      const duration = timer.end();
      Logger.info('Database run executed', {
        query: query.substring(0, 100),
        params: params.length,
        changes: result.changes,
        lastRowId: result.meta?.last_row_id,
        success: result.success,
        duration: Performance.formatDuration(duration.duration)
      });
      
      return result;
    } catch (error) {
      const duration = timer.end();
      Logger.error('Database run failed', error, {
        query: query.substring(0, 100),
        params: params.length,
        duration: Performance.formatDuration(duration.duration)
      });
      
      throw new DatabaseError(`Database run failed: ${error.message}`);
    }
  }
  
  static async executeBatch(db, queries, options = {}) {
    const timer = Performance.startTimer('db_batch');
    
    try {
      const statements = queries.map(({ query, params }) => 
        db.prepare(query).bind(...(params || []))
      );
      
      const results = await db.batch(statements);
      
      const duration = timer.end();
      Logger.info('Database batch executed', {
        queryCount: queries.length,
        duration: Performance.formatDuration(duration.duration)
      });
      
      return results;
    } catch (error) {
      const duration = timer.end();
      Logger.error('Database batch failed', error, {
        queryCount: queries.length,
        duration: Performance.formatDuration(duration.duration)
      });
      
      throw new DatabaseError(`Database batch failed: ${error.message}`);
    }
  }
}

// User model
export class UserModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }
  
  async findById(id) {
    const cacheKey = `user:${id}`;
    
    // Try cache first
    let user = await CacheUtils.get(this.cache, cacheKey);
    if (user) {
      Logger.debug('User found in cache', { userId: id });
      return user;
    }
    
    // Query database
    user = await DatabaseUtils.executeGet(
      this.db,
      `SELECT id, email, full_name, avatar_url, role, status, email_verified, 
              created_at, updated_at, last_login_at 
       FROM users WHERE id = ?`,
      [id]
    );
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Cache for 5 minutes
    await CacheUtils.set(this.cache, cacheKey, user, 300);
    
    return user;
  }
  
  async findByEmail(email) {
    const cacheKey = `user:email:${email}`;
    
    let user = await CacheUtils.get(this.cache, cacheKey);
    if (user) {
      return user;
    }
    
    user = await DatabaseUtils.executeGet(
      this.db,
      `SELECT id, email, full_name, avatar_url, role, status, email_verified,
              hashed_password, created_at, updated_at, last_login_at
       FROM users WHERE email = ?`,
      [email]
    );
    
    if (user) {
      await CacheUtils.set(this.cache, cacheKey, user, 300);
    }
    
    return user;
  }
  
  async create(userData) {
    const id = IdGenerator.generateId('us');
    const now = new Date().toISOString();
    
    const result = await DatabaseUtils.executeRun(
      this.db,
      `INSERT INTO users (id, email, full_name, hashed_password, avatar_url, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userData.email,
        userData.fullName,
        userData.hashedPassword,
        userData.avatarUrl || null,
        userData.role || 'USER',
        userData.status || 'PENDING_VERIFICATION',
        now
      ]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to create user');
    }
    
    // Clear cache
    await CacheUtils.delete(this.cache, `user:email:${userData.email}`);
    
    return await this.findById(id);
  }
  
  async update(id, updateData) {
    const fields = [];
    const params = [];
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push('updated_at = ?');
    params.push(new Date().toISOString(), id);
    
    const result = await DatabaseUtils.executeRun(
      this.db,
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to update user');
    }
    
    // Clear cache
    await CacheUtils.delete(this.cache, `user:${id}`);
    
    return await this.findById(id);
  }
  
  async updateLastLogin(id) {
    await DatabaseUtils.executeRun(
      this.db,
      'UPDATE users SET last_login_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    
    // Clear cache
    await CacheUtils.delete(this.cache, `user:${id}`);
  }
  
  async delete(id) {
    // Soft delete
    const result = await DatabaseUtils.executeRun(
      this.db,
      'UPDATE users SET status = ?, updated_at = ? WHERE id = ?',
      ['DELETED', new Date().toISOString(), id]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to delete user');
    }
    
    // Clear cache
    await CacheUtils.delete(this.cache, `user:${id}`);
    
    return { deleted: true, id };
  }
  
  async list(options = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;
    
    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params = [];
    
    if (search) {
      whereConditions.push('(full_name LIKE ? OR email LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }
    
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const validSortColumns = ['full_name', 'email', 'role', 'status', 'created_at', 'last_login_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await DatabaseUtils.executeGet(this.db, countQuery, params);
    const total = countResult?.total || 0;
    
    // Get users
    const usersQuery = `
      SELECT id, email, full_name, avatar_url, role, status, email_verified,
             created_at, updated_at, last_login_at
      FROM users ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;
    
    const usersResult = await DatabaseUtils.executeQuery(
      this.db,
      usersQuery,
      [...params, limit, offset]
    );
    
    return {
      users: usersResult.results || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

// Session model
export class SessionModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }
  
  async create(sessionData) {
    const sessionId = IdGenerator.generateSessionId();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (sessionData.ttl || 86400000)).toISOString(); // 24 hours default
    
    const result = await DatabaseUtils.executeRun(
      this.db,
      `INSERT INTO sessions (id, user_id, token, refresh_token, expires_at, created_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        sessionData.userId,
        sessionData.token,
        sessionData.refreshToken,
        expiresAt,
        now,
        sessionData.ipAddress,
        sessionData.userAgent
      ]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to create session');
    }
    
    return {
      sessionId,
      userId: sessionData.userId,
      token: sessionData.token,
      refreshToken: sessionData.refreshToken,
      expiresAt
    };
  }
  
  async findByToken(token) {
    const cacheKey = `session:token:${token}`;
    
    let session = await CacheUtils.get(this.cache, cacheKey);
    if (session) {
      return session;
    }
    
    session = await DatabaseUtils.executeGet(
      this.db,
      `SELECT s.*, u.email, u.full_name, u.role, u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > ? AND u.status = 'ACTIVE'`,
      [token, new Date().toISOString()]
    );
    
    if (session) {
      await CacheUtils.set(this.cache, cacheKey, session, 300); // 5 minutes cache
    }
    
    return session;
  }
  
  async findByRefreshToken(refreshToken) {
    return await DatabaseUtils.executeGet(
      this.db,
      `SELECT s.*, u.email, u.full_name, u.role, u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token = ? AND s.expires_at > ? AND u.status = 'ACTIVE'`,
      [refreshToken, new Date().toISOString()]
    );
  }
  
  async revoke(sessionId) {
    const result = await DatabaseUtils.executeRun(
      this.db,
      'UPDATE sessions SET expires_at = ? WHERE id = ?',
      [new Date().toISOString(), sessionId]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to revoke session');
    }
    
    return { revoked: true, sessionId };
  }
  
  async revokeAllForUser(userId) {
    const result = await DatabaseUtils.executeRun(
      this.db,
      'UPDATE sessions SET expires_at = ? WHERE user_id = ?',
      [new Date().toISOString(), userId]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to revoke all sessions');
    }
    
    return { revoked: true, userId };
  }
  
  async cleanupExpired() {
    const result = await DatabaseUtils.executeRun(
      this.db,
      'DELETE FROM sessions WHERE expires_at < ?',
      [new Date().toISOString()]
    );
    
    Logger.info('Cleaned up expired sessions', {
      deletedCount: result.changes || 0
    });
    
    return result.changes || 0;
  }
}

// API Key model
export class ApiKeyModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }
  
  async create(apiKeyData) {
    const id = IdGenerator.generateId('ak');
    const key = `ak_${IdGenerator.generateSecureToken(32)}`;
    const now = new Date().toISOString();
    
    const result = await DatabaseUtils.executeRun(
      this.db,
      `INSERT INTO api_keys (id, user_id, name, key, permissions, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        apiKeyData.userId,
        apiKeyData.name,
        key,
        JSON.stringify(apiKeyData.permissions || []),
        apiKeyData.expiresAt || null,
        now
      ]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to create API key');
    }
    
    return {
      id,
      key,
      name: apiKeyData.name,
      permissions: apiKeyData.permissions || [],
      expiresAt: apiKeyData.expiresAt
    };
  }
  
  async findByKey(key) {
    const cacheKey = `apikey:${key}`;
    
    let apiKey = await CacheUtils.get(this.cache, cacheKey);
    if (apiKey) {
      return apiKey;
    }
    
    apiKey = await DatabaseUtils.executeGet(
      this.db,
      `SELECT ak.*, u.email, u.role, u.status
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key = ? AND ak.is_active = 1 AND u.status = 'ACTIVE'`,
      [key]
    );
    
    if (apiKey) {
      // Parse permissions
      apiKey.permissions = JSON.parse(apiKey.permissions || '[]');
      await CacheUtils.set(this.cache, cacheKey, apiKey, 300);
    }
    
    return apiKey;
  }
  
  async updateLastUsed(id) {
    await DatabaseUtils.executeRun(
      this.db,
      'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    
    // Clear cache
    await CacheUtils.delete(this.cache, `apikey:${id}`);
  }
  
  async revoke(id) {
    const result = await DatabaseUtils.executeRun(
      this.db,
      'UPDATE api_keys SET is_active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    
    if (!result.success) {
      throw new DatabaseError('Failed to revoke API key');
    }
    
    return { revoked: true, id };
  }
  
  async listByUser(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const countResult = await DatabaseUtils.executeGet(
      this.db,
      'SELECT COUNT(*) as total FROM api_keys WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    
    const apiKeysResult = await DatabaseUtils.executeQuery(
      this.db,
      `SELECT id, name, permissions, expires_at, created_at, last_used_at, is_active
       FROM api_keys 
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    // Parse permissions for each API key
    const apiKeys = (apiKeysResult.results || []).map(key => ({
      ...key,
      permissions: JSON.parse(key.permissions || '[]')
    }));
    
    return {
      apiKeys,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit)
      }
    };
  }
}

export {
  DatabaseUtils,
  UserModel,
  SessionModel,
  ApiKeyModel
};