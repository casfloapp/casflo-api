// src/routes/wallets.js

import { Hono } from 'hono';
import { protect } from '../middleware/auth.js';
import * as q from '../db/queries.js'; // Mengimpor semua query dengan alias 'q'

const walletRoutes = new Hono();
walletRoutes.use('*', protect); // Lindungi semua rute

// [DIPERTAHANKAN] Middleware untuk memeriksa kepemilikan/keanggotaan wallet
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

// --- [DIPERTAHANKAN] RUTE UTAMA WALLET ---
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

// --- [DIPERTAHANKAN] Detail, Update, Delete Wallet ---
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

// --- [DIUBAH TOTAL] Rute Laporan Summary ---
walletSpecificRoutes.get('/summary', async (c) => {
    const { walletId } = c.req.param();
    const summaryData = await q.getWalletSummary(c.env.DB, walletId);
    const summaryInRupiah = {
        assets: (summaryData.assets || 0) / 100,
        liabilities: (summaryData.liabilities || 0) / 100,
        net_worth: (summaryData.net_worth || 0) / 100,
        monthly_income: (summaryData.monthly_income || 0) / 100,
        monthly_expense: (summaryData.monthly_expense || 0) / 100,
    };
    return c.json({ success: true, data: summaryInRupiah });
});

// --- [BARU] CRUD Akun (Aset & Liabilitas) ---
walletSpecificRoutes.get('/accounts', async (c) => {
    const { walletId } = c.req.param();
    const accounts = await q.findAccountsByWalletId(c.env.DB, walletId);
    const accountsInRupiah = accounts.map(acc => ({...acc, balance: acc.balance / 100}));
    return c.json({ success: true, data: accountsInRupiah });
});
walletSpecificRoutes.post('/accounts', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newAccount = await q.createAccount(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newAccount }, 201);
});
walletSpecificRoutes.put('/accounts/:accountId', async (c) => {
    const { accountId } = c.req.param();
    const body = await c.req.json();
    const updatedAccount = await q.updateAccount(c.env.DB, accountId, body);
    return c.json({ success: true, data: updatedAccount });
});
walletSpecificRoutes.delete('/accounts/:accountId', async (c) => {
    const { accountId } = c.req.param();
    const result = await q.deleteAccount(c.env.DB, accountId);
    if (result.error) {
        return c.json({ success: false, error: { message: result.error }}, 400);
    }
    return c.json({ success: true, message: 'Account deleted successfully' });
});

// --- [BARU] Grup Rute untuk Laporan / Reports ---
const reportRoutes = new Hono();
reportRoutes.get('/expense-by-category', async (c) => {
    const { walletId } = c.req.param();
    const { startDate, endDate } = c.req.query();
    const reportData = await q.getExpenseReportByCategory(c.env.DB, walletId, { startDate, endDate });
    const reportInRupiah = reportData.map(item => ({ ...item, total_amount: item.total_amount / 100 }));
    return c.json({ success: true, data: reportInRupiah });
});
reportRoutes.get('/recommendations/category', async (c) => {
    const { walletId } = c.req.param();
    const { description } = c.req.query();
    
    const recommendations = await q.getCategoryRecommendations(c.env.DB, walletId, description);
    
    return c.json({ success: true, data: recommendations });
});
walletSpecificRoutes.route('/reports', reportRoutes);

// --- [BARU] CRUD Anggaran (Budgeting) ---
walletSpecificRoutes.get('/budgets', async (c) => {
    const { walletId } = c.req.param();
    const budgets = await q.findBudgetsByWalletId(c.env.DB, walletId);
    const budgetsInRupiah = budgets.map(b => ({ ...b, amount: b.amount / 100 }));
    return c.json({ success: true, data: budgetsInRupiah });
});
walletSpecificRoutes.post('/budgets', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newBudget = await q.createBudget(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newBudget }, 201);
});
walletSpecificRoutes.delete('/budgets/:budgetId', async (c) => {
    const { budgetId } = c.req.param();
    await q.deleteBudget(c.env.DB, budgetId);
    return c.json({ success: true, message: 'Budget deleted successfully' });
});

// --- [BARU] CRUD Transaksi Berulang ---
walletSpecificRoutes.get('/recurring-transactions', async (c) => {
    const { walletId } = c.req.param();
    const rts = await q.findRecurringTransactionsByWalletId(c.env.DB, walletId);
    const rtsInRupiah = rts.map(rt => ({ ...rt, amount: rt.amount / 100 }));
    return c.json({ success: true, data: rtsInRupiah });
});
walletSpecificRoutes.post('/recurring-transactions', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newRt = await q.createRecurringTransaction(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newRt }, 201);
});
walletSpecificRoutes.delete('/recurring-transactions/:rtId', async (c) => {
    const { rtId } = c.req.param();
    await q.deleteRecurringTransaction(c.env.DB, rtId);
    return c.json({ success: true, message: 'Recurring transaction deleted successfully' });
});

// --- [BARU] Rute Pengaturan Wallet ---
walletSpecificRoutes.get('/settings', async (c) => {
    const { walletId } = c.req.param();
    const settings = await q.findSettingsByWalletId(c.env.DB, walletId);
    return c.json({ success: true, data: settings });
});
walletSpecificRoutes.put('/settings', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const updatedSettings = await q.updateSettings(c.env.DB, walletId, body);
    return c.json({ success: true, data: updatedSettings });
});

// --- [BARU] CRUD Pengingat (Alarm) ---
walletSpecificRoutes.get('/reminders', async (c) => {
    const { walletId } = c.req.param();
    const reminders = await q.findRemindersByWalletId(c.env.DB, walletId);
    const remindersInRupiah = reminders.map(r => ({ ...r, amount: r.amount ? r.amount / 100 : null }));
    return c.json({ success: true, data: remindersInRupiah });
});
walletSpecificRoutes.post('/reminders', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newReminder = await q.createReminder(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newReminder }, 201);
});
walletSpecificRoutes.put('/reminders/:reminderId', async (c) => {
    const { reminderId } = c.req.param();
    const body = await c.req.json();
    const updatedReminder = await q.updateReminder(c.env.DB, reminderId, body);
    return c.json({ success: true, data: updatedReminder });
});
walletSpecificRoutes.delete('/reminders/:reminderId', async (c) => {
    const { reminderId } = c.req.param();
    await q.deleteReminder(c.env.DB, reminderId);
    return c.json({ success: true, message: 'Reminder deleted successfully' });
});
// --- [BARU] CRUD Tujuan Tabungan (Goals) ---
walletSpecificRoutes.get('/goals', async (c) => {
    const { walletId } = c.req.param();
    const goals = await q.findGoalsByWalletId(c.env.DB, walletId);
    const goalsInRupiah = goals.map(g => ({ 
        ...g, 
        target_amount: g.target_amount / 100,
        current_amount: g.current_amount / 100
    }));
    return c.json({ success: true, data: goalsInRupiah });
});

walletSpecificRoutes.post('/goals', async (c) => {
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newGoal = await q.createGoal(c.env.DB, { wallet_id: walletId, ...body });
    return c.json({ success: true, data: newGoal }, 201);
});

walletSpecificRoutes.put('/goals/:goalId', async (c) => {
    const { goalId } = c.req.param();
    const body = await c.req.json();
    const updatedGoal = await q.updateGoal(c.env.DB, goalId, body);
    return c.json({ success: true, data: updatedGoal });
});

walletSpecificRoutes.delete('/goals/:goalId', async (c) => {
    const { goalId } = c.req.param();
    await q.deleteGoal(c.env.DB, goalId);
    return c.json({ success: true, message: 'Goal deleted successfully' });
});
// --- [BARU] CRUD Catatan (Notes) ---
walletSpecificRoutes.get('/notes', async (c) => {
    const { walletId } = c.req.param();
    const { date } = c.req.query(); // Filter berdasarkan tanggal
    const notes = await q.findNotesByWalletId(c.env.DB, walletId, { date });
    return c.json({ success: true, data: notes });
});
walletSpecificRoutes.post('/notes', async (c) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const newNote = await q.createNote(c.env.DB, { wallet_id: walletId, ...body }, user.id);
    return c.json({ success: true, data: newNote }, 201);
});
walletSpecificRoutes.put('/notes/:noteId', async (c) => {
    const user = c.get('user');
    const { noteId } = c.req.param();
    const body = await c.req.json();
    const updatedNote = await q.updateNote(c.env.DB, noteId, body, user.id);
    return c.json({ success: true, data: updatedNote });
});
walletSpecificRoutes.delete('/notes/:noteId', async (c) => {
    const { noteId } = c.req.param();
    await q.deleteNote(c.env.DB, noteId);
    return c.json({ success: true, message: 'Note deleted successfully' });
});

// --- [BARU] Endpoint untuk Ekspor Data ---
walletSpecificRoutes.get('/export/csv', async (c) => {
    const { walletId } = c.req.param();
    const wallet = await q.findWalletById(c.env.DB, walletId);
    
    const csvData = await q.exportTransactionsAsCSV(c.env.DB, walletId);
    
    // Atur header agar browser mengunduh file
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="casflo-export-${wallet.name.replace(/\s+/g, '-')}.csv"`);
    
    return c.body(csvData);
});

// --- [DIPERTAHANKAN] CRUD Kategori ---
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

// --- [DIPERTAHANKAN] CRUD Kontak ---
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

// --- [DIUBAH] CRUD Transaksi dengan Filter ---
walletSpecificRoutes.get('/transactions', async (c) => {
    const { walletId } = c.req.param();
    const { startDate, endDate, accountId, categoryId } = c.req.query();
    const transactions = await q.findTransactionsByWalletId(c.env.DB, walletId, { startDate, endDate, accountId, categoryId });
    const transactionsInRupiah = transactions.map(tx => ({...tx, amount: (tx.amount || 0) / 100 }));
    return c.json({ success: true, data: transactionsInRupiah });
});
walletSpecificRoutes.post('/transactions', async (c) => {
    const user = c.get('user');
    const { walletId } = c.req.param();
    const body = await c.req.json();
    const result = await q.createTransaction(c.env.DB, { wallet_id: walletId, ...body }, user.id);
    if (result.error) { return c.json({ success: false, error: { message: result.error }}, 400); }
    return c.json({ success: true, data: result }, 201);
});
walletSpecificRoutes.delete('/transactions/:transactionId', async (c) => {
    const { transactionId } = c.req.param();
    const result = await q.deleteTransaction(c.env.DB, transactionId);
    if (result.error) { return c.json({ success: false, error: { message: result.error }}, 404); }
    return c.json({ success: true, message: 'Transaction deleted successfully' });
});

// --- [DIPERTAHANKAN] CRUD Anggota ---
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
    if (c.get('user').id === userId) { return c.json({ success: false, error: { message: 'Owner cannot remove themselves.' } }, 400); }
    await q.removeWalletMember(c.env.DB, walletId, userId);
    return c.json({ success: true, message: 'Member removed successfully' });
});

// Menerapkan grup rute spesifik wallet ke path utama
walletRoutes.route('/:walletId', walletSpecificRoutes);

export default walletRoutes;
