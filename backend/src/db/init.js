const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { migrateLegacyUsersToHousehold } = require('./household');

const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'finance.db');
const DB_PATH = process.env.FINANCE_DB_PATH || DEFAULT_DB_PATH;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function getDb() {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  // Enforce foreign keys
  db.pragma('foreign_keys = ON');

  return db;
}

function initializeDatabase() {
  const db = getDb();

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  // Migrate: relax day_of_month NOT NULL constraint so weekly/biweekly can have null
  const colInfo = db.prepare("PRAGMA table_info(recurring_templates)").all();
  const dayCol = colInfo.find(c => c.name === 'day_of_month');
  if (dayCol && dayCol.notnull === 1) {
    console.log('Migrating recurring_templates: relaxing day_of_month NOT NULL...');
    db.exec(`
      CREATE TABLE recurring_templates_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Expense' CHECK(type IN ('Income', 'Expense')),
        recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK(recurrence IN ('weekly', 'biweekly', 'monthly')),
        day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31),
        start_date TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO recurring_templates_new
        SELECT id, user_id, type,
               COALESCE(recurrence, 'monthly'),
               day_of_month, start_date,
               category, amount, description, active, created_at
        FROM recurring_templates;
      DROP TABLE recurring_templates;
      ALTER TABLE recurring_templates_new RENAME TO recurring_templates;
      CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_templates(user_id);
    `);
    console.log('Migration complete: recurring_templates rebuilt.');
  }

  // Migrate: add end_date column to recurring_templates if missing
  const colInfoEnd = db.prepare("PRAGMA table_info(recurring_templates)").all();
  const endDateCol = colInfoEnd.find(c => c.name === 'end_date');
  if (!endDateCol) {
    console.log('Migrating recurring_templates: adding end_date column...');
    db.exec(`ALTER TABLE recurring_templates ADD COLUMN end_date TEXT`);
    console.log('Migration complete: end_date column added.');
  }

  // Migrate: add debt_id column to transactions if missing
  const txColInfo = db.prepare("PRAGMA table_info(transactions)").all();
  if (!txColInfo.find(c => c.name === 'debt_id')) {
    console.log('Migrating transactions: adding debt_id column...');
    db.exec(`ALTER TABLE transactions ADD COLUMN debt_id TEXT REFERENCES debts(id) ON DELETE SET NULL`);
    console.log('Migration complete: transactions.debt_id added.');
  }

  // Migrate: add debt_id column to recurring_templates if missing
  const rtColInfo2 = db.prepare("PRAGMA table_info(recurring_templates)").all();
  if (!rtColInfo2.find(c => c.name === 'debt_id')) {
    console.log('Migrating recurring_templates: adding debt_id column...');
    db.exec(`ALTER TABLE recurring_templates ADD COLUMN debt_id TEXT`);
    console.log('Migration complete: recurring_templates.debt_id added.');
  }

  const debtColInfo = db.prepare("PRAGMA table_info(debts)").all();
  if (!debtColInfo.find(c => c.name === 'account_last4')) {
    console.log('Migrating debts: adding account_last4 column...');
    db.exec(`ALTER TABLE debts ADD COLUMN account_last4 TEXT`);
    console.log('Migration complete: debts.account_last4 added.');
  }

  const householdMigration = migrateLegacyUsersToHousehold(db);
  if (householdMigration.migrated) {
    console.log(`Consolidated ${householdMigration.removedUsers} legacy user profile(s) into one shared household ledger.`);
  }

  console.log('Database initialized at:', DB_PATH);
  db.close();
}

// Run directly
if (require.main === module) {
  initializeDatabase();
  console.log('Database setup complete.');
}

module.exports = { getDb, initializeDatabase, DB_PATH };
