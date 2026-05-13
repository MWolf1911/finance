const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const ArchiveModel = {
  getByUser() {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      return db.prepare(`
        SELECT id, user_id, year, month, income, expenses, net, transaction_count, created_at
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

  create({ userId, year, month, income, expenses, net, transactionCount, transactionsJson }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO monthly_archives (id, user_id, year, month, income, expenses, net, transaction_count, transactions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, year, month, income, expenses, net, transactionCount, transactionsJson);
      return id;
    } finally {
      db.close();
    }
  },
};

module.exports = ArchiveModel;
