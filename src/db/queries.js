// src/db/queries.js
import bcrypt from 'bcryptjs';

// --- [DIPERTAHANKAN] User & Verification Code Queries ---
// Fungsi-fungsi di bagian ini sebagian besar tidak diubah.
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
// Diubah untuk menerima email agar sesuai dengan alur di auth.js
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

// --- [DIPERTAHANKAN & SEDIKIT DIUBAH] Wallet & Member Queries ---
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
    // Saat wallet dibuat, otomatis buatkan 1 akun default "Kas Tunai"
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
// ...Fungsi member lainnya (find, add, remove) dipertahankan seperti di file Anda...

// --- [BARU] CRUD untuk Accounts ---
export const findAccountsByWalletId = async (db, walletId) => {
  return (await db.prepare('SELECT * FROM accounts WHERE wallet_id = ? AND is_archived = 0 ORDER BY type, name ASC').bind(walletId).all()).results;
};
export const createAccount = async (db, data) => {
  const newId = `acc-${crypto.randomUUID()}`;
  // Simpan balance dalam sen untuk menghindari masalah floating point
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
    // Tambahkan validasi (misal: tidak bisa hapus jika saldo tidak nol)
    const account = await db.prepare('SELECT balance FROM accounts WHERE id = ?').bind(accountId).first();
    if (account && account.balance !== 0) {
      return { error: 'Cannot delete account with a non-zero balance.' };
    }
    await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
    return { success: true };
};


// --- [DIPERTAHANKAN] CRUD untuk Categories & Contacts ---
// Semua fungsi CRUD untuk kategori dan kontak dari file Anda dipertahankan di sini.
// ... (createCategory, updateCategory, deleteCategory, etc.) ...

// --- [DIUBAH TOTAL] Logika untuk Transactions ---

/**
 * Fungsi baru yang fleksibel untuk mencari transaksi dengan berbagai filter.
 */
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

  const joins = [];
  const whereClauses = ['t.wallet_id = ?'];
  const params = [walletId];

  // Logika filter berdasarkan akun atau kategori
  if (filters.accountId || filters.categoryId) {
    joins.push('JOIN transaction_splits s_filter ON t.id = s_filter.transaction_id');
    if (filters.accountId) {
      whereClauses.push('s_filter.account_id = ?');
      params.push(filters.accountId);
    }
    if (filters.categoryId) {
      whereClauses.push('s_filter.category_id = ?');
      params.push(filters.categoryId);
    }
  }
  // Logika filter tanggal (untuk kalender)
  if (filters.startDate && filters.endDate) {
    whereClauses.push('t.transaction_date BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  }
  
  const finalQuery = `${baseQuery} ${joins.join(' ')} WHERE ${whereClauses.join(' AND ')} ORDER BY t.transaction_date DESC, t.created_at DESC`;
  return (await db.prepare(finalQuery).bind(...params).all()).results;
};


/**
 * Fungsi baru untuk membuat transaksi dengan sistem entri ganda.
 */
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
  } else {
    return { error: 'Invalid transaction type' };
  }

  await db.batch(batch);
  return { id: newTxId, ...data };
};


/**
 * Fungsi baru untuk menghapus transaksi dengan mengembalikan saldo akun.
 */
export const deleteTransaction = async (db, transactionId) => {
  const splits = (await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ?').bind(transactionId).all()).results;
  if (!splits || splits.length === 0) return { error: "Transaction not found or has no splits."};

  const batch = [];
  // Balikkan semua pergerakan dana di akun
  for (const split of splits) {
    if (split.account_id) {
        batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(split.amount, split.account_id));
    }
  }

  // Hapus semua splits dan transaksi utamanya
  batch.push(db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').bind(transactionId));
  batch.push(db.prepare('DELETE FROM transactions WHERE id = ?').bind(transactionId));

  await db.batch(batch);
  return { success: true };
};

// updateTransaction sengaja tidak diimplementasikan karena kompleksitasnya tinggi.
// Pendekatan umum: panggil deleteTransaction lalu createTransaction yang baru.


// --- [DIUBAH TOTAL] Logika untuk Wallet Summary ---
/**
 * Fungsi baru untuk summary yang menghitung dari tabel accounts (lebih akurat).
 */
export const getWalletSummary = async (db, walletId) => {
    const assetsResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'ASSET' AND is_archived = 0").bind(walletId).first('total');
    const liabilitiesResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'LIABILITY' AND is_archived = 0").bind(walletId).first('total');
    
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const incomeQuery = `SELECT SUM(s.amount) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'INCOME' AND t.transaction_date BETWEEN ? AND ?`;
    const expenseQuery = `SELECT ABS(SUM(s.amount)) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?`;

    const monthlyIncomeResult = await db.prepare(incomeQuery).bind(walletId, startDate, endDate).first('total');
    const monthlyExpenseResult = await db.prepare(expenseQuery).bind(walletId, startDate, endDate).first('total');
    
    return {
        assets: assetsResult || 0,
        liabilities: liabilitiesResult || 0,
        net_worth: (assetsResult || 0) - (liabilitiesResult || 0),
        monthly_income: monthlyIncomeResult || 0,
        monthly_expense: monthlyExpenseResult || 0
    };
};


// --- [BARU] Query untuk Laporan & Analisis ---
/**
 * Mengambil rekapitulasi total pengeluaran per kategori untuk pie chart.
 */
export const getExpenseReportByCategory = async (db, walletId, filters = {}) => {
  let query = `
    SELECT
      c.name as category_name,
      c.id as category_id,
      SUM(s.amount) as total_amount
    FROM transaction_splits s
    JOIN categories c ON s.category_id = c.id
    JOIN transactions t ON s.transaction_id = t.id
    WHERE
      t.wallet_id = ? AND c.type = 'EXPENSE'
  `;
  
  const params = [walletId];

  if (filters.startDate && filters.endDate) {
    query += ' AND t.transaction_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' GROUP BY c.id, c.name ORDER BY total_amount DESC';

  return (await db.prepare(query).bind(...params).all()).results;
};