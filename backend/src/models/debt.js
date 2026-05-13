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

  create({ name, startingBalance, currentBalance, interestRate = 0, minimumPayment = 0 }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO debts (id, user_id, name, starting_balance, current_balance, interest_rate, minimum_payment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, name, startingBalance, currentBalance ?? startingBalance, interestRate, minimumPayment);
      return { id, userId: household.id, name, startingBalance, currentBalance: currentBalance ?? startingBalance, interestRate, minimumPayment };
    } finally {
      db.close();
    }
  },

  update(id, { name, currentBalance, interestRate, minimumPayment }) {
    const db = getDb();
    try {
      const result = db.prepare(`
        UPDATE debts
        SET name = COALESCE(?, name),
            current_balance = COALESCE(?, current_balance),
            interest_rate = COALESCE(?, interest_rate),
            minimum_payment = COALESCE(?, minimum_payment)
        WHERE id = ?
      `).run(name, currentBalance, interestRate, minimumPayment, id);
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
