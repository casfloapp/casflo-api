// src/db/queries.js
import bcrypt from 'bcryptjs';

// --- [DIPERTAHANKAN] User & Verification Code Queries ---
export const findUserByGoogleId = async (db, googleId) => {
  return await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first();
};
export const findUserByEmail = async (db, email) => {
  return await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
};
export const createUserWithGoogle = async (db, user) => {
  const newId = `us-${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO users (id, google_id, full_name, email, avatar_url, is_email_verified) VALUES (?, ?, ?, ?, ?, 1)')
    .bind(newId, user.google_id, user.full_name, user.email, user.avatar_url).run();
  return { id: newId, ...user };
};
export const createUserWithPassword = async (db, userData) => {
    const existingUser = await findUserByEmail(db, userData.email);
    if (existingUser) {
        return { error: 'Email already exists' };
    }
    const newId = `us-${crypto.randomUUID()}`;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    await db.prepare('INSERT INTO users (id, full_name, email, hashed_password) VALUES (?, ?, ?, ?)')
        .bind(newId, userData.fullName, userData.email, hashedPassword).run();
    const newUser = await db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').bind(newId).first();
    return { data: newUser };
};
export const verifyUserEmail = async (db, email) => {
    return await db.prepare('UPDATE users SET is_email_verified = 1 WHERE email = ?').bind(email).run();
};
export const saveVerificationCode = async (db, email, code) => {
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  return await db.prepare('INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)')
    .bind(email, code, expires_at.toISOString()).run();
};
export const findVerificationCode = async (db, email) => {
  return await db.prepare('SELECT * FROM verification_codes WHERE email = ?').bind(email).first();
};
export const deleteVerificationCode = async (db, email) => {
  return await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run();
};

// --- [DIPERTAHANKAN & DIUBAH] Wallet & Member Queries ---
export const findWalletsByUserId = async (db, userId) => {
  const stmt = db.prepare('SELECT w.*, wm.role FROM wallets w JOIN wallet_members wm ON w.id = wm.wallet_id WHERE wm.user_id = ?');
  return (await stmt.bind(userId).all()).results;
};
export const findWalletById = async (db, walletId) => {
  return await db.prepare('SELECT * FROM wallets WHERE id = ?').bind(walletId).first();
};
export const createWalletWithMember = async (db, walletData, userId) => {
  const newWalletId = `w-${crypto.randomUUID()}`;
  const defaultAccountId = `acc-${crypto.randomUUID()}`;
  const batch = [
    db.prepare('INSERT INTO wallets (id, name, module_type, created_by) VALUES (?, ?, ?, ?)').bind(newWalletId, walletData.name, walletData.moduleType, userId),
    db.prepare('INSERT INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, ?)').bind(newWalletId, userId, 'OWNER'),
    db.prepare("INSERT INTO accounts (id, wallet_id, name, type, balance) VALUES (?, ?, 'Kas Tunai', 'ASSET', 0)").bind(defaultAccountId, newWalletId)
  ];
  await db.batch(batch);
  return { id: newWalletId, ...walletData };
};
export const updateWallet = async (db, walletId, data) => {
  await db.prepare('UPDATE wallets SET name = ?, updated_at = datetime("now","localtime"), updated_by = ? WHERE id = ?')
    .bind(data.name, data.updated_by, walletId).run();
  return { id: walletId, name: data.name };
};
export const deleteWallet = async (db, walletId) => {
  return await db.prepare('DELETE FROM wallets WHERE id = ?').bind(walletId).run();
};
export const findMember = async (db, walletId, userId) => {
  return await db.prepare('SELECT * FROM wallet_members WHERE wallet_id = ? AND user_id = ?').bind(walletId, userId).first();
};
export const findMembersByWalletId = async (db, walletId) => {
  const stmt = db.prepare('SELECT u.id, u.full_name, u.email, u.avatar_url, wm.role FROM users u JOIN wallet_members wm ON u.id = wm.user_id WHERE wm.wallet_id = ?');
  return (await stmt.bind(walletId).all()).results;
};
export const addWalletMember = async (db, walletId, userId, role) => {
  return await db.prepare('INSERT INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, ?)').bind(walletId, userId, role).run();
};
export const removeWalletMember = async (db, walletId, userId) => {
  return await db.prepare('DELETE FROM wallet_members WHERE wallet_id = ? AND user_id = ?').bind(walletId, userId).run();
};

// --- [BARU] CRUD untuk Accounts ---
export const findAccountsByWalletId = async (db, walletId) => {
  return (await db.prepare('SELECT * FROM accounts WHERE wallet_id = ? AND is_archived = 0 ORDER BY type, name ASC').bind(walletId).all()).results;
};
export const createAccount = async (db, data) => {
  const newId = `acc-${crypto.randomUUID()}`;
  const balanceInCents = Math.round((data.balance || 0) * 100);
  await db.prepare('INSERT INTO accounts (id, wallet_id, name, type, balance) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, data.wallet_id, data.name, data.type, balanceInCents).run();
  return { id: newId, ...data };
};
export const updateAccount = async (db, accountId, data) => {
    await db.prepare('UPDATE accounts SET name = ?, type = ?, is_archived = ? WHERE id = ?')
        .bind(data.name, data.type, data.is_archived, accountId).run();
    return { id: accountId, ...data };
};
export const deleteAccount = async (db, accountId) => {
    const account = await db.prepare('SELECT balance FROM accounts WHERE id = ?').bind(accountId).first();
    if (account && account.balance !== 0) {
      return { error: 'Cannot delete account with a non-zero balance.' };
    }
    await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
    return { success: true };
};

// --- [DIPERTAHANKAN] CRUD untuk Categories & Contacts ---
export const findCategoriesByWalletId = async (db, walletId) => {
  return (await db.prepare('SELECT * FROM categories WHERE wallet_id = ? ORDER BY name ASC').bind(walletId).all()).results;
};
export const createCategory = async (db, data) => {
  const newId = `ca-${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO categories (id, wallet_id, name, type) VALUES (?, ?, ?, ?)').bind(newId, data.wallet_id, data.name, data.type).run();
  return { id: newId, ...data };
};
export const updateCategory = async (db, categoryId, data) => {
  await db.prepare('UPDATE categories SET name = ?, type = ? WHERE id = ?').bind(data.name, data.type, categoryId).run();
  return { id: categoryId, ...data };
};
export const deleteCategory = async (db, categoryId) => {
  return await db.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();
};
export const findContactsByWalletId = async (db, walletId) => {
    return (await db.prepare('SELECT * FROM contacts WHERE wallet_id = ? ORDER BY name ASC').bind(walletId).all()).results;
};
export const createContact = async (db, data, userId) => {
    const newId = `co-${crypto.randomUUID()}`;
    await db.prepare('INSERT INTO contacts (id, wallet_id, name, phone, description, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId, data.wallet_id, data.name, data.phone, data.description, userId).run();
    return { id: newId, ...data };
};
export const updateContact = async (db, contactId, data) => {
    await db.prepare('UPDATE contacts SET name = ?, phone = ?, description = ? WHERE id = ?')
        .bind(data.name, data.phone, data.description, contactId).run();
    return { id: contactId, ...data };
};
export const deleteContact = async (db, contactId) => {
    return await db.prepare('DELETE FROM contacts WHERE id = ?').bind(contactId).run();
};

// --- [DIUBAH TOTAL] Logika untuk Transactions ---
export const findTransactionsByWalletId = async (db, walletId, filters = {}) => {
  let baseQuery = `
    SELECT DISTINCT
      t.id,
      t.description,
      t.transaction_date,
      t.created_at,
      (SELECT GROUP_CONCAT(c.name) FROM transaction_splits s JOIN categories c ON s.category_id = c.id WHERE s.transaction_id = t.id) as category_name,
      (SELECT ABS(SUM(s.amount)) FROM transaction_splits s WHERE s.transaction_id = t.id AND s.amount > 0) as amount
    FROM transactions t
  `;
  const joins = [], whereClauses = ['t.wallet_id = ?'], params = [walletId];
  if (filters.accountId || filters.categoryId) {
    joins.push('JOIN transaction_splits s_filter ON t.id = s_filter.transaction_id');
    if (filters.accountId) { whereClauses.push('s_filter.account_id = ?'); params.push(filters.accountId); }
    if (filters.categoryId) { whereClauses.push('s_filter.category_id = ?'); params.push(filters.categoryId); }
  }
  if (filters.startDate && filters.endDate) {
    whereClauses.push('t.transaction_date BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  }
  const finalQuery = `${baseQuery} ${joins.join(' ')} WHERE ${whereClauses.join(' AND ')} ORDER BY t.transaction_date DESC, t.created_at DESC`;
  return (await db.prepare(finalQuery).bind(...params).all()).results;
};

export const createTransaction = async (db, data, userId) => {
  const amountInCents = Math.round(data.amount * 100);
  if (!amountInCents || amountInCents <= 0) return { error: 'Invalid amount' };
  const newTxId = `tx-${crypto.randomUUID()}`;
  const batch = [
    db.prepare('INSERT INTO transactions (id, wallet_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newTxId, data.wallet_id, data.contact_id, data.description, data.transaction_date, userId)
  ];
  if (data.type === 'EXPENSE') {
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, category_id, amount, type) VALUES (?, ?, ?, ?, 'DEBIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.category_id, amountInCents));
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'CREDIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, -amountInCents));
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amountInCents, data.from_account_id));
  } else if (data.type === 'INCOME') {
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'DEBIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, amountInCents));
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, category_id, amount, type) VALUES (?, ?, ?, ?, 'CREDIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.category_id, -amountInCents));
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amountInCents, data.to_account_id));
  } else if (data.type === 'TRANSFER') {
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'DEBIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, amountInCents));
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'CREDIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, -amountInCents));
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amountInCents, data.to_account_id));
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amountInCents, data.from_account_id));
  } else { return { error: 'Invalid transaction type' }; }
  await db.batch(batch);
  return { id: newTxId, ...data };
};

export const deleteTransaction = async (db, transactionId) => {
  const splits = (await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ?').bind(transactionId).all()).results;
  if (!splits || splits.length === 0) return { error: "Transaction not found or has no splits."};
  const batch = [];
  for (const split of splits) {
    if (split.account_id) {
        batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(split.amount, split.account_id));
    }
  }
  batch.push(db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').bind(transactionId));
  batch.push(db.prepare('DELETE FROM transactions WHERE id = ?').bind(transactionId));
  await db.batch(batch);
  return { success: true };
};
// Catatan: updateTransaction sengaja tidak diimplementasikan karena kompleks.
// Pola yang disarankan adalah delete-then-create di sisi frontend.

// --- [DIUBAH TOTAL] Logika untuk Wallet Summary ---
export const getWalletSummary = async (db, walletId) => {
    const assetsResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'ASSET' AND is_archived = 0").bind(walletId).first('total');
    const liabilitiesResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'LIABILITY' AND is_archived = 0").bind(walletId).first('total');
    const now = new Date(), startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const incomeQuery = `SELECT SUM(s.amount) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'INCOME' AND t.transaction_date BETWEEN ? AND ?`;
    const expenseQuery = `SELECT ABS(SUM(s.amount)) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?`;
    const monthlyIncomeResult = await db.prepare(incomeQuery).bind(walletId, startDate, endDate).first('total');
    const monthlyExpenseResult = await db.prepare(expenseQuery).bind(walletId, startDate, endDate).first('total');
    return { assets: assetsResult || 0, liabilities: liabilitiesResult || 0, net_worth: (assetsResult || 0) - (liabilitiesResult || 0), monthly_income: monthlyIncomeResult || 0, monthly_expense: monthlyExpenseResult || 0 };
};

// --- [BARU] Query untuk Laporan, Anggaran, Pengaturan, dll ---
export const getExpenseReportByCategory = async (db, walletId, filters = {}) => {
  let query = `SELECT c.name as category_name, c.id as category_id, SUM(s.amount) as total_amount FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'EXPENSE'`;
  const params = [walletId];
  if (filters.startDate && filters.endDate) { query += ' AND t.transaction_date BETWEEN ? AND ?'; params.push(filters.startDate, filters.endDate); }
  query += ' GROUP BY c.id, c.name ORDER BY total_amount DESC';
  return (await db.prepare(query).bind(...params).all()).results;
};

export const findBudgetsByWalletId = async (db, walletId) => {
  const query = `
    SELECT b.id, b.name, b.amount, b.period, b.start_date,
      (SELECT GROUP_CONCAT(c.name) FROM budget_categories bc JOIN categories c ON bc.category_id = c.id WHERE bc.budget_id = b.id) as categories
    FROM budgets b WHERE b.wallet_id = ?`;
  return (await db.prepare(query).bind(walletId).all()).results;
};
export const createBudget = async (db, data) => {
  const newBudgetId = `b-${crypto.randomUUID()}`;
  const amountInCents = Math.round(data.amount * 100);
  const batch = [
    db.prepare('INSERT INTO budgets (id, wallet_id, name, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newBudgetId, data.wallet_id, data.name, amountInCents, data.period, data.start_date)
  ];
  if (data.categoryIds && data.categoryIds.length > 0) {
    for (const categoryId of data.categoryIds) {
      batch.push(db.prepare('INSERT INTO budget_categories (budget_id, category_id) VALUES (?, ?)').bind(newBudgetId, categoryId));
    }
  }
  await db.batch(batch);
  return { id: newBudgetId, ...data };
};
export const deleteBudget = async (db, budgetId) => {
  return await db.prepare('DELETE FROM budgets WHERE id = ?').bind(budgetId).run();
};

export const findRecurringTransactionsByWalletId = async (db, walletId) => {
    return (await db.prepare('SELECT * FROM recurring_transactions WHERE wallet_id = ? AND is_active = 1').bind(walletId).all()).results;
};
export const createRecurringTransaction = async (db, data) => {
    const newId = `rt-${crypto.randomUUID()}`;
    const amountInCents = Math.round(data.amount * 100);
    await db.prepare(`INSERT INTO recurring_transactions (id, wallet_id, description, amount, type, frequency, start_date, next_due_date, category_id, from_account_id, to_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId, data.wallet_id, data.description, amountInCents, data.type, data.frequency, data.start_date, data.next_due_date, data.category_id, data.from_account_id, data.to_account_id).run();
    return { id: newId, ...data };
};
export const deleteRecurringTransaction = async (db, rtId) => {
    return await db.prepare('DELETE FROM recurring_transactions WHERE id = ?').bind(rtId).run();
};

export const findSettingsByWalletId = async (db, walletId) => {
    let settings = await db.prepare('SELECT * FROM wallet_settings WHERE wallet_id = ?').bind(walletId).first();
    if (!settings) {
        return { wallet_id: walletId, start_of_month: 1, theme: 'SYSTEM', language: 'id-ID' };
    }
    return settings;
};
export const updateSettings = async (db, walletId, data) => {
    await db.prepare(`INSERT INTO wallet_settings (wallet_id, start_of_month, theme, language) VALUES (?, ?, ?, ?) ON CONFLICT(wallet_id) DO UPDATE SET start_of_month = excluded.start_of_month, theme = excluded.theme, language = excluded.language`).bind(walletId, data.start_of_month, data.theme, data.language).run();
    return { wallet_id: walletId, ...data };
};

export const findRemindersByWalletId = async (db, walletId) => {
    return (await db.prepare('SELECT * FROM reminders WHERE wallet_id = ? AND is_active = 1 ORDER BY reminder_date ASC').bind(walletId).all()).results;
};
export const createReminder = async (db, data) => {
    const newId = `rem-${crypto.randomUUID()}`;
    const amountInCents = data.amount ? Math.round(data.amount * 100) : null;
    await db.prepare('INSERT INTO reminders (id, wallet_id, description, amount, reminder_date) VALUES (?, ?, ?, ?, ?)')
        .bind(newId, data.wallet_id, data.description, amountInCents, data.reminder_date).run();
    return { id: newId, ...data };
};
export const updateReminder = async (db, reminderId, data) => {
    const amountInCents = data.amount ? Math.round(data.amount * 100) : null;
    await db.prepare('UPDATE reminders SET description = ?, amount = ?, reminder_date = ?, is_active = ? WHERE id = ?')
        .bind(data.description, amountInCents, data.reminder_date, data.is_active, reminderId).run();
    return { id: reminderId, ...data };
};
export const deleteReminder = async (db, reminderId) => {
    return await db.prepare('DELETE FROM reminders WHERE id = ?').bind(reminderId).run();
};

// --- [BARU] CRUD untuk Catatan (Notes) ---
export const findNotesByWalletId = async (db, walletId, filters = {}) => {
    let query = 'SELECT * FROM notes WHERE wallet_id = ?';
    const params = [walletId];
    if (filters.date) {
        query += ' AND note_date = ?';
        params.push(filters.date);
    }
    query += ' ORDER BY note_date DESC';
    return (await db.prepare(query).bind(...params).all()).results;
};
export const createNote = async (db, data, userId) => {
    const newId = `note-${crypto.randomUUID()}`;
    await db.prepare('INSERT INTO notes (id, wallet_id, title, content, note_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId, data.wallet_id, data.title, data.content, data.note_date, userId).run();
    return { id: newId, ...data };
};
export const updateNote = async (db, noteId, data, userId) => {
    await db.prepare('UPDATE notes SET title = ?, content = ?, note_date = ?, updated_at = datetime("now","localtime"), updated_by = ? WHERE id = ?')
        .bind(data.title, data.content, data.note_date, userId, noteId).run();
    return { id: noteId, ...data };
};
export const deleteNote = async (db, noteId) => {
    return await db.prepare('DELETE FROM notes WHERE id = ?').bind(noteId).run();
};
