-- ============================================
-- Household Finance Tracker - Database Schema
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL CHECK(length(pin) = 4 AND pin GLOB '[0-9][0-9][0-9][0-9]'),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Income', 'Expense')),
    category TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    date TEXT NOT NULL,
    description TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    debt_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recurring_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Expense' CHECK(type IN ('Income', 'Expense')),
    recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK(recurrence IN ('weekly', 'biweekly', 'monthly')),
    day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31),
    debt_id TEXT,
    start_date TEXT,
    end_date TEXT,
    category TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_last4 TEXT CHECK(length(account_last4) = 4 AND account_last4 GLOB '[0-9][0-9][0-9][0-9]'),
    starting_balance REAL NOT NULL CHECK(starting_balance >= 0),
    current_balance REAL NOT NULL CHECK(current_balance >= 0),
    interest_rate REAL NOT NULL DEFAULT 0 CHECK(interest_rate >= 0),
    minimum_payment REAL NOT NULL DEFAULT 0 CHECK(minimum_payment >= 0),
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monthly_archives (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    starting_balance REAL NOT NULL DEFAULT 0,
    ending_balance REAL NOT NULL DEFAULT 0,
    income REAL NOT NULL DEFAULT 0,
    expenses REAL NOT NULL DEFAULT 0,
    net REAL NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    transactions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, year, month)
);

CREATE TABLE IF NOT EXISTS system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_monthly_archives_user_year ON monthly_archives(user_id, year);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id);
