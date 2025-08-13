// src/db/queries.js
import bcrypt from 'bcryptjs';

// --- [DIPERTAHANKAN] User & Verification Code Queries ---
// Semua fungsi di bagian ini diambil dari file Anda dan tidak diubah.
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
    // Diubah untuk mencari berdasarkan email agar sesuai dengan endpoint Anda
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
  await db.prepare('INSERT INTO accounts (id, wallet_id, name, type, balance) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, data.wallet_id, data.name, data.type, data.balance * 100).run();
  return { id: newId, ...data };
};
export const updateAccount = async (db, accountId, data) => {
    await db.prepare('UPDATE accounts SET name = ?, type = ?, is_archived = ? WHERE id = ?')
        .bind(data.name, data.type, data.is_archived, accountId).run();
    return { id: accountId, ...data };
};
export const deleteAccount = async (db, accountId) => {
    // TODO: Tambahkan validasi (misal: tidak bisa hapus jika saldo tidak nol)
    return await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
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
export const findTransactionsByWalletId = async (db, walletId) => {
  const query = `
    SELECT
      t.id,
      t.description,
      t.transaction_date,
      (
        SELECT ABS(s.amount) FROM transaction_splits s
        JOIN categories c ON s.category_id = c.id
        WHERE s.transaction_id = t.id AND c.type = 'EXPENSE'
        LIMIT 1
      ) as expense_amount,
      (
        SELECT ABS(s.amount) FROM transaction_splits s
        JOIN categories c ON s.category_id = c.id
        WHERE s.transaction_id = t.id AND c.type = 'INCOME'
        LIMIT 1
      ) as income_amount,
      (SELECT GROUP_CONCAT(c.name) FROM transaction_splits s JOIN categories c ON s.category_id = c.id WHERE s.transaction_id = t.id) as category_name
    FROM transactions t
    WHERE t.wallet_id = ?
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `;
  return (await db.prepare(query).bind(walletId).all()).results;
};

export const createTransaction = async (db, data, userId) => {
  const amountInCents = data.amount * 100;
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

export const deleteTransaction = async (db, transactionId) => {
  const splits = await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ?').bind(transactionId).all();
  if (!splits.results || splits.results.length === 0) return { error: "Transaction not found or has no splits."};

  const batch = [];
  // Balikkan semua pergerakan dana di akun
  for (const split of splits.results) {
    if (split.account_id) { // Hanya update saldo jika split terkait dengan 'accounts'
        // Jika amount negatif (kredit), maka balancenya ditambah. Jika positif (debit), balancenya dikurang.
        batch.push(db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(split.amount, split.account_id));
    }
  }

  // Hapus semua splits dan transaksi utamanya
  batch.push(db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').bind(transactionId));
  batch.push(db.prepare('DELETE FROM transactions WHERE id = ?').bind(transactionId));

  await db.batch(batch);
  return { success: true };
};
// Catatan: updateTransaction tidak diimplementasikan karena sangat kompleks.
// Cara paling umum adalah menghapus transaksi lama (memanggil deleteTransaction) lalu membuat yang baru.


// --- [DIUBAH TOTAL] Logika untuk Wallet Summary ---
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