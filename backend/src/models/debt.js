const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const DebtModel = {
  getByUser() {
    const db = getDb();
    try {
      return db.prepare('SELECT * FROM debts ORDER BY current_balance DESC').all();
    } finally {
      db.close();
    }
  },

  getById(id) {
    const db = getDb();
    try {
      return db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    } finally {
      db.close();
    }
  },

  create({ name, accountLast4 = null, startingBalance, currentBalance, interestRate = 0, minimumPayment = 0 }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO debts (id, user_id, name, account_last4, starting_balance, current_balance, interest_rate, minimum_payment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, name, accountLast4 || null, startingBalance, currentBalance ?? startingBalance, interestRate, minimumPayment);
      return { id, userId: household.id, name, accountLast4: accountLast4 || null, startingBalance, currentBalance: currentBalance ?? startingBalance, interestRate, minimumPayment };
    } finally {
      db.close();
    }
  },

  update(id, { name, accountLast4, currentBalance, interestRate, minimumPayment }) {
    const db = getDb();
    try {
      const result = db.prepare(`
        UPDATE debts
        SET name = COALESCE(?, name),
            account_last4 = COALESCE(?, account_last4),
            current_balance = COALESCE(?, current_balance),
            interest_rate = COALESCE(?, interest_rate),
            minimum_payment = COALESCE(?, minimum_payment)
        WHERE id = ?
      `).run(name, accountLast4, currentBalance, interestRate, minimumPayment, id);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  delete(id) {
    const db = getDb();
    try {
      const result = db.prepare('DELETE FROM debts WHERE id = ?').run(id);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  getTotalDebt() {
    const db = getDb();
    try {
      const result = db.prepare(
        'SELECT COALESCE(SUM(current_balance), 0) as total FROM debts'
      ).get();
      return result.total;
    } finally {
      db.close();
    }
  }
};

module.exports = DebtModel;
