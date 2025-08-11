// src/routes/wallets.js

import { Hono } from 'hono';
import { protect } from '../middleware/auth.js';
import * as q from '../db/queries.js'; // Mengimpor semua query dengan alias 'q'

const walletRoutes = new Hono();
walletRoutes.use('*', protect); // Lindungi semua rute

// Middleware untuk memeriksa kepemilikan/keanggotaan wallet
const checkWalletMembership = async (c, next) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const member = await q.findMember(c.env.DB, walletId, user.id);
    if (!member) {
        return c.json({ success: false, error: { message: 'Forbidden: You are not a member of this wallet.' } }, 403);
    }
    c.set('member', member); // Simpan info keanggotaan (termasuk role)
    await next();
};

// --- RUTE UTAMA WALLET ---
walletRoutes.get('/', async (c) => {
    const user = c.get('user');
    const wallets = await q.findWalletsByUserId(c.env.DB, user.id);
    return c.json({ success: true, data: wallets });
});
walletRoutes.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    if (!body.name || !body.moduleType) { return c.json({ success: false, error: { message: 'Name and moduleType are required' } }, 400); }
    const newWallet = await q.createWalletWithMember(c.env.DB, body, user.id);
    return c.json({ success: true, data: newWallet }, 201);
});

// Grup rute yang memerlukan keanggotaan wallet
const walletSpecificRoutes = new Hono();
walletSpecificRoutes.use('*', checkWalletMembership);

// Detail, Update, Delete Wallet
walletSpecificRoutes.get('/', async (c) => {
    const { walletId } = c.req.param();
    const wallet = await q.findWalletById(c.env.DB, walletId);
    return c.json({ success: true, data: wallet });
});
walletSpecificRoutes.put('/', async (c) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const body = await c.req.json();
    body.updated_by = user.id;
    const updatedWallet = await q.updateWallet(c.env.DB, walletId, body);
    return c.json({ success: true, data: updatedWallet });
});
walletSpecificRoutes.delete('/', async (c) => {
    const member = c.get('member');
    if (member.role !== 'OWNER') { return c.json({ success: false, error: { message: 'Forbidden: Only the owner can delete a wallet.' } }, 403); }
    const { walletId } = c.req.param();
    await q.deleteWallet(c.env.DB, walletId);
    return c.json({ success: true, message: 'Wallet deleted successfully' });
});

// Rute Laporan Summary
walletSpecificRoutes.get('/summary', async (c) => {
    const { walletId } = c.req.param();
    const summaryData = await q.getWalletSummary(c.env.DB, walletId);
    const summary = {
        income: summaryData.find(s => s.type === 'INCOME')?.total || 0,
        expense: summaryData.find(s => s.type === 'EXPENSE')?.total || 0,
    };
    summary.balance = summary.income - summary.expense;
    return c.json({ success: true, data: summary });
});


// CRUD Kategori
walletSpecificRoutes.get('/categories', async (c) => {
    const { walletId } = c.req.param();
    const categories = await q.findCategoriesByWalletId(c.env.DB, walletId);
    return c.json({ success: true, data: categories });
});
walletSpecificRoutes.post('/categories', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newCategory = await q.createCategory(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newCategory }, 201);
});
walletSpecificRoutes.put('/categories/:categoryId', async (c) => {
    const { categoryId } = c.req.param();
    const body = await c.req.json();
    const updatedCategory = await q.updateCategory(c.env.DB, categoryId, body);
    return c.json({ success: true, data: updatedCategory });
});
walletSpecificRoutes.delete('/categories/:categoryId', async (c) => {
    const { categoryId } = c.req.param();
    await q.deleteCategory(c.env.DB, categoryId);
    return c.json({ success: true, message: 'Category deleted successfully' });
});

// CRUD Kontak
walletSpecificRoutes.get('/contacts', async (c) => {
    const { walletId } = c.req.param();
    const contacts = await q.findContactsByWalletId(c.env.DB, walletId);
    return c.json({ success: true, data: contacts });
});
walletSpecificRoutes.post('/contacts', async (c) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newContact = await q.createContact(c.env.DB, { wallet_id: walletId, ...body }, user.id);
    return c.json({ success: true, data: newContact }, 201);
});
walletSpecificRoutes.put('/contacts/:contactId', async (c) => {
    const { contactId } = c.req.param();
    const body = await c.req.json();
    const updatedContact = await q.updateContact(c.env.DB, contactId, body);
    return c.json({ success: true, data: updatedContact });
});
walletSpecificRoutes.delete('/contacts/:contactId', async (c) => {
    const { contactId } = c.req.param();
    await q.deleteContact(c.env.DB, contactId);
    return c.json({ success: true, message: 'Contact deleted successfully' });
});

// CRUD Transaksi
walletSpecificRoutes.get('/transactions', async (c) => {
    const { walletId } = c.req.param();
    const transactions = await q.findTransactionsByWalletId(c.env.DB, walletId);
    return c.json({ success: true, data: transactions });
});
walletSpecificRoutes.post('/transactions', async (c) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newTransaction = await q.createTransaction(c.env.DB, { wallet_id: walletId, ...body }, user.id);
    return c.json({ success: true, data: newTransaction }, 201);
});
walletSpecificRoutes.put('/transactions/:transactionId', async (c) => {
    const user = c.get('user');
    const { transactionId } = c.req.param();
    const body = await c.req.json();
    const updatedTransaction = await q.updateTransaction(c.env.DB, transactionId, body, user.id);
    return c.json({ success: true, data: updatedTransaction });
});
walletSpecificRoutes.delete('/transactions/:transactionId', async (c) => {
    const { transactionId } = c.req.param();
    await q.deleteTransaction(c.env.DB, transactionId);
    return c.json({ success: true, message: 'Transaction deleted successfully' });
});

// CRUD Anggota
walletSpecificRoutes.get('/members', async (c) => {
    const { walletId } = c.req.param();
    const members = await q.findMembersByWalletId(c.env.DB, walletId);
    return c.json({ success: true, data: members });
});
walletSpecificRoutes.post('/members', async (c) => {
    if (c.get('member').role !== 'OWNER') { return c.json({ success: false, error: { message: 'Forbidden: Only the owner can add members.' } }, 403); }
    const { walletId } = c.req.param();
    const { email, role } = await c.req.json();
    const userToInvite = await q.findUserByEmail(c.env.DB, email);
    if (!userToInvite) { return c.json({ success: false, error: { message: 'User with that email not found.' } }, 404); }
    await q.addWalletMember(c.env.DB, walletId, userToInvite.id, role);
    return c.json({ success: true, message: 'Member added successfully' }, 201);
});
walletSpecificRoutes.delete('/members/:userId', async (c) => {
    if (c.get('member').role !== 'OWNER') { return c.json({ success: false, error: { message: 'Forbidden: Only the owner can remove members.' } }, 403); }
    const { walletId, userId } = c.req.param();
    await q.removeWalletMember(c.env.DB, walletId, userId);
    return c.json({ success: true, message: 'Member removed successfully' });
});


// Menerapkan grup rute spesifik wallet ke path utama
walletRoutes.route('/:walletId', walletSpecificRoutes);

export default walletRoutes;