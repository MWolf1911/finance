const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const ArchiveModel = {
  getByUser() {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      return db.prepare(`
        SELECT id, user_id, year, month, starting_balance, ending_balance, reconciled_ending_balance, reconciliation_notes, reconciled_at, income, expenses, net, transaction_count, created_at
        FROM monthly_archives
        WHERE user_id = ?
        ORDER BY year DESC, month DESC
      `).all(household.id);
    } finally {
      db.close();
    }
  },

  getMonth(_userId, year, month) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      return db.prepare(`
        SELECT * FROM monthly_archives
        WHERE user_id = ? AND year = ? AND month = ?
      `).get(household.id, year, month);
    } finally {
      db.close();
    }
  },

  exists(_userId, year, month) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const row = db.prepare(`
        SELECT 1 FROM monthly_archives
        WHERE user_id = ? AND year = ? AND month = ?
      `).get(household.id, year, month);
      return !!row;
    } finally {
      db.close();
    }
  },

  updateReconciliation(year, month, { reconciledEndingBalance, reconciliationNotes = null }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const result = db.prepare(`
        UPDATE monthly_archives
        SET reconciled_ending_balance = ?,
            reconciliation_notes = ?,
            reconciled_at = datetime('now')
        WHERE user_id = ? AND year = ? AND month = ?
      `).run(reconciledEndingBalance, reconciliationNotes || null, household.id, year, month);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  getLatestBefore(year, month) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      return db.prepare(`
        SELECT * FROM monthly_archives
        WHERE user_id = ?
          AND (year < ? OR (year = ? AND month < ?))
        ORDER BY year DESC, month DESC
        LIMIT 1
      `).get(household.id, year, year, month);
    } finally {
      db.close();
    }
  },

  create({
    userId,
    year,
    month,
    startingBalance = 0,
    endingBalance = 0,
    reconciledEndingBalance = null,
    reconciliationNotes = null,
    reconciledAt = null,
    income,
    expenses,
    net,
    transactionCount,
    transactionsJson,
  }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO monthly_archives (id, user_id, year, month, starting_balance, ending_balance, reconciled_ending_balance, reconciliation_notes, reconciled_at, income, expenses, net, transaction_count, transactions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, year, month, startingBalance, endingBalance, reconciledEndingBalance, reconciliationNotes, reconciledAt, income, expenses, net, transactionCount, transactionsJson);
      return id;
    } finally {
      db.close();
    }
  },
};

module.exports = ArchiveModel;
