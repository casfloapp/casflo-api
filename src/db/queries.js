// src/db/queries.js
import bcrypt from 'bcryptjs';

// -- User Queries -- (Tidak ada perubahan)
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
    // Diubah untuk mencari berdasarkan email, bukan ID
    return await db.prepare('UPDATE users SET is_email_verified = 1 WHERE email = ?').bind(email).run();
};

// -- Verification Code Queries -- (Tidak ada perubahan)
export const saveVerificationCode = async (db, email, code) => {
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  return await db.prepare(
    'INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)'
  ).bind(email, code, expires_at.toISOString()).run();
};
export const findVerificationCode = async (db, email) => {
  return await db.prepare('SELECT * FROM verification_codes WHERE email = ?').bind(email).first();
};
export const deleteVerificationCode = async (db, email) => {
  return await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run();
};


// -- Wallet & Member Queries -- (Tidak ada perubahan)
export const findWalletsByUserId = async (db, userId) => {
  const stmt = db.prepare('SELECT w.*, wm.role FROM wallets w JOIN wallet_members wm ON w.id = wm.wallet_id WHERE wm.user_id = ?');
  return (await stmt.bind(userId).all()).results;
};
export const findWalletById = async (db, walletId) => {
  return await db.prepare('SELECT * FROM wallets WHERE id = ?').bind(walletId).first();
};
export const createWalletWithMember = async (db, walletData, userId) => {
  const newWalletId = `w-${crypto.randomUUID()}`;
  // [DIUBAH] Saat membuat wallet, buat juga akun default (Kas Tunai)
  const defaultAccountId = `acc-${crypto.randomUUID()}`;
  const batch = [
    db.prepare('INSERT INTO wallets (id, name, module_type, created_by) VALUES (?, ?, ?, ?)').bind(newWalletId, walletData.name, walletData.moduleType, userId),
    db.prepare('INSERT INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, ?)').bind(newWalletId, userId, 'OWNER'),
    db.prepare("INSERT INTO accounts (id, wallet_id, name, type, balance) VALUES (?, ?, 'Kas Tunai', 'ASSET', 0)").bind(defaultAccountId, newWalletId)
  ];
  await db.batch(batch);
  return { id: newWalletId, ...walletData };
};
export const deleteWallet = async (db, walletId) => {
  return await db.prepare('DELETE FROM wallets WHERE id = ?').bind(walletId).run();
};
export const findMember = async (db, walletId, userId) => {
  return await db.prepare('SELECT * FROM wallet_members WHERE wallet_id = ? AND user_id = ?').bind(walletId, userId).first();
};
// ... query member lainnya tetap sama ...


// -- [BARU] Accounts Queries --
export const findAccountsByWalletId = async (db, walletId) => {
  return (await db.prepare('SELECT * FROM accounts WHERE wallet_id = ? AND is_archived = 0 ORDER BY type, name ASC').bind(walletId).all()).results;
};
export const createAccount = async (db, data) => {
  const newId = `acc-${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO accounts (id, wallet_id, name, type, balance) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, data.wallet_id, data.name, data.type, data.balance * 100).run(); // Simpan sebagai sen
  return { id: newId, ...data };
};
export const updateAccount = async (db, accountId, data) => {
    await db.prepare('UPDATE accounts SET name = ?, type = ?, is_archived = ? WHERE id = ?')
        .bind(data.name, data.type, data.is_archived, accountId).run();
    return { id: accountId, ...data };
};
export const deleteAccount = async (db, accountId) => {
    // Sebaiknya periksa dulu apakah akun memiliki saldo atau transaksi terkait sebelum menghapus
    return await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
};


// -- [DIUBAH] Category, Contact Queries (Tetap sama, tidak ada perubahan) --
export const findCategoriesByWalletId = async (db, walletId) => {
  return (await db.prepare('SELECT * FROM categories WHERE wallet_id = ? ORDER BY name ASC').bind(walletId).all()).results;
};
// ... semua CRUD kategori & kontak lainnya tetap sama ...


// -- [DIUBAH TOTAL] Transaction Queries --
export const findTransactionsByWalletId = async (db, walletId) => {
  const query = `
    SELECT
      t.id,
      t.description,
      t.transaction_date,
      t.created_at,
      (SELECT ABS(SUM(s.amount)) FROM transaction_splits s WHERE s.transaction_id = t.id AND s.amount > 0) as amount, -- Ambil nilai absolut dari sisi Debet
      (SELECT GROUP_CONCAT(c.name) FROM transaction_splits s JOIN categories c ON s.category_id = c.id WHERE s.transaction_id = t.id) as category_name,
      co.name as contact_name
    FROM transactions t
    LEFT JOIN contacts co ON t.contact_id = co.id
    WHERE t.wallet_id = ?
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `;
  return (await db.prepare(query).bind(walletId).all()).results;
};

// INI FUNGSI PALING PENTING DAN KOMPLEKS
export const createTransaction = async (db, data, userId) => {
  // data = { wallet_id, description, transaction_date, amount, type ('EXPENSE'/'INCOME'/'TRANSFER'),
  //          category_id (untuk expense/income), from_account_id, to_account_id (untuk transfer) }

  const amountInCents = data.amount * 100;
  const newTxId = `tx-${crypto.randomUUID()}`;
  
  const batch = [];

  // 1. Buat entri utama di tabel transactions
  batch.push(
    db.prepare('INSERT INTO transactions (id, wallet_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newTxId, data.wallet_id, data.contact_id, data.description, data.transaction_date, userId)
  );

  // 2. Buat entri di transaction_splits & update saldo akun
  if (data.type === 'EXPENSE') {
    // DEBIT: Pengeluaran bertambah (dicatat sbg positif di kategori)
    // KREDIT: Aset/Kas berkurang (dicatat sbg negatif di akun)
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, category_id, amount, type) VALUES (?, ?, ?, ?, 'DEBIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.category_id, amountInCents));
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'CREDIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.from_account_id, -amountInCents));
    batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amountInCents, data.from_account_id));
  } else if (data.type === 'INCOME') {
    // DEBIT: Aset/Kas bertambah (dicatat sbg positif di akun)
    // KREDIT: Pendapatan bertambah (dicatat sbg negatif di kategori)
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, account_id, amount, type) VALUES (?, ?, ?, ?, 'DEBIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.to_account_id, amountInCents));
    batch.push(db.prepare("INSERT INTO transaction_splits (id, transaction_id, category_id, amount, type) VALUES (?, ?, ?, ?, 'CREDIT')").bind(`spl-${crypto.randomUUID()}`, newTxId, data.category_id, -amountInCents));
    batch.push(db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amountInCents, data.to_account_id));
  } else if (data.type === 'TRANSFER') {
    // DEBIT: Akun tujuan bertambah
    // KREDIT: Akun sumber berkurang
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
// Catatan: updateTransaction dan deleteTransaction akan sangat kompleks.
// Untuk saat ini kita sederhanakan dengan tidak mengimplementasikannya.
// Implementasi penuh memerlukan logika untuk membatalkan split lama dan membuat yang baru.

// -- [DIUBAH] Wallet Summary Query --
export const getWalletSummary = async (db, walletId) => {
    const assets = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'ASSET'").bind(walletId).first('total');
    const liabilities = await db.prepare("SELECT SUM(balance) as total FROM accounts WHERE wallet_id = ? AND type = 'LIABILITY'").bind(walletId).first('total');
    
    // Query untuk pendapatan & pengeluaran bulan ini
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const incomeQuery = `SELECT SUM(s.amount) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'INCOME' AND t.transaction_date BETWEEN ? AND ?`;
    const expenseQuery = `SELECT SUM(s.amount) as total FROM transaction_splits s JOIN categories c ON s.category_id = c.id JOIN transactions t ON s.transaction_id = t.id WHERE t.wallet_id = ? AND c.type = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?`;

    const monthlyIncome = await db.prepare(incomeQuery).bind(walletId, startDate, endDate).first('total');
    const monthlyExpense = await db.prepare(expenseQuery).bind(walletId, startDate, endDate).first('total');
    
    return {
        assets: assets || 0,
        liabilities: liabilities || 0,
        net_worth: (assets || 0) - (liabilities || 0),
        monthly_income: monthlyIncome || 0,
        monthly_expense: monthlyExpense || 0
    };
};