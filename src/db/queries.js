// src/db/queries.js
import bcrypt from 'bcryptjs';

// --- [DIPERTAHANKAN & DILENGKAPI] User & Verification Code Queries ---
// [BARU] Tambahkan daftar kategori default di sini
// [BARU] Tambahkan daftar kategori default di sini
const DEFAULT_CATEGORIES = [
  // Pengeluaran
  { name: 'Makanan & Minuman', type: 'EXPENSE', icon: '🍔' },
  { name: 'Transportasi', type: 'EXPENSE', icon: '🚗' },
  { name: 'Tagihan', type: 'EXPENSE', icon: '🧾' },
  { name: 'Belanja', type: 'EXPENSE', icon: '🛍️' },
  { name: 'Hiburan', type: 'EXPENSE', icon: '🎉' },
  { name: 'Kesehatan', type: 'EXPENSE', icon: '❤️' },
  { name: 'Pendidikan', type: 'EXPENSE', icon: '🎓' },
  { name: 'Keluarga', type: 'EXPENSE', icon: '👨‍👩‍👧' },
  { name: 'Hadiah & Donasi', type: 'EXPENSE', icon: '🎁' },
  { name: 'Lainnya (Pengeluaran)', type: 'EXPENSE', icon: '🛒' },
  
  // Pemasukan
  { name: 'Gaji', type: 'INCOME', icon: '💰' },
  { name: 'Bonus', type: 'INCOME', icon: '✨' },
  { name: 'Investasi', type: 'INCOME', icon: '📈' },
  { name: 'Hadiah Diterima', type: 'INCOME', icon: '💝' },
  { name: 'Penjualan', type: 'INCOME', icon: '💸' },
  { name: 'Lainnya (Pemasukan)', type: 'INCOME', icon: '🪙' }
];
/**
 * Mencari user berdasarkan google_id unik mereka.
 */
export const findUserByGoogleId = async (db, googleId) => {
  return await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first();
};

export const findUserByEmail = async (db, email) => {
  return await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
};

export const findUserById = async (db, userId) => {
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
};

/**
 * Membuat user baru yang mendaftar via Google.
 * Email dianggap sudah terverifikasi oleh Google.
 */
export const createUserWithGoogle = async (db, user) => {
  const newId = `us-${crypto.randomUUID()}`;
  
  await db.prepare(
    'INSERT INTO users (id, google_id, full_name, email, avatar_url, is_email_verified) VALUES (?, ?, ?, ?, ?, 1)'
  ).bind(
    newId, 
    user.google_id, 
    user.full_name, 
    user.email, 
    user.avatar_url
  ).run();

  // Kembalikan data user yang baru dibuat
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(newId).first();
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

// --- [DIPERTAHANKAN & DIUBAH] Book & Member Queries ---
export const findBooksByUserId = async (db, userId) => {
  const stmt = db.prepare('SELECT w.id, w.name, w.icon, wm.role FROM books w JOIN book_members wm ON w.id = wm.book_id WHERE wm.user_id = ?');
  return (await stmt.bind(userId).all()).results;
};
export const findBookById = async (db, bookId) => {
  return await db.prepare('SELECT * FROM books WHERE id = ?').bind(bookId).first();
};
export const createBook = (db, name, moduleType, userId, icon) => { // 1. Tambah 'icon'
    const newBookId = nanoid();
    return db.prepare(
        'INSERT INTO books (id, name, module_type, created_by, icon) VALUES (?, ?, ?, ?, ?)' // 2. Tambah 'icon' di query
    ).bind(newBookId, name, moduleType, userId, icon || '📚').run(); // 3. Bind 'icon' (beri default '📚')
};
export const createBookWithMember = async (db, bookData, userId) => {
  const newBookId = `w-${crypto.randomUUID()}`;
  const defaultAccountId = `acc-${crypto.randomUUID()}`;
  const batch = [
      db.prepare('INSERT INTO books (id, name, module_type, created_by, icon) VALUES (?, ?, ?, ?, ?)')
        .bind(newBookId, bookData.name, bookData.moduleType, userId, bookData.icon || '📚'),
      
      // V V V [PERBAIKAN WAJIB ADA DI SINI] V V V
      db.prepare('INSERT INTO book_members (book_id, user_id, role) VALUES (?, ?, ?)').bind(newBookId, userId, 'OWNER'),
      // ^ ^ ^ [AKHIR DARI PERBAIKAN] ^ ^ ^
      
      db.prepare("INSERT INTO accounts (id, book_id, name, type, balance) VALUES (?, ?, 'Kas Tunai', 'ASSET', 0)").bind(defaultAccountId, newBookId)
  ];
  // [BARU] Loop melalui kategori default dan tambahkan ke batch
  DEFAULT_CATEGORIES.forEach(cat => {
    const newCatId = `ca-${crypto.randomUUID()}`;
    batch.push(
      // [DIUBAH] Tambahkan 'icon' dan 'cat.icon'
      db.prepare('INSERT INTO categories (id, book_id, name, type, icon) VALUES (?, ?, ?, ?, ?)')
        .bind(newCatId, newBookId, cat.name, cat.type, cat.icon)
    );
  });
  // [AKHIR BLOK BARU]

  await db.batch(batch);
  return { id: newBookId, ...bookData };
};
export const updateBook = async (db, bookId, data) => {
  // [PERBAIKAN] Tambahkan 'icon = ?'
  await db.prepare('UPDATE books SET name = ?, icon = ?, updated_at = datetime("now","localtime"), updated_by = ? WHERE id = ?')
    // [PERBAIKAN] Tambahkan 'data.icon' ke bind
    .bind(data.name, data.icon || '📚', data.updated_by, bookId).run();
  return { id: bookId, name: data.name, icon: data.icon }; // Kembalikan data icon juga
};
export const deleteBook = async (db, bookId) => {
  return await db.prepare('DELETE FROM books WHERE id = ?').bind(bookId).run();
};
export const findMember = async (db, bookId, userId) => {
  return await db.prepare('SELECT * FROM book_members WHERE book_id = ? AND user_id = ?').bind(bookId, userId).first();
};
export const findMembersByBookId = async (db, bookId) => {
  // [PERBAIKAN] Tambahkan "wm.label" di sini
  const stmt = db.prepare('SELECT u.id, u.full_name, u.email, u.avatar_url, wm.role, wm.label FROM users u JOIN book_members wm ON u.id = wm.user_id WHERE wm.book_id = ?');
  return (await stmt.bind(bookId).all()).results;
};
export const addBookMember = async (db, bookId, userId, role, label) => { // <-- [PERBAIKAN] Tambah 'label'
  // [PERBAIKAN] Tambahkan 'label' dan '?'
  return await db.prepare('INSERT INTO book_members (book_id, user_id, role, label) VALUES (?, ?, ?, ?)')
    .bind(bookId, userId, role, label || null).run(); // Simpan 'null' jika label kosong
};
export const removeBookMember = async (db, bookId, userId) => {
  return await db.prepare('DELETE FROM book_members WHERE book_id = ? AND user_id = ?').bind(bookId, userId).run();
};

// --- [BARU] CRUD untuk Accounts ---
export const findAccountsByBookId = async (db, bookId) => {
  return (await db.prepare('SELECT * FROM accounts WHERE book_id = ? AND is_archived = 0 ORDER BY type, name ASC').bind(bookId).all()).results;
};
export const createAccount = async (db, data) => {
  const newId = `acc-${crypto.randomUUID()}`;
  const balanceInCents = Math.round((data.balance || 0) * 100);
  await db.prepare('INSERT INTO accounts (id, book_id, name, type, balance) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, data.book_id, data.name, data.type, balanceInCents).run();
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
export const findCategoriesByBookId = async (db, bookId) => {
  return (await db.prepare('SELECT * FROM categories WHERE book_id = ? ORDER BY name ASC').bind(bookId).all()).results;
};
export const createCategory = async (db, data) => {
  const newId = `ca-${crypto.randomUUID()}`;
  // [DIUBAH] Tambahkan 'icon' dan 'data.icon'
  await db.prepare('INSERT INTO categories (id, book_id, name, type, icon) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, data.book_id, data.name, data.type, data.icon || null).run();
  return { id: newId, ...data };
};
export const updateCategory = async (db, categoryId, data) => {
  // [DIUBAH] Tambahkan 'icon = ?' dan 'data.icon'
  await db.prepare('UPDATE categories SET name = ?, type = ?, icon = ? WHERE id = ?')
    .bind(data.name, data.type, data.icon || null, categoryId).run();
  return { id: categoryId, ...data };
};
export const deleteCategory = async (db, categoryId) => {
  return await db.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();
};
export const findContactsByBookId = async (db, bookId) => {
    return (await db.prepare('SELECT * FROM contacts WHERE book_id = ? ORDER BY name ASC').bind(bookId).all()).results;
};
export const createContact = async (db, data, userId) => {
    const newId = `co-${crypto.randomUUID()}`;
    await db.prepare('INSERT INTO contacts (id, book_id, name, phone, description, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId, data.book_id, data.name, data.phone, data.description, userId).run();
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
// FUNGSI BARU (PERBAIKAN):
// FUNGSI BARU YANG BENAR:
export const findTransactionsByBookId = async (db, bookId, filters = {}) => {
  let baseQuery = `
    SELECT 
      t.id,
      t.description,
      t.transaction_date,
      t.created_at,
      c.name as category_name,
      c.type as category_type,
      c.icon as category_icon,
      c.id as category_id,      -- [TAMBAHKAN INI]
      s.amount,
      a.name as account_name,
      a.id as account_id        -- [TAMBAHKAN INI]
    FROM transactions t
    JOIN transaction_splits s ON t.id = s.transaction_id
    LEFT JOIN categories c ON s.category_id = c.id
    LEFT JOIN accounts a ON s.account_id = a.id
  `;

  const whereClauses = ['t.book_id = ?', 's.category_id IS NOT NULL']; 
  const params = [bookId];

  if (filters.startDate && filters.endDate) {
    whereClauses.push('t.transaction_date BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  }
  if (filters.accountId) {
    whereClauses.push('s.account_id = ?'); 
    params.push(filters.accountId); 
  }
  if (filters.categoryId) { 
    whereClauses.push('s.category_id = ?'); 
    params.push(filters.categoryId); 
  }

  const finalQuery = `${baseQuery} WHERE ${whereClauses.join(' AND ')} ORDER BY t.transaction_date DESC, t.created_at DESC`;
  return (await db.prepare(finalQuery).bind(...params).all()).results;
};

export const createTransaction = async (db, data, userId) => {
  const amount = Math.round(data.amount); // Hapus * 100, ganti nama var
  if (!amount || amount <= 0) return { error: 'Invalid amount' };
  
  const newTxId = `tx-${crypto.randomUUID()}`;
  
  const batch = [
    db.prepare('INSERT INTO transactions (id, book_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newTxId, data.book_id, data.contact_id || null, data.description, data.transaction_date, userId)
  ];

  const sqlInsertSplit = `
    INSERT INTO transaction_splits 
    (id, transaction_id, account_id, category_id, amount, type) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  if (data.type === 'EXPENSE') {
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, data.category_id, amount, 'DEBIT') // Pakai 'amount'
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, null, -amount, 'CREDIT') // Pakai '-amount'
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amount, data.from_account_id)); // Pakai 'amount'
  
  } else if (data.type === 'INCOME') {
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, null, amount, 'DEBIT') // Pakai 'amount'
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, data.category_id, -amount, 'CREDIT') // Pakai '-amount'
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amount, data.to_account_id)); // Pakai 'amount'
  
  } else if (data.type === 'TRANSFER') {
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, null, amount, 'DEBIT') // Pakai 'amount'
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, null, -amount, 'CREDIT') // Pakai '-amount'
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amount, data.to_account_id)); // Pakai 'amount'
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amount, data.from_account_id)); // Pakai 'amount'
  
  } else { 
    return { error: 'Invalid transaction type' }; 
  }
  
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

// ... (setelah deleteTransaction)

export const updateTransaction = async (db, txId, data, userId) => {
  const newAmount = Math.round(data.amount);
  if (!newAmount || newAmount <= 0) return { error: 'Invalid amount' };

  // 1. Dapatkan split lama untuk mengembalikan saldo
  const oldSplits = (await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ?').bind(txId).all()).results;
  if (!oldSplits || oldSplits.length === 0) return { error: "Transaction not found or has no splits."};

  const batch = [];

  // 2. Kembalikan saldo akun lama
  for (const split of oldSplits) {
    if (split.account_id) {
        batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(split.amount, split.account_id));
    }
  }

  // 3. Hapus split lama
  batch.push(db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').bind(txId));

  // 4. Perbarui data transaksi utama
  batch.push(
    db.prepare('UPDATE transactions SET contact_id = ?, description = ?, transaction_date = ?, updated_at = datetime("now","localtime"), updated_by = ? WHERE id = ?')
      .bind(data.contact_id || null, data.description, data.transaction_date, userId, txId)
  );
  
  // 5. Buat split baru (logika disalin dari createTransaction)
  const sqlInsertSplit = `
    INSERT INTO transaction_splits 
    (id, transaction_id, account_id, category_id, amount, type) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  if (data.type === 'EXPENSE') {
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.from_account_id, data.category_id, newAmount, 'DEBIT')
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.from_account_id, null, -newAmount, 'CREDIT')
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(newAmount, data.from_account_id));
  
  } else if (data.type === 'INCOME') {
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.to_account_id, null, newAmount, 'DEBIT')
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.to_account_id, data.category_id, -newAmount, 'CREDIT')
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(newAmount, data.to_account_id));
  
  } else if (data.type === 'TRANSFER') {
    // (Logika transfer tidak diubah)
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.to_account_id, null, newAmount, 'DEBIT')
    );
    batch.push(
      db.prepare(sqlInsertSplit)
        .bind(`spl-${crypto.randomUUID()}`, txId, data.from_account_id, null, -newAmount, 'CREDIT')
    );
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(newAmount, data.to_account_id));
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(newAmount, data.from_account_id));
  
  } else { 
    return { error: 'Invalid transaction type' }; 
  }
  
  // Jalankan semua operasi sebagai satu transaksi
  await db.batch(batch);
  return { id: txId, ...data };
};

// --- [DIUBAH TOTAL] Logika untuk Book Summary ---
export const getBookSummary = async (db, bookId, filters = {}) => { // <-- [PERBAIKAN] Tambah parameter filters
    const assetsResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE book_id = ? AND type = 'ASSET' AND is_archived = 0").bind(bookId).first('total');
    const liabilitiesResult = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE book_id = ? AND type = 'LIABILITY' AND is_archived = 0").bind(bookId).first('total');
    
    // [PERBAIKAN] Gunakan tanggal dari filter, ATAU default ke bulan ini jika tidak ada
    let startDate, endDate;
    if (filters.startDate && filters.endDate) {
        startDate = filters.startDate;
        endDate = filters.endDate;
    } else {
        // Fallback jika frontend tidak mengirim tanggal (seharusnya tidak terjadi, tapi aman)
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    // [AKHIR PERBAIKAN]

    const incomeQuery = `SELECT ABS(SUM(s.amount)) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.book_id = ? AND c.type = 'INCOME' AND t.transaction_date BETWEEN ? AND ?`;
    const expenseQuery = `SELECT ABS(SUM(s.amount)) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.book_id = ? AND c.type = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?`;
    const monthlyIncomeResult = await db.prepare(incomeQuery).bind(bookId, startDate, endDate).first('total');
    const monthlyExpenseResult = await db.prepare(expenseQuery).bind(bookId, startDate, endDate).first('total');
    return { assets: assetsResult || 0, liabilities: liabilitiesResult || 0, net_worth: (assetsResult || 0) - (liabilitiesResult || 0), monthly_income: monthlyIncomeResult || 0, monthly_expense: monthlyExpenseResult || 0 };
};

// --- [BARU] Query untuk Laporan, Anggaran, Pengaturan, dll ---
export const getExpenseReportByCategory = async (db, bookId, filters = {}) => {
  let query = `SELECT c.name as category_name, c.id as category_id, SUM(s.amount) as total_amount FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.book_id = ? AND c.type = 'EXPENSE'`;
  const params = [bookId];
  if (filters.startDate && filters.endDate) { query += ' AND t.transaction_date BETWEEN ? AND ?'; params.push(filters.startDate, filters.endDate); }
  query += ' GROUP BY c.id, c.name ORDER BY total_amount DESC';
  return (await db.prepare(query).bind(...params).all()).results;
};

export const findBudgetsByBookId = async (db, bookId) => {
  const query = `
    SELECT b.id, b.name, b.amount, b.period, b.start_date,
      (SELECT GROUP_CONCAT(c.name) FROM budget_categories bc JOIN categories c ON bc.category_id = c.id WHERE bc.budget_id = b.id) as categories
    FROM budgets b WHERE b.book_id = ?`;
  return (await db.prepare(query).bind(bookId).all()).results;
};
export const createBudget = async (db, data) => {
  const newBudgetId = `b-${crypto.randomUUID()}`;
  const amountInCents = Math.round(data.amount * 100);
  const batch = [
    db.prepare('INSERT INTO budgets (id, book_id, name, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newBudgetId, data.book_id, data.name, amountInCents, data.period, data.start_date)
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

export const findRecurringTransactionsByBookId = async (db, bookId) => {
    return (await db.prepare('SELECT * FROM recurring_transactions WHERE book_id = ? AND is_active = 1').bind(bookId).all()).results;
};
export const createRecurringTransaction = async (db, data) => {
    const newId = `rt-${crypto.randomUUID()}`;
    const amountInCents = Math.round(data.amount * 100);
    await db.prepare(`INSERT INTO recurring_transactions (id, book_id, description, amount, type, frequency, start_date, next_due_date, category_id, from_account_id, to_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId, data.book_id, data.description, amountInCents, data.type, data.frequency, data.start_date, data.next_due_date, data.category_id, data.from_account_id, data.to_account_id).run();
    return { id: newId, ...data };
};
export const deleteRecurringTransaction = async (db, rtId) => {
    return await db.prepare('DELETE FROM recurring_transactions WHERE id = ?').bind(rtId).run();
};

export const findSettingsByBookId = async (db, bookId) => {
    let settings = await db.prepare('SELECT * FROM book_settings WHERE book_id = ?').bind(bookId).first();
    // Jika belum ada setting, kembalikan nilai default
    if (!settings) {
        return { 
            book_id: bookId, 
            start_of_month: 1, 
            theme: 'SYSTEM', 
            language: 'id-ID',
            // Nilai default untuk kolom baru
            button_position: 'bottom_right',
            calculator_layout: 'default',
            sound_effects_enabled: 1,
            haptic_feedback_enabled: 1
        };
    }
    return settings;
};
export const updateSettings = async (db, bookId, data) => {
    // Ambil pengaturan saat ini untuk mengisi nilai yang mungkin tidak dikirim dari frontend
    const currentSettings = await findSettingsByBookId(db, bookId);
    const newSettings = { ...currentSettings, ...data };

    await db.prepare(`
        INSERT INTO book_settings (book_id, start_of_month, theme, language, button_position, calculator_layout, sound_effects_enabled, haptic_feedback_enabled) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
        start_of_month = excluded.start_of_month,
        theme = excluded.theme,
        language = excluded.language,
        button_position = excluded.button_position,
        calculator_layout = excluded.calculator_layout,
        sound_effects_enabled = excluded.sound_effects_enabled,
        haptic_feedback_enabled = excluded.haptic_feedback_enabled
    `).bind(
        bookId, 
        newSettings.start_of_month, 
        newSettings.theme, 
        newSettings.language,
        newSettings.button_position,
        newSettings.calculator_layout,
        newSettings.sound_effects_enabled,
        newSettings.haptic_feedback_enabled
    ).run();
    
    return { book_id: bookId, ...newSettings };
};

export const findRemindersByBookId = async (db, bookId) => {
    return (await db.prepare('SELECT * FROM reminders WHERE book_id = ? AND is_active = 1 ORDER BY reminder_date ASC').bind(bookId).all()).results;
};
export const createReminder = async (db, data) => {
    const newId = `rem-${crypto.randomUUID()}`;
    const amountInCents = data.amount ? Math.round(data.amount * 100) : null;
    await db.prepare('INSERT INTO reminders (id, book_id, description, amount, reminder_date) VALUES (?, ?, ?, ?, ?)')
        .bind(newId, data.book_id, data.description, amountInCents, data.reminder_date).run();
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

// --- [BARU] CRUD untuk Tujuan Tabungan (Goals) ---
export const findGoalsByBookId = async (db, bookId) => {
    return (await db.prepare('SELECT * FROM goals WHERE book_id = ? ORDER BY created_at DESC').bind(bookId).all()).results;
};

export const createGoal = async (db, data) => {
    const newId = `goal-${crypto.randomUUID()}`;
    const targetAmountInCents = Math.round(data.target_amount * 100);

    await db.prepare('INSERT INTO goals (id, book_id, name, target_amount, target_date, icon) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId, data.book_id, data.name, targetAmountInCents, data.target_date, data.icon).run();
    
    return { id: newId, ...data };
};

export const updateGoal = async (db, goalId, data) => {
    // Fungsi ini bisa untuk mengubah nama, atau menambah/mengurangi 'current_amount'
    const currentAmountInCents = Math.round(data.current_amount * 100);
    const targetAmountInCents = Math.round(data.target_amount * 100);

    await db.prepare('UPDATE goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, icon = ?, is_achieved = ? WHERE id = ?')
        .bind(data.name, targetAmountInCents, currentAmountInCents, data.target_date, data.icon, data.is_achieved, goalId).run();
        
    return { id: goalId, ...data };
};

export const deleteGoal = async (db, goalId) => {
    return await db.prepare('DELETE FROM goals WHERE id = ?').bind(goalId).run();
};
// --- [BARU] Fungsi untuk Rekomendasi Cerdas ---
export const getCategoryRecommendations = async (db, bookId, description) => {
    if (!description || description.trim() === '') {
        return [];
    }
    // Cari kata kunci dari deskripsi
    const keywords = description.toLowerCase().split(' ').filter(word => word.length > 2);
    
    // Buat klausa WHERE dinamis untuk mencari transaksi lampau yang cocok
    const whereClauses = keywords.map(() => 'LOWER(t.description) LIKE ?').join(' OR ');

    const query = `
        SELECT 
            c.id, 
            c.name,
            c.type,
            COUNT(c.id) as frequency
        FROM transactions t
        JOIN transaction_splits s ON t.id = s.transaction_id
        JOIN categories c ON s.category_id = c.id
        WHERE 
            t.book_id = ? AND (${whereClauses})
        GROUP BY c.id
        ORDER BY frequency DESC
        LIMIT 5
    `;

    // Siapkan parameter, setiap kata kunci dibungkus dengan wildcard '%'
    const params = [bookId, ...keywords.map(kw => `%${kw}%`)];

    return (await db.prepare(query).bind(...params).all()).results;
};
// --- [BARU] CRUD untuk Catatan (Notes) ---
export const findNotesByBookId = async (db, bookId, filters = {}) => {
    let query = 'SELECT * FROM notes WHERE book_id = ?';
    const params = [bookId];
    if (filters.date) {
        query += ' AND note_date = ?';
        params.push(filters.date);
    }
    query += ' ORDER BY note_date DESC';
    return (await db.prepare(query).bind(...params).all()).results;
};
export const createNote = async (db, data, userId) => {
    const newId = `note-${crypto.randomUUID()}`;
    await db.prepare('INSERT INTO notes (id, book_id, title, content, note_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId, data.book_id, data.title, data.content, data.note_date, userId).run();
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
// [PERBAIKAN UNTUK FILE: casflo-api/src/db/queries.js]
// Ganti fungsi exportTransactionsAsCSV yang lama dengan ini:

export const exportTransactionsAsCSV = async (db, bookId) => {
    // [PERBAIKAN 1] Tambahkan "c.type as category_type" dan "s.category_id IS NOT NULL"
    const { results } = await db.prepare(`
        SELECT 
            t.transaction_date,
            t.description,
            c.name as category_name,
            c.type as category_type, 
            a.name as account_name,
            s.amount
        FROM transactions t
        JOIN transaction_splits s ON t.id = s.transaction_id
        JOIN accounts a ON s.account_id = a.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE t.book_id = ? AND s.category_id IS NOT NULL
        ORDER BY t.transaction_date DESC
    `).bind(bookId).all();

    if (!results || results.length === 0) {
        return "Tanggal,Deskripsi,Kategori,Tipe,Akun,Pemasukan,Pengeluaran\nTidak ada data untuk diekspor.";
    }

    let csvContent = "Tanggal,Deskripsi,Kategori,Tipe,Akun,Pemasukan,Pengeluaran\n";

    results.forEach(row => {
        const date = row.transaction_date;
        const description = `"${row.description || ''}"`;
        const category = `"${row.category_name}"`; // Tidak akan pernah "Transfer" lagi
        const type = `"${row.category_type}"`;
        const account = `"${row.account_name}"`;
        
        // [PERBAIKAN 2] Logika Pemasukan/Pengeluaran berdasarkan Tipe Kategori
        // Amount dari EXPENSE akan positif (DEBIT), Amount dari INCOME akan negatif (CREDIT)
        
        const amountInRupiah = Math.abs(row.amount); // Ambil nilai absolut

        const income = row.category_type === 'INCOME' ? amountInRupiah : 0;
        const expense = row.category_type === 'EXPENSE' ? amountInRupiah : 0;

        csvContent += `${date},${description},${category},${type},${account},${income},${expense}\n`;
    });

    return csvContent;
};