# Additional Models and Services

# Book Model
export class BookModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }

  async findByUser(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    const books = await this.db.prepare(`
      SELECT b.*, bm.role as user_role, bm.label as user_label
      FROM books b
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ? AND b.status = 'ACTIVE'
      ORDER BY b.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total
      FROM books b
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ? AND b.status = 'ACTIVE'
    `).bind(userId).first();

    return {
      books: books.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async findById(bookId) {
    const book = await this.db.prepare(`
      SELECT b.*, u.full_name as creator_name
      FROM books b
      JOIN users u ON b.created_by = u.id
      WHERE b.id = ? AND b.status != 'DELETED'
    `).bind(bookId).first();

    if (!book) {
      throw new NotFoundError('Book');
    }

    return book;
  }

  async create(bookData, userId) {
    const id = `book_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();

    const result = await this.db.prepare(`
      INSERT INTO books (id, name, description, module_type, icon, currency, timezone, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      bookData.name,
      bookData.description || null,
      bookData.moduleType || 'FINANCE',
      bookData.icon || '📚',
      bookData.currency || 'IDR',
      bookData.timezone || 'Asia/Jakarta',
      userId,
      now,
      now
    ).run();

    if (!result.success) {
      throw new DatabaseError('Failed to create book');
    }

    // Add creator as owner
    await this.db.prepare(`
      INSERT INTO book_members (id, book_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'OWNER', ?)
    `).bind(`bm_${Date.now()}`, id, userId, now).run();

    // Create default categories
    await this.createDefaultCategories(id);

    return await this.findById(id);
  }

  async update(bookId, updateData, userId) {
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

    fields.push('updated_by = ?', 'updated_at = ?');
    params.push(userId, new Date().toISOString(), bookId);

    const result = await this.db.prepare(`
      UPDATE books SET ${fields.join(', ')} WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new DatabaseError('Failed to update book');
    }

    return await this.findById(bookId);
  }

  async delete(bookId) {
    const result = await this.db.prepare(`
      UPDATE books SET status = 'DELETED', updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), bookId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to delete book');
    }

    return { deleted: true, bookId };
  }

  async getMembers(bookId) {
    const members = await this.db.prepare(`
      SELECT u.id, u.email, u.full_name, u.avatar_url, bm.role, bm.label, bm.joined_at
      FROM users u
      JOIN book_members bm ON u.id = bm.user_id
      WHERE bm.book_id = ?
      ORDER BY bm.joined_at ASC
    `).bind(bookId).all();

    return members.results || [];
  }

  async addMember(bookId, memberData) {
    const { UserModel } = await import('./index.js');
    const userModel = new UserModel(this.db, this.cache);

    // Find user by email
    const user = await userModel.findByEmail(memberData.email);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if already a member
    const existing = await this.db.prepare(`
      SELECT id FROM book_members WHERE book_id = ? AND user_id = ?
    `).bind(bookId, user.id).first();

    if (existing) {
      throw new ConflictError('User is already a member of this book');
    }

    const result = await this.db.prepare(`
      INSERT INTO book_members (id, book_id, user_id, role, label, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      `bm_${Date.now()}`,
      bookId,
      user.id,
      memberData.role,
      memberData.label || null,
      new Date().toISOString()
    ).run();

    if (!result.success) {
      throw new DatabaseError('Failed to add member');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: memberData.role,
      label: memberData.label
    };
  }

  async removeMember(bookId, userId) {
    const result = await this.db.prepare(`
      DELETE FROM book_members WHERE book_id = ? AND user_id = ?
    `).bind(bookId, userId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to remove member');
    }

    return { removed: true, bookId, userId };
  }

  async updateMember(bookId, userId, updateData) {
    const fields = [];
    const params = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(bookId, userId);

    const result = await this.db.prepare(`
      UPDATE book_members SET ${fields.join(', ')} WHERE book_id = ? AND user_id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new DatabaseError('Failed to update member');
    }

    // Return updated member
    const member = await this.db.prepare(`
      SELECT u.id, u.email, u.full_name, u.avatar_url, bm.role, bm.label
      FROM users u
      JOIN book_members bm ON u.id = bm.user_id
      WHERE bm.book_id = ? AND bm.user_id = ?
    `).bind(bookId, userId).first();

    return member;
  }

  async getStatistics(bookId) {
    const stats = await this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM book_members WHERE book_id = ?) as members_count,
        (SELECT COUNT(*) FROM accounts WHERE book_id = ? AND is_archived = 0) as accounts_count,
        (SELECT COUNT(*) FROM categories WHERE book_id = ? AND is_active = 1) as categories_count,
        (SELECT COUNT(*) FROM contacts WHERE book_id = ? AND is_active = 1) as contacts_count,
        (SELECT COUNT(*) FROM transactions WHERE book_id = ?) as transactions_count,
        (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE book_id = ? AND is_archived = 0) as total_balance
    `).bind(bookId, bookId, bookId, bookId, bookId, bookId).first();

    return stats;
  }

  async search(userId, query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const books = await this.db.prepare(`
      SELECT b.*, bm.role as user_role
      FROM books b
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ? AND b.status = 'ACTIVE' 
        AND (b.name LIKE ? OR b.description LIKE ?)
      ORDER BY b.name ASC
      LIMIT ? OFFSET ?
    `).bind(userId, `%${query}%`, `%${query}%`, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total
      FROM books b
      JOIN book_members bm ON b.id = bm.book_id
      WHERE bm.user_id = ? AND b.status = 'ACTIVE' 
        AND (b.name LIKE ? OR b.description LIKE ?)
    `).bind(userId, `%${query}%`, `%${query}%`).first();

    return {
      books: books.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async createDefaultCategories(bookId) {
    const defaultCategories = [
      // Income categories
      { name: 'Gaji', type: 'INCOME', icon: '💰' },
      { name: 'Bonus', type: 'INCOME', icon: '✨' },
      { name: 'Investasi', type: 'INCOME', icon: '📈' },
      { name: 'Penjualan', type: 'INCOME', icon: '💸' },
      { name: 'Hadiah', type: 'INCOME', icon: '🎁' },
      
      // Expense categories
      { name: 'Makanan & Minuman', type: 'EXPENSE', icon: '🍔' },
      { name: 'Transportasi', type: 'EXPENSE', icon: '🚗' },
      { name: 'Tagihan', type: 'EXPENSE', icon: '🧾' },
      { name: 'Belanja', type: 'EXPENSE', icon: '🛍️' },
      { name: 'Hiburan', type: 'EXPENSE', icon: '🎉' },
      { name: 'Kesehatan', type: 'EXPENSE', icon: '❤️' },
      { name: 'Pendidikan', type: 'EXPENSE', icon: '🎓' },
      { name: 'Keluarga', type: 'EXPENSE', icon: '👨‍👩‍👧' },
    ];

    for (const category of defaultCategories) {
      await this.db.prepare(`
        INSERT INTO categories (id, book_id, name, type, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `cat_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        bookId,
        category.name,
        category.type,
        category.icon,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    }
  }
}

# Transaction Model
export class TransactionModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }

  async findByBook(bookId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      categoryId,
      accountId,
      contactId,
      startDate,
      endDate,
      sortBy = 'transaction_date',
      sortOrder = 'desc'
    } = filters;

    const offset = (page - 1) * limit;
    const whereConditions = ['t.book_id = ?'];
    const params = [bookId];

    if (type) {
      whereConditions.push('t.type = ?');
      params.push(type);
    }

    if (categoryId) {
      whereConditions.push('ts.category_id = ?');
      params.push(categoryId);
    }

    if (accountId) {
      whereConditions.push('ts.account_id = ?');
      params.push(accountId);
    }

    if (contactId) {
      whereConditions.push('t.contact_id = ?');
      params.push(contactId);
    }

    if (startDate && endDate) {
      whereConditions.push('t.transaction_date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }

    const whereClause = whereConditions.join(' AND ');

    const transactions = await this.db.prepare(`
      SELECT 
        t.id, t.description, t.transaction_date, t.status, t.tags, t.notes,
        c.name as category_name, c.type as category_type, c.icon as category_icon,
        a.name as account_name,
        ct.name as contact_name,
        ts.amount, ts.type as split_type
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      LEFT JOIN categories c ON ts.category_id = c.id
      LEFT JOIN accounts a ON ts.account_id = a.id
      LEFT JOIN contacts ct ON t.contact_id = ct.id
      WHERE ${whereClause}
      ORDER BY t.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      WHERE ${whereClause}
    `).bind(...params).first();

    return {
      transactions: transactions.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async findById(transactionId) {
    const transaction = await this.db.prepare(`
      SELECT 
        t.*, u.full_name as creator_name
      FROM transactions t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).bind(transactionId).first();

    if (!transaction) {
      throw new NotFoundError('Transaction');
    }

    // Get splits
    const splits = await this.db.prepare(`
      SELECT 
        ts.*, a.name as account_name, c.name as category_name, c.icon as category_icon
      FROM transaction_splits ts
      LEFT JOIN accounts a ON ts.account_id = a.id
      LEFT JOIN categories c ON ts.category_id = c.id
      WHERE ts.transaction_id = ?
    `).bind(transactionId).all();

    transaction.splits = splits.results || [];
    transaction.tags = JSON.parse(transaction.tags || '[]');
    transaction.attachments = JSON.parse(transaction.attachments || '[]');

    return transaction;
  }

  async create(transactionData, userId) {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();

    const result = await this.db.prepare(`
      INSERT INTO transactions (id, book_id, description, transaction_date, contact_id, tags, notes, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      transactionData.bookId,
      transactionData.description,
      transactionData.transactionDate,
      transactionData.contactId || null,
      JSON.stringify(transactionData.tags || []),
      transactionData.notes || null,
      'CONFIRMED',
      userId,
      now,
      now
    ).run();

    if (!result.success) {
      throw new DatabaseError('Failed to create transaction');
    }

    // Create splits based on transaction type
    await this.createTransactionSplits(id, transactionData);

    return await this.findById(id);
  }

  async createTransactionSplits(transactionId, transactionData) {
    const splits = [];
    const amount = Math.round(transactionData.amount * 100); // Convert to cents

    switch (transactionData.type) {
      case 'INCOME':
        splits.push({
          accountId: transactionData.accountId,
          categoryId: transactionData.categoryId,
          amount: amount,
          type: 'DEBIT'
        });
        break;

      case 'EXPENSE':
        splits.push({
          accountId: transactionData.accountId,
          categoryId: transactionData.categoryId,
          amount: -amount,
          type: 'CREDIT'
        });
        break;

      case 'TRANSFER':
        splits.push({
          accountId: transactionData.toAccountId,
          amount: amount,
          type: 'DEBIT'
        });
        splits.push({
          accountId: transactionData.accountId,
          amount: -amount,
          type: 'CREDIT'
        });
        break;
    }

    // Insert splits and update account balances
    for (const split of splits) {
      await this.db.prepare(`
        INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `spl_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        transactionId,
        split.accountId,
        split.categoryId || null,
        split.amount,
        split.type,
        new Date().toISOString()
      ).run();

      // Update account balance
      await this.db.prepare(`
        UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?
      `).bind(split.amount, new Date().toISOString(), split.accountId).run();
    }
  }

  async update(transactionId, updateData, userId) {
    // For simplicity, this is a basic update
    // In production, you'd want to handle splits updates properly
    const fields = [];
    const params = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        if (key === 'tags' || key === 'attachments') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString(), transactionId);

    const result = await this.db.prepare(`
      UPDATE transactions SET ${fields.join(', ')} WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new DatabaseError('Failed to update transaction');
    }

    return await this.findById(transactionId);
  }

  async delete(transactionId) {
    // Get splits to reverse account balance changes
    const splits = await this.db.prepare(`
      SELECT account_id, amount FROM transaction_splits WHERE transaction_id = ?
    `).bind(transactionId).all();

    // Reverse account balance changes
    for (const split of splits.results || []) {
      await this.db.prepare(`
        UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?
      `).bind(split.amount, new Date().toISOString(), split.account_id).run();
    }

    // Delete splits and transaction
    await this.db.prepare(`
      DELETE FROM transaction_splits WHERE transaction_id = ?
    `).bind(transactionId).run();

    const result = await this.db.prepare(`
      DELETE FROM transactions WHERE id = ?
    `).bind(transactionId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to delete transaction');
    }

    return { deleted: true, transactionId };
  }

  async createBatch(transactions, userId) {
    const results = [];
    const errors = [];

    for (const transactionData of transactions) {
      try {
        const transaction = await this.create(transactionData, userId);
        results.push(transaction);
      } catch (error) {
        errors.push({ data: transactionData, error: error.message });
      }
    }

    return {
      created: results,
      errors,
      total: transactions.length,
      successCount: results.length,
      errorCount: errors.length
    };
  }

  async search(bookId, query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const transactions = await this.db.prepare(`
      SELECT 
        t.id, t.description, t.transaction_date,
        c.name as category_name, c.icon as category_icon,
        a.name as account_name
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      LEFT JOIN categories c ON ts.category_id = c.id
      LEFT JOIN accounts a ON ts.account_id = a.id
      WHERE t.book_id = ? AND (t.description LIKE ? OR c.name LIKE ? OR a.name LIKE ?)
      ORDER BY t.transaction_date DESC
      LIMIT ? OFFSET ?
    `).bind(bookId, `%${query}%`, `%${query}%`, `%${query}%`, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      LEFT JOIN categories c ON ts.category_id = c.id
      LEFT JOIN accounts a ON ts.account_id = a.id
      WHERE t.book_id = ? AND (t.description LIKE ? OR c.name LIKE ? OR a.name LIKE ?)
    `).bind(bookId, `%${query}%`, `%${query}%`, `%${query}%`).first();

    return {
      transactions: transactions.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async getSummary(bookId, options = {}) {
    const { period = 'month', startDate, endDate } = options;
    
    let dateFilter = '';
    let params = [bookId];

    if (startDate && endDate) {
      dateFilter = 'AND t.transaction_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      // Default to current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      dateFilter = 'AND t.transaction_date BETWEEN ? AND ?';
      params.push(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]);
    }

    const summary = await this.db.prepare(`
      SELECT 
        SUM(CASE WHEN ts.amount > 0 THEN ts.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN ts.amount < 0 THEN ABS(ts.amount) ELSE 0 END) as total_expense,
        COUNT(DISTINCT t.id) as transaction_count,
        COUNT(DISTINCT t.contact_id) as contact_count
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      WHERE t.book_id = ? AND t.status = 'CONFIRMED' ${dateFilter}
    `).bind(...params).first();

    return summary;
  }
}

# Analytics Model
export class AnalyticsModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }

  async getBookAnalytics(bookId, query) {
    const { period = 'month', startDate, endDate, groupBy = 'category' } = query;
    
    // Get date range
    const { start, end } = this.getDateRange(period, startDate, endDate);
    
    const analytics = {
      period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      summary: await this.getSummary(bookId, start, end),
      trends: await this.getTrends(bookId, start, end, groupBy),
      topCategories: await this.getTopCategories(bookId, start, end),
      cashflow: await this.getCashflow(bookId, start, end)
    };

    return analytics;
  }

  async getSummary(bookId, startDate, endDate) {
    const summary = await this.db.prepare(`
      SELECT 
        SUM(CASE WHEN ts.amount > 0 THEN ts.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN ts.amount < 0 THEN ABS(ts.amount) ELSE 0 END) as total_expense,
        COUNT(DISTINCT t.id) as transaction_count,
        AVG(ts.amount) as avg_transaction_amount
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      WHERE t.book_id = ? AND t.status = 'CONFIRMED' 
        AND t.transaction_date BETWEEN ? AND ?
    `).bind(bookId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).first();

    summary.net_income = (summary.total_income || 0) - (summary.total_expense || 0);
    summary.total_income = summary.total_income || 0;
    summary.total_expense = summary.total_expense || 0;

    return summary;
  }

  async getTrends(bookId, startDate, endDate, groupBy) {
    let dateFormat = '%Y-%m';
    
    if (groupBy === 'day') {
      dateFormat = '%Y-%m-%d';
    } else if (groupBy === 'week') {
      dateFormat = '%Y-%W';
    } else if (groupBy === 'year') {
      dateFormat = '%Y';
    }

    const trends = await this.db.prepare(`
      SELECT 
        strftime('${dateFormat}', t.transaction_date) as period,
        SUM(CASE WHEN ts.amount > 0 THEN ts.amount ELSE 0 END) as income,
        SUM(CASE WHEN ts.amount < 0 THEN ABS(ts.amount) ELSE 0 END) as expense,
        COUNT(DISTINCT t.id) as transaction_count
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      WHERE t.book_id = ? AND t.status = 'CONFIRMED' 
        AND t.transaction_date BETWEEN ? AND ?
      GROUP BY strftime('${dateFormat}', t.transaction_date)
      ORDER BY period ASC
    `).bind(bookId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).all();

    return trends.results || [];
  }

  async getTopCategories(bookId, startDate, endDate, limit = 10) {
    const categories = await this.db.prepare(`
      SELECT 
        c.name, c.icon, c.type,
        SUM(ABS(ts.amount)) as total_amount,
        COUNT(DISTINCT t.id) as transaction_count
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      JOIN categories c ON ts.category_id = c.id
      WHERE t.book_id = ? AND t.status = 'CONFIRMED' 
        AND t.transaction_date BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY total_amount DESC
      LIMIT ?
    `).bind(bookId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], limit).all();

    return categories.results || [];
  }

  async getCashflow(bookId, startDate, endDate) {
    const cashflow = await this.db.prepare(`
      SELECT 
        a.name as account_name,
        a.type,
        SUM(ts.amount) as net_change,
        (SELECT balance FROM accounts WHERE id = a.id) as current_balance
      FROM transactions t
      JOIN transaction_splits ts ON t.id = ts.transaction_id
      JOIN accounts a ON ts.account_id = a.id
      WHERE t.book_id = ? AND t.status = 'CONFIRMED' 
        AND t.transaction_date BETWEEN ? AND ?
      GROUP BY a.id
      ORDER BY net_change DESC
    `).bind(bookId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).all();

    return cashflow.results || [];
  }

  getDateRange(period, startDate, endDate) {
    const now = new Date();
    let start, end;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case 'today':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'week':
          start = new Date(now.setDate(now.getDate() - now.getDay()));
          end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), quarter * 3, 1);
          end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    return { start, end };
  }
}

# Admin Model
export class AdminModel {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
  }

  async getSystemOverview() {
    const overview = await this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE') as active_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-30 days')) as new_users_30d,
        (SELECT COUNT(*) FROM books WHERE status = 'ACTIVE') as active_books,
        (SELECT COUNT(*) FROM books WHERE created_at >= datetime('now', '-30 days')) as new_books_30d,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= datetime('now', '-30 days')) as transactions_30d,
        (SELECT COUNT(*) FROM sessions WHERE expires_at > datetime('now')) as active_sessions
    `).first();

    return overview;
  }

  async getUsers(options = {}) {
    const { page = 1, limit = 20, search, role, status } = options;
    const offset = (page - 1) * limit;

    let whereConditions = ['status != "DELETED"'];
    let params = [];

    if (search) {
      whereConditions.push('(full_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    const users = await this.db.prepare(`
      SELECT id, email, full_name, avatar_url, role, status, email_verified, created_at, last_login_at
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total FROM users WHERE ${whereClause}
    `).bind(...params).first();

    return {
      users: users.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async getUserById(userId) {
    const user = await this.db.prepare(`
      SELECT id, email, full_name, avatar_url, role, status, email_verified, timezone, language, created_at, updated_at, last_login_at
      FROM users
      WHERE id = ? AND status != 'DELETED'
    `).bind(userId).first();

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async updateUser(userId, updateData) {
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
    params.push(new Date().toISOString(), userId);

    const result = await this.db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new DatabaseError('Failed to update user');
    }

    return await this.getUserById(userId);
  }

  async suspendUser(userId, options = {}) {
    const { reason, duration } = options;
    
    await this.db.prepare(`
      UPDATE users SET status = 'SUSPENDED', updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), userId).run();

    // Revoke all sessions
    await this.db.prepare(`
      UPDATE sessions SET expires_at = ? WHERE user_id = ?
    `).bind(new Date().toISOString(), userId).run();

    return { suspended: true, userId, reason, duration };
  }

  async unsuspendUser(userId) {
    const result = await this.db.prepare(`
      UPDATE users SET status = 'ACTIVE', updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), userId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to unsuspend user');
    }

    return { unsuspended: true, userId };
  }

  async getBooks(options = {}) {
    const { page = 1, limit = 20, search, status, moduleType } = options;
    const offset = (page - 1) * limit;

    let whereConditions = ['status != "DELETED"'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (moduleType) {
      whereConditions.push('module_type = ?');
      params.push(moduleType);
    }

    const whereClause = whereConditions.join(' AND ');

    const books = await this.db.prepare(`
      SELECT b.*, u.full_name as creator_name
      FROM books b
      JOIN users u ON b.created_by = u.id
      WHERE ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total FROM books WHERE ${whereClause}
    `).bind(...params).first();

    return {
      books: books.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async getBookById(bookId) {
    const book = await this.db.prepare(`
      SELECT b.*, u.full_name as creator_name
      FROM books b
      JOIN users u ON b.created_by = u.id
      WHERE b.id = ? AND b.status != 'DELETED'
    `).bind(bookId).first();

    if (!book) {
      throw new NotFoundError('Book');
    }

    return book;
  }

  async archiveBook(bookId, options = {}) {
    const { reason } = options;
    
    const result = await this.db.prepare(`
      UPDATE books SET status = 'ARCHIVED', updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), bookId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to archive book');
    }

    return { archived: true, bookId, reason };
  }

  async getSystemConfig() {
    const config = await this.db.prepare(`
      SELECT key, value, description, is_public FROM system_config ORDER BY key
    `).all();

    const configObj = {};
    for (const item of config.results || []) {
      configObj[item.key] = {
        value: item.value,
        description: item.description,
        isPublic: Boolean(item.is_public)
      };
    }

    return configObj;
  }

  async updateSystemConfig(configData) {
    const results = [];

    for (const [key, data] of Object.entries(configData)) {
      const result = await this.db.prepare(`
        INSERT OR REPLACE INTO system_config (key, value, description, is_public, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        key,
        data.value,
        data.description || null,
        data.isPublic || false,
        new Date().toISOString()
      ).run();

      results.push({ key, success: result.success });
    }

    return results;
  }

  async getWebhooks(options = {}) {
    const { page = 1, limit = 20, search, isActive } = options;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR url LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (isActive !== undefined) {
      whereConditions.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const webhooks = await this.db.prepare(`
      SELECT w.*, u.email as user_email
      FROM webhooks w
      JOIN users u ON w.user_id = u.id
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total FROM webhooks ${whereClause}
    `).bind(...params).first();

    return {
      webhooks: webhooks.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async createWebhook(webhookData) {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const result = await this.db.prepare(`
      INSERT INTO webhooks (id, user_id, name, url, events, secret, is_active, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      webhookData.userId,
      webhookData.name,
      webhookData.url,
      JSON.stringify(webhookData.events),
      webhookData.secret,
      webhookData.isActive ? 1 : 0,
      webhookData.description || null,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    if (!result.success) {
      throw new DatabaseError('Failed to create webhook');
    }

    return await this.getWebhookById(id);
  }

  async getWebhookById(webhookId) {
    const webhook = await this.db.prepare(`
      SELECT w.*, u.email as user_email
      FROM webhooks w
      JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `).bind(webhookId).first();

    if (!webhook) {
      throw new NotFoundError('Webhook');
    }

    webhook.events = JSON.parse(webhook.events || '[]');
    return webhook;
  }

  async updateWebhook(webhookId, updateData) {
    const fields = [];
    const params = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        if (key === 'events') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(value));
        } else if (key === 'isActive') {
          fields.push('is_active = ?');
          params.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString(), webhookId);

    const result = await this.db.prepare(`
      UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new DatabaseError('Failed to update webhook');
    }

    return await this.getWebhookById(webhookId);
  }

  async deleteWebhook(webhookId) {
    const result = await this.db.prepare(`
      DELETE FROM webhooks WHERE id = ?
    `).bind(webhookId).run();

    if (!result.success) {
      throw new DatabaseError('Failed to delete webhook');
    }

    return { deleted: true, webhookId };
  }

  async testWebhook(webhookId) {
    const webhook = await this.getWebhookById(webhookId);
    
    // Mock test - in production, you'd send an actual test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook payload' }
    };

    return {
      webhookId,
      testPayload,
      status: 'success',
      message: 'Webhook test completed successfully'
    };
  }

  async getAuditLogs(options = {}) {
    const { page = 1, limit = 20, userId, action, resource, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (userId) {
      whereConditions.push('user_id = ?');
      params.push(userId);
    }

    if (action) {
      whereConditions.push('action = ?');
      params.push(action);
    }

    if (resource) {
      whereConditions.push('resource_type = ?');
      params.push(resource);
    }

    if (startDate && endDate) {
      whereConditions.push('created_at BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const logs = await this.db.prepare(`
      SELECT al.*, u.full_name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const count = await this.db.prepare(`
      SELECT COUNT(*) as total FROM audit_logs ${whereClause}
    `).bind(...params).first();

    return {
      logs: logs.results || [],
      pagination: {
        page,
        limit,
        total: count?.total || 0,
        totalPages: Math.ceil((count?.total || 0) / limit)
      }
    };
  }

  async getSystemHealth() {
    const health = {
      database: await this.checkDatabaseHealth(),
      cache: await this.checkCacheHealth(),
      external: await this.checkExternalServicesHealth()
    };

    health.overall = health.database.status === 'healthy' && 
                     health.cache.status === 'healthy' ? 'healthy' : 'degraded';

    return health;
  }

  async checkDatabaseHealth() {
    try {
      const result = await this.db.prepare('SELECT 1 as test').first();
      return {
        status: result ? 'healthy' : 'unhealthy',
        responseTime: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkCacheHealth() {
    // Mock cache health check
    return {
      status: 'healthy',
      responseTime: Date.now()
    };
  }

  async checkExternalServicesHealth() {
    // Mock external services health check
    return {
      status: 'healthy',
      services: {
        email: 'configured',
        oauth: 'configured'
      }
    };
  }

  async getSystemMetrics(options = {}) {
    const { period = '24h' } = options;
    
    let timeFilter = "datetime('now', '-24 hours')";
    if (period === '7d') {
      timeFilter = "datetime('now', '-7 days')";
    } else if (period === '30d') {
      timeFilter = "datetime('now', '-30 days')";
    }

    const metrics = await this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE created_at >= ${timeFilter}) as new_users,
        (SELECT COUNT(*) FROM books WHERE created_at >= ${timeFilter}) as new_books,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= ${timeFilter}) as new_transactions,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= ${timeFilter}) as new_sessions,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at >= ${timeFilter}) as total_actions
    `).first();

    return metrics;
  }
}

export { BookModel, TransactionModel, AnalyticsModel, AdminModel };