// src/routes/books.js

import { Hono } from 'hono';
import { protect } from '../middleware/auth.js';
import * as q from '../db/queries.js'; // Mengimpor semua query dengan alias 'q'
import { sendBookInvitationEmail } from '../lib/email.js';

const bookRoutes = new Hono();
bookRoutes.use('*', protect); // Lindungi semua rute

// [DIPERTAHANKAN] Middleware untuk memeriksa kepemilikan/keanggotaan book
const checkBookMembership = async (c, next) => {
    const user = c.get('user');
    const { bookId } = c.req.param();
    const member = await q.findMember(c.env.DB, bookId, user.id);
    if (!member) {
        return c.json({ success: false, error: { message: 'Forbidden: You are not a member of this book.' } }, 403);
    }
    c.set('member', member); // Simpan info keanggotaan (termasuk role)
    await next();
};

// --- [DIPERTAHANKAN] RUTE UTAMA BOOK ---
bookRoutes.get('/', async (c) => {
    const user = c.get('user');
    const books = await q.findBooksByUserId(c.env.DB, user.id);
    return c.json({ success: true, data: books });
});
bookRoutes.post('/', async (c) => {
    const user = c.get('user');
    
    // [PERBAIKAN] Panggil c.req.json() HANYA SEKALI
    const body = await c.req.json(); 
    
    // [PERBAIKAN] Gunakan 'body' untuk validasi
    if (!body.name || !body.moduleType) { 
        return c.json({ success: false, error: { message: 'Name and moduleType are required' } }, 400); 
    }
    
    // [PERBAIKAN] Kirim 'body' (yang sekarang berisi 'icon') dan 'user.id'
    // Fungsi createBookWithMember Anda mengharapkan (db, bookData, userId)
    const newBook = await q.createBookWithMember(c.env.DB, body, user.id); 
    
    return c.json({ success: true, data: newBook }, 201);
});



// Grup rute yang memerlukan keanggotaan book
const bookSpecificRoutes = new Hono();
bookSpecificRoutes.use('*', checkBookMembership);

// --- [DIPERTAHANKAN] Detail, Update, Delete Book ---
bookSpecificRoutes.get('/', async (c) => {
    const { bookId } = c.req.param();
    const book = await q.findBookById(c.env.DB, bookId);
    return c.json({ success: true, data: book });
});
bookSpecificRoutes.put('/', async (c) => {
    const user = c.get('user');
    const { bookId } = c.req.param();
    const body = await c.req.json();
    body.updated_by = user.id;
    const updatedBook = await q.updateBook(c.env.DB, bookId, body);
    return c.json({ success: true, data: updatedBook });
});
bookSpecificRoutes.delete('/', async (c) => {
    const member = c.get('member');
    if (member.role !== 'OWNER') { return c.json({ success: false, error: { message: 'Forbidden: Only the owner can delete a book.' } }, 403); }
    const { bookId } = c.req.param();
    await q.deleteBook(c.env.DB, bookId);
    return c.json({ success: true, message: 'Book deleted successfully' });
});

// --- [DIUBAH TOTAL] Rute Laporan Summary ---
bookSpecificRoutes.get('/summary', async (c) => {
    const { bookId } = c.req.param();
    
    // [PERBAIKAN] Ambil tanggal dari query parameters
    const { startDate, endDate } = c.req.query(); 

    // [PERBAIKAN] Kirim tanggal ke fungsi query
    const summaryData = await q.getBookSummary(c.env.DB, bookId, { startDate, endDate }); 
    
    const summaryInRupiah = {
        assets: (summaryData.assets || 0),
        liabilities: (summaryData.liabilities || 0),
        net_worth: (summaryData.net_worth || 0),
        monthly_income: (summaryData.monthly_income || 0),
        monthly_expense: (summaryData.monthly_expense || 0),
    };
    return c.json({ success: true, data: summaryInRupiah });
});

// --- [BARU] CRUD Akun (Aset & Liabilitas) ---
bookSpecificRoutes.get('/accounts', async (c) => {
    const { bookId } = c.req.param();
    const accounts = await q.findAccountsByBookId(c.env.DB, bookId);
    // [PERBAIKAN] Hapus konversi sen
    return c.json({ success: true, data: accounts });
});
bookSpecificRoutes.post('/accounts', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newAccount = await q.createAccount(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newAccount }, 201);
});
bookSpecificRoutes.put('/accounts/:accountId', async (c) => {
    const { accountId } = c.req.param();
    const body = await c.req.json();
    const updatedAccount = await q.updateAccount(c.env.DB, accountId, body);
    return c.json({ success: true, data: updatedAccount });
});
bookSpecificRoutes.delete('/accounts/:accountId', async (c) => {
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
    const { bookId } = c.req.param();
    const { startDate, endDate } = c.req.query();
    const reportData = await q.getExpenseReportByCategory(c.env.DB, bookId, { startDate, endDate });
    // [PERBAIKAN] Hapus konversi sen
    return c.json({ success: true, data: reportData });
});
reportRoutes.get('/recommendations/category', async (c) => {
    const { bookId } = c.req.param();
    const { description } = c.req.query();
    
    const recommendations = await q.getCategoryRecommendations(c.env.DB, bookId, description);
    
    return c.json({ success: true, data: recommendations });
});
bookSpecificRoutes.route('/reports', reportRoutes);

// --- [BARU] CRUD Anggaran (Budgeting) ---
bookSpecificRoutes.get('/budgets', async (c) => {
    const { bookId } = c.req.param();
    const budgets = await q.findBudgetsByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: budgetsInRupiah });
});
bookSpecificRoutes.post('/budgets', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newBudget = await q.createBudget(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newBudget }, 201);
});
bookSpecificRoutes.delete('/budgets/:budgetId', async (c) => {
    const { budgetId } = c.req.param();
    await q.deleteBudget(c.env.DB, budgetId);
    return c.json({ success: true, message: 'Budget deleted successfully' });
});

// --- [BARU] CRUD Transaksi Berulang ---
bookSpecificRoutes.get('/recurring-transactions', async (c) => {
    const { bookId } = c.req.param();
    const rts = await q.findRecurringTransactionsByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: rtsInRupiah });
});
bookSpecificRoutes.post('/recurring-transactions', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newRt = await q.createRecurringTransaction(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newRt }, 201);
});
bookSpecificRoutes.delete('/recurring-transactions/:rtId', async (c) => {
    const { rtId } = c.req.param();
    await q.deleteRecurringTransaction(c.env.DB, rtId);
    return c.json({ success: true, message: 'Recurring transaction deleted successfully' });
});

// --- [BARU] Rute Pengaturan Book ---
bookSpecificRoutes.get('/settings', async (c) => {
    const { bookId } = c.req.param();
    const settings = await q.findSettingsByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: settings });
});
bookSpecificRoutes.put('/settings', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const updatedSettings = await q.updateSettings(c.env.DB, bookId, body);
    return c.json({ success: true, data: updatedSettings });
});

// --- [BARU] CRUD Pengingat (Alarm) ---
bookSpecificRoutes.get('/reminders', async (c) => {
    const { bookId } = c.req.param();
    const reminders = await q.findRemindersByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: remindersInRupiah });
});
bookSpecificRoutes.post('/reminders', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newReminder = await q.createReminder(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newReminder }, 201);
});
bookSpecificRoutes.put('/reminders/:reminderId', async (c) => {
    const { reminderId } = c.req.param();
    const body = await c.req.json();
    const updatedReminder = await q.updateReminder(c.env.DB, reminderId, body);
    return c.json({ success: true, data: updatedReminder });
});
bookSpecificRoutes.delete('/reminders/:reminderId', async (c) => {
    const { reminderId } = c.req.param();
    await q.deleteReminder(c.env.DB, reminderId);
    return c.json({ success: true, message: 'Reminder deleted successfully' });
});
// --- [BARU] CRUD Tujuan Tabungan (Goals) ---
bookSpecificRoutes.get('/goals', async (c) => {
    const { bookId } = c.req.param();
    const goals = await q.findGoalsByBookId(c.env.DB, bookId);
    // [PERBAIKAN] Hapus konversi sen
    return c.json({ success: true, data: goals });
});

bookSpecificRoutes.post('/goals', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newGoal = await q.createGoal(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newGoal }, 201);
});

bookSpecificRoutes.put('/goals/:goalId', async (c) => {
    const { goalId } = c.req.param();
    const body = await c.req.json();
    const updatedGoal = await q.updateGoal(c.env.DB, goalId, body);
    return c.json({ success: true, data: updatedGoal });
});

bookSpecificRoutes.delete('/goals/:goalId', async (c) => {
    const { goalId } = c.req.param();
    await q.deleteGoal(c.env.DB, goalId);
    return c.json({ success: true, message: 'Goal deleted successfully' });
});
// --- [BARU] CRUD Catatan (Notes) ---
bookSpecificRoutes.get('/notes', async (c) => {
    const { bookId } = c.req.param();
    const { date } = c.req.query(); // Filter berdasarkan tanggal
    const notes = await q.findNotesByBookId(c.env.DB, bookId, { date });
    return c.json({ success: true, data: notes });
});
bookSpecificRoutes.post('/notes', async (c) => {
    const user = c.get('user');
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newNote = await q.createNote(c.env.DB, { book_id: bookId, ...body }, user.id);
    return c.json({ success: true, data: newNote }, 201);
});
bookSpecificRoutes.put('/notes/:noteId', async (c) => {
    const user = c.get('user');
    const { noteId } = c.req.param();
    const body = await c.req.json();
    const updatedNote = await q.updateNote(c.env.DB, noteId, body, user.id);
    return c.json({ success: true, data: updatedNote });
});
bookSpecificRoutes.delete('/notes/:noteId', async (c) => {
    const { noteId } = c.req.param();
    await q.deleteNote(c.env.DB, noteId);
    return c.json({ success: true, message: 'Note deleted successfully' });
});

// --- [BARU] Endpoint untuk Ekspor Data ---
bookSpecificRoutes.get('/export/csv', async (c) => {
    const { bookId } = c.req.param();
    const book = await q.findBookById(c.env.DB, bookId);
    
    const csvData = await q.exportTransactionsAsCSV(c.env.DB, bookId);
    
    // Atur header agar browser mengunduh file
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="casflo-export-${book.name.replace(/\s+/g, '-')}.csv"`);
    
    return c.body(csvData);
});

// --- [DIPERTAHANKAN] CRUD Kategori ---
bookSpecificRoutes.get('/categories', async (c) => {
    const { bookId } = c.req.param();
    const categories = await q.findCategoriesByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: categories });
});
bookSpecificRoutes.post('/categories', async (c) => {
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newCategory = await q.createCategory(c.env.DB, { book_id: bookId, ...body });
    return c.json({ success: true, data: newCategory }, 201);
});
bookSpecificRoutes.put('/categories/:categoryId', async (c) => {
    const { categoryId } = c.req.param();
    const body = await c.req.json();
    const updatedCategory = await q.updateCategory(c.env.DB, categoryId, body);
    return c.json({ success: true, data: updatedCategory });
});
bookSpecificRoutes.delete('/categories/:categoryId', async (c) => {
    const { categoryId } = c.req.param();
    await q.deleteCategory(c.env.DB, categoryId);
    return c.json({ success: true, message: 'Category deleted successfully' });
});

// --- [DIPERTAHANKAN] CRUD Kontak ---
bookSpecificRoutes.get('/contacts', async (c) => {
    const { bookId } = c.req.param();
    const contacts = await q.findContactsByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: contacts });
});
bookSpecificRoutes.post('/contacts', async (c) => {
    const user = c.get('user');
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const newContact = await q.createContact(c.env.DB, { book_id: bookId, ...body }, user.id);
    return c.json({ success: true, data: newContact }, 201);
});
bookSpecificRoutes.put('/contacts/:contactId', async (c) => {
    const { contactId } = c.req.param();
    const body = await c.req.json();
    const updatedContact = await q.updateContact(c.env.DB, contactId, body);
    return c.json({ success: true, data: updatedContact });
});
bookSpecificRoutes.delete('/contacts/:contactId', async (c) => {
    const { contactId } = c.req.param();
    await q.deleteContact(c.env.DB, contactId);
    return c.json({ success: true, message: 'Contact deleted successfully' });
});

// --- [DIUBAH] CRUD Transaksi dengan Filter ---
bookSpecificRoutes.get('/transactions', async (c) => {
    const { bookId } = c.req.param();
    const { startDate, endDate } = c.req.query(); // Ambil filter dari URL

    // Panggil query yang sudah Anda buat di queries.js
    const transactions = await q.findTransactionsByBookId(
        c.env.DB, 
        bookId, 
        { startDate, endDate } // Kirim filter
    );
    
    return c.json({ success: true, data: transactions });
});
bookSpecificRoutes.post('/transactions', async (c) => {
    const user = c.get('user');
    const { bookId } = c.req.param();
    const body = await c.req.json();
    const result = await q.createTransaction(c.env.DB, { book_id: bookId, ...body }, user.id);
    if (result.error) { return c.json({ success: false, error: { message: result.error }}, 400); }
    return c.json({ success: true, data: result }, 201);
});
bookSpecificRoutes.put('/transactions/:txId', async (c) => {
    const user = c.get('user');
    const { bookId, txId } = c.req.param();
    const body = await c.req.json();
    
    // Panggil query update yang baru kita buat
    const result = await q.updateTransaction(c.env.DB, txId, { book_id: bookId, ...body }, user.id);
    
    if (result.error) { 
        return c.json({ success: false, error: { message: result.error }}, 400); 
    }
    return c.json({ success: true, data: result });
});
bookSpecificRoutes.delete('/transactions/:transactionId', async (c) => {
    const { transactionId } = c.req.param();
    const result = await q.deleteTransaction(c.env.DB, transactionId);
    if (result.error) { return c.json({ success: false, error: { message: result.error }}, 404); }
    return c.json({ success: true, message: 'Transaction deleted successfully' });
});

// --- [DIPERTAHANKAN] CRUD Anggota ---
bookSpecificRoutes.get('/members', async (c) => {
    const { bookId } = c.req.param();
    const members = await q.findMembersByBookId(c.env.DB, bookId);
    return c.json({ success: true, data: members });
});
bookSpecificRoutes.post('/members', async (c) => {
    const memberRole = c.get('member').role;
    // [PERBAIKAN] Peran 'ADMIN' juga harus bisa mengundang
    if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') { 
        return c.json({ success: false, error: { message: 'Forbidden: Hanya Owner atau Admin yang dapat menambah anggota.' } }, 403); 
    }

    const { bookId } = c.req.param();
    const { email, role, label } = await c.req.json();

    const userToInvite = await q.findUserByEmail(c.env.DB, email);
    if (!userToInvite) { 
        return c.json({ success: false, error: { message: 'User dengan email tersebut tidak ditemukan.' } }, 404); 
    }

    // [BARU] Ambil data user pengundang (Anda)
    const inviterId = c.get('user').id;
    if (userToInvite.id === inviterId) {
        return c.json({ success: false, error: { message: 'Anda tidak bisa mengundang diri sendiri.' } }, 400);
    }

    const inviter = await q.findUserById(c.env.DB, inviterId);
    if (!inviter) {
        return c.json({ success: false, error: { message: 'Gagal menemukan data pengundang.' } }, 500);
    }

    // [BARU] Ambil nama dompet
    const book = await q.findBookById(c.env.DB, bookId);
    if (!book) {
        return c.json({ success: false, error: { message: 'Gagal menemukan data dompet.' } }, 404);
    }

    try {
        await q.addBookMember(c.env.DB, bookId, userToInvite.id, role, label);

        // [BARU] Kirim email notifikasi (tanpa menunggu selesai)
        c.executionCtx.waitUntil(
            sendBookInvitationEmail(c, {
                to: userToInvite.email,
                inviterName: inviter.full_name,
                bookName: book.name
            })
        );

        return c.json({ success: true, message: 'Anggota berhasil ditambahkan' }, 201);

    } catch (e) {
        // Menangani jika user sudah menjadi anggota
        if (e.message.includes('UNIQUE constraint failed')) {
            return c.json({ success: false, error: { message: 'User ini sudah menjadi anggota dompet.' } }, 409);
        }
        return c.json({ success: false, error: { message: 'Gagal menambahkan anggota.', details: e.message } }, 500);
    }
});
bookSpecificRoutes.delete('/members/:userId', async (c) => {
    if (c.get('member').role !== 'OWNER') { return c.json({ success: false, error: { message: 'Forbidden: Only the owner can remove members.' } }, 403); }
    const { bookId, userId } = c.req.param();
    if (c.get('user').id === userId) { return c.json({ success: false, error: { message: 'Owner cannot remove themselves.' } }, 400); }
    await q.removeBookMember(c.env.DB, bookId, userId);
    return c.json({ success: true, message: 'Member removed successfully' });
});

// Menerapkan grup rute spesifik book ke path utama
bookRoutes.route('/:bookId', bookSpecificRoutes);



// [PERBAIKAN UNTUK FILE: casflo-api/src/routes/books.js]
// Ganti endpoint '/:id/transactions/batch' yang lama dengan ini:

bookRoutes.post('/:bookId/transactions/batch', protect, async (c) => {
    try {
        const book_id = c.req.param('bookId'); // [PERBAIKAN] Ganti nama param
        const userId = c.get('user').id;
        const { transactions } = await c.req.json();

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
             return c.json({ error: 'Array "transactions" diperlukan' }, 400);
        }
        
        const statements = [];
        
        for (const item of transactions) {
            // Validasi data item
            if (!item.amount || !item.category_id || !item.from_account_id || !item.description || !item.transaction_date || item.type !== 'EXPENSE') {
                console.warn("Melewatkan item batch yang tidak lengkap atau tipe salah:", item);
                continue; 
            }
            
            const newTxId = `tx-${crypto.randomUUID()}`;
            const amount = Math.round(Math.abs(item.amount)); 
            
            // 1. INSERT Transaksi (wrapper)
            statements.push(
                c.env.DB.prepare('INSERT INTO transactions (id, book_id, contact_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
                    .bind(
                        newTxId, 
                        book_id, 
                        null, // contact_id
                        item.description, 
                        item.transaction_date, 
                        userId
                    )
            );
            
            // 2. INSERT Split DEBIT (Kategori)
            statements.push(
                c.env.DB.prepare('INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type) VALUES (?, ?, ?, ?, ?, ?)')
                    .bind(
                        `spl-${crypto.randomUUID()}`,
                        newTxId,
                        item.from_account_id,
                        item.category_id,
                        amount, // Positif
                        'DEBIT'
                    )
            );

            // 3. INSERT Split CREDIT (Akun)
             statements.push(
                c.env.DB.prepare('INSERT INTO transaction_splits (id, transaction_id, account_id, category_id, amount, type) VALUES (?, ?, ?, ?, ?, ?)')
                    .bind(
                        `spl-${crypto.randomUUID()}`,
                        newTxId,
                        item.from_account_id,
                        null, // Kategori null
                        -amount, // Negatif
                        'CREDIT'
                    )
            );
            
            // 4. UPDATE Saldo Akun
            statements.push(
                c.env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?")
                    .bind(amount, item.from_account_id)
            );
        }
        
        if (statements.length === 0) {
             return c.json({ error: 'Tidak ada transaksi valid untuk disimpan' }, 400);
        }

        await c.env.DB.batch(statements);
        return c.json({ success: true, data: { count: statements.length / 4 } });

    } catch (error) {
        console.error("Error in batch transaction insert:", error);
        return c.json({ error: error.message }, 500);
    }
});

export default bookRoutes;
