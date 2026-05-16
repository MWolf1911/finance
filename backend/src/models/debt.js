const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const DebtModel = {
  getByUser({ includeArchived = false } = {}) {
    const db = getDb();
    try {
      const sql = includeArchived
        ? 'SELECT * FROM debts ORDER BY archived_at IS NOT NULL, current_balance DESC'
        : 'SELECT * FROM debts WHERE archived_at IS NULL ORDER BY current_balance DESC';
      return db.prepare(sql).all();
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

  update(id, updates) {
    const db = getDb();
    try {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'accountLast4')) {
        fields.push('account_last4 = ?');
        values.push(updates.accountLast4 ?? null);
      }

      if (updates.currentBalance !== undefined) {
        fields.push('current_balance = ?');
        values.push(updates.currentBalance);
        if (updates.currentBalance > 0) {
          // If a debt balance increases again, make it active automatically.
          fields.push('archived_at = NULL');
        }
      }

      if (updates.interestRate !== undefined) {
        fields.push('interest_rate = ?');
        values.push(updates.interestRate);
      }

      if (updates.minimumPayment !== undefined) {
        fields.push('minimum_payment = ?');
        values.push(updates.minimumPayment);
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(id);
      const result = db.prepare(`
        UPDATE debts
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  archive(id) {
    const db = getDb();
    try {
      const debt = db.prepare('SELECT current_balance, archived_at FROM debts WHERE id = ?').get(id);
      if (!debt) {
        return { ok: false, reason: 'not_found' };
      }
      if (debt.archived_at) {
        return { ok: true, alreadyArchived: true };
      }
      if (debt.current_balance > 0) {
        return { ok: false, reason: 'balance_remaining' };
      }

      db.prepare('UPDATE debts SET archived_at = datetime(\'now\') WHERE id = ?').run(id);
      return { ok: true };
    } finally {
      db.close();
    }
  },

  unarchive(id) {
    const db = getDb();
    try {
      const result = db.prepare('UPDATE debts SET archived_at = NULL WHERE id = ?').run(id);
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
        'SELECT COALESCE(SUM(current_balance), 0) as total FROM debts WHERE archived_at IS NULL'
      ).get();
      return result.total;
    } finally {
      db.close();
    }
  }
};

module.exports = DebtModel;
