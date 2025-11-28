-- Basic schema (simplified but functional)

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
  icon TEXT DEFAULT '📚'
);

CREATE TABLE IF NOT EXISTS book_members (
  book_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT,
  PRIMARY KEY (book_id, user_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT
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
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  revoked INTEGER DEFAULT 0
);
