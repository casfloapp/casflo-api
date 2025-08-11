// src/db/queries.js
import bcrypt from 'bcryptjs';

// -- User Queries --
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
// FUNGSI BARU: Membuat user dengan email & password
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
// FUNGSI BARU: Set user sebagai terverifikasi
export const verifyUserEmail = async (db, userId) => {
    return await db.prepare('UPDATE users SET is_email_verified = 1 WHERE id = ?').bind(userId).run();
};


// ... (Semua query lain untuk wallet, kategori, dll biarkan sama) ...
export const findWalletsByUserId = async (db, userId) => {
  const stmt = db.prepare('SELECT w.*, wm.role FROM wallets w JOIN wallet_members wm ON w.id = wm.wallet_id WHERE wm.user_id = ?');
  return (await stmt.bind(userId).all()).results;
};
export const findWalletById = async (db, walletId) => {
  return await db.prepare('SELECT * FROM wallets WHERE id = ?').bind(walletId).first();
};
export const createWalletWithMember = async (db, walletData, userId) => {
  const newWalletId = `w-${crypto.randomUUID()}`;
  const batch = [
    db.prepare('INSERT INTO wallets (id, name, module_type, created_by) VALUES (?, ?, ?, ?)').bind(newWalletId, walletData.name, walletData.moduleType, userId),
    db.prepare('INSERT INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, ?)').bind(newWalletId, userId, 'OWNER')
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
export const findTransactionsByWalletId = async (db, walletId) => {
  const stmt = db.prepare('SELECT t.*, c.name as category_name, co.name as contact_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN contacts co ON t.contact_id = co.id WHERE t.wallet_id = ? ORDER BY t.transaction_date DESC, t.created_at DESC');
  return (await stmt.bind(walletId).all()).results;
};
export const createTransaction = async (db, data, userId) => {
  const newId = `tx-${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO transactions (id, wallet_id, category_id, contact_id, amount, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, data.wallet_id, data.category_id, data.contact_id, data.amount, data.description, data.transaction_date, userId).run();
  return { id: newId, ...data, created_by: userId };
};
export const updateTransaction = async (db, transactionId, data, userId) => {
  await db.prepare('UPDATE transactions SET category_id = ?, amount = ?, description = ?, transaction_date = ?, contact_id = ?, updated_at = datetime("now","localtime"), updated_by = ? WHERE id = ?').bind(data.category_id, data.amount, data.description, data.transaction_date, data.contact_id, userId, transactionId).run();
  return { id: transactionId, ...data };
};
export const deleteTransaction = async (db, transactionId) => {
  return await db.prepare('DELETE FROM transactions WHERE id = ?').bind(transactionId).run();
};
export const getWalletSummary = async (db, walletId) => {
    const stmt = db.prepare('SELECT type, SUM(amount) as total FROM transactions WHERE wallet_id = ? GROUP BY type');
    return (await stmt.bind(walletId).all()).results;
};

// -- Verification Code Queries --
export const saveVerificationCode = async (db, email, code) => {
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // Kedaluwarsa dalam 10 menit
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