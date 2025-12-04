-- Enterprise Database Schema for Casflo API v2
-- Optimized for Cloudflare D1 (SQLite) with performance and security in mind

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table with enhanced security and features
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    hashed_password TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    status TEXT DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED')),
    email_verified BOOLEAN DEFAULT 0,
    timezone TEXT DEFAULT 'Asia/Jakarta',
    language TEXT DEFAULT 'id',
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- User preferences for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    preferences TEXT NOT NULL, -- JSON string
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table for JWT token management
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    last_used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL,
    permissions TEXT DEFAULT '[]', -- JSON array of permissions
    is_active BOOLEAN DEFAULT 1,
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Books (Financial ledgers) with enhanced features
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    module_type TEXT DEFAULT 'FINANCE' CHECK (module_type IN ('FINANCE', 'BUSINESS')),
    icon TEXT DEFAULT '📚',
    currency TEXT DEFAULT 'IDR',
    timezone TEXT DEFAULT 'Asia/Jakarta',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED')),
    settings TEXT DEFAULT '{}', -- JSON string for book-specific settings
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Book members with role-based access control
CREATE TABLE IF NOT EXISTS book_members (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    label TEXT, -- Custom label for the member
    permissions TEXT DEFAULT '[]', -- JSON array of additional permissions
    invited_by TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    UNIQUE(book_id, user_id)
);

-- Categories with hierarchical support
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    icon TEXT DEFAULT '📁',
    color TEXT DEFAULT '#000000',
    parent_id TEXT,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Accounts with enhanced tracking
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY')),
    balance INTEGER DEFAULT 0, -- Store in cents for precision
    currency TEXT DEFAULT 'IDR',
    description TEXT,
    account_number TEXT,
    bank_name TEXT,
    is_archived BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Contacts with enhanced information
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    company TEXT,
    website TEXT,
    notes TEXT,
    tax_id TEXT,
    is_vendor BOOLEAN DEFAULT 0,
    is_customer BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Transactions with enhanced features
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    description TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    contact_id TEXT,
    tags TEXT DEFAULT '[]', -- JSON array of tags
    notes TEXT,
    attachments TEXT DEFAULT '[]', -- JSON array of attachment URLs
    status TEXT DEFAULT 'CONFIRMED' CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Transaction splits for double-entry bookkeeping
CREATE TABLE IF NOT EXISTS transaction_splits (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount INTEGER NOT NULL, -- Can be positive or negative
    type TEXT NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Recurring transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    category_id TEXT,
    account_id TEXT,
    to_account_id TEXT,
    contact_id TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    interval_value INTEGER DEFAULT 1, -- For custom intervals
    start_date TEXT NOT NULL,
    end_date TEXT,
    last_processed_date TEXT,
    next_due_date TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Budgets for financial planning
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    spent_amount INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Verification codes for email verification
CREATE TABLE IF NOT EXISTS verification_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
    email TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Webhooks for integrations
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array of events
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_triggered_at TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON string
    response_code INTEGER,
    response_body TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Audit logs for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values TEXT, -- JSON string
    new_values TEXT, -- JSON string
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- User activity logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT, -- JSON string
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Performance indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_books_created_by ON books(created_by);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_module_type ON books(module_type);

CREATE INDEX IF NOT EXISTS idx_book_members_book_id ON book_members(book_id);
CREATE INDEX IF NOT EXISTS idx_book_members_user_id ON book_members(user_id);
CREATE INDEX IF NOT EXISTS idx_book_members_role ON book_members(role);

CREATE INDEX IF NOT EXISTS idx_categories_book_id ON categories(book_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

CREATE INDEX IF NOT EXISTS idx_accounts_book_id ON accounts(book_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_is_archived ON accounts(is_archived);

CREATE INDEX IF NOT EXISTS idx_contacts_book_id ON contacts(book_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_vendor ON contacts(is_vendor);
CREATE INDEX IF NOT EXISTS idx_contacts_is_customer ON contacts(is_customer);

CREATE INDEX IF NOT EXISTS idx_transactions_book_id ON transactions(book_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_account_id ON transaction_splits(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_id ON transaction_splits(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_type ON transaction_splits(type);

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_book_id ON recurring_transactions(book_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_category_id ON recurring_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_is_active ON recurring_transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_due_date ON recurring_transactions(next_due_date);

CREATE INDEX IF NOT EXISTS idx_budgets_book_id ON budgets(book_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period_type ON budgets(period_type);
CREATE INDEX IF NOT EXISTS idx_budgets_is_active ON budgets(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_book_members_composite ON book_members(book_id, user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_composite ON transactions(book_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_composite ON transaction_splits(transaction_id, account_id);

-- Insert default system configuration
INSERT OR IGNORE INTO system_config (key, value, description, is_public) VALUES
('app_name', 'Casflo API', 'Application name', true),
('app_version', '2.0.0', 'Current application version', true),
('max_file_size', '10485760', 'Maximum file upload size in bytes', false),
('supported_languages', '["id", "en"]', 'Supported languages', true),
('default_timezone', 'Asia/Jakarta', 'Default timezone', true),
('maintenance_mode', 'false', 'Maintenance mode status', true),
('registration_enabled', 'true', 'Allow new user registrations', true),
('email_verification_required', 'true', 'Require email verification', true),
('max_books_per_user', '10', 'Maximum books per user', false),
('max_members_per_book', '50', 'Maximum members per book', false);

-- Insert default categories for new books (will be copied when books are created)
-- These are templates and will be inserted per book during book creation