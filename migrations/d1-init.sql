-- Use this if you need to init a fresh DB. If you already have DB, run the migration script we prepared.
CREATE TABLE IF NOT EXISTS _cf_KV (
  key TEXT PRIMARY KEY,
  value BLOB
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  hashed_password TEXT,
  salt TEXT,
  is_email_verified INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  module_type TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  created_by TEXT NOT NULL,
  updated_at DATETIME,
  updated_by TEXT,
  icon TEXT DEFAULT '📚',
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  created_by TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_members (
  book_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT,
  PRIMARY KEY (book_id, user_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('ASSET', 'LIABILITY')),
  balance INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('MONTHLY', 'WEEKLY')),
  start_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_categories (
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (budget_id, category_id),
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  category_id TEXT,
  source_account_id TEXT,
  destination_account_id TEXT,
  contact_id TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (source_account_id) REFERENCES accounts(id),
  FOREIGN KEY (destination_account_id) REFERENCES accounts(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE IF NOT EXISTS book_settings (
  book_id TEXT PRIMARY KEY,
  start_of_month INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'SYSTEM',
  language TEXT DEFAULT 'id-ID',
  haptic_feedback_enabled INTEGER DEFAULT 1,
  calculator_layout TEXT DEFAULT 'default',
  sound_effects_enabled INTEGER DEFAULT 1,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  contact_id TEXT,
  description TEXT,
  transaction_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  created_by TEXT NOT NULL,
  updated_at DATETIME,
  updated_by TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER,
  reminder_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  note_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  created_by TEXT NOT NULL,
  updated_at DATETIME,
  updated_by TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL,
  current_amount INTEGER NOT NULL DEFAULT 0,
  target_date DATE,
  icon TEXT,
  is_achieved INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  revoked INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
