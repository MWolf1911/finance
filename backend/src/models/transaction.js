const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const TransactionModel = {
  getByUser(_userId, { month, year, type, category } = {}) {
    const db = getDb();
    try {
      let sql = 'SELECT * FROM transactions WHERE 1=1';
      const params = [];

      if (month && year) {
        const monthStr = String(month).padStart(2, '0');
        sql += " AND date LIKE ?";
        params.push(`${year}-${monthStr}%`);
      }
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY date DESC';
      return db.prepare(sql).all(...params);
    } finally {
      db.close();
    }
  },

  getById(id) {
    const db = getDb();
    try {
      return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    } finally {
      db.close();
    }
  },

  create({ type, category, amount, date, description, isRecurring = false, debtId = null }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO transactions (id, user_id, type, category, amount, date, description, is_recurring, debt_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, type, category, amount, date, description || null, isRecurring ? 1 : 0, debtId || null);
      return { id, userId: household.id, type, category, amount, date, description, isRecurring, debtId };
    } finally {
      db.close();
    }
  },

  update(id, updates) {
    const db = getDb();
    try {
      const fields = [];
      const values = [];

      if (updates.type !== undefined) {
        fields.push('type = ?');
        values.push(updates.type);
      }

      if (updates.category !== undefined) {
        fields.push('category = ?');
        values.push(updates.category);
      }

      if (updates.amount !== undefined) {
        fields.push('amount = ?');
        values.push(updates.amount);
      }

      if (updates.date !== undefined) {
        fields.push('date = ?');
        values.push(updates.date);
      }

      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'debtId')) {
        fields.push('debt_id = ?');
        values.push(updates.debtId ?? null);
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(id);

      const result = db.prepare(`
        UPDATE transactions
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  delete(id) {
    const db = getDb();
    try {
      const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  getMonthlySummary(_userId, year, month) {
    const db = getDb();
    try {
      const monthStr = String(month).padStart(2, '0');
      const datePrefix = `${year}-${monthStr}%`;

      const income = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'Income' AND date LIKE ?
      `).get(datePrefix);

      const expenses = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'Expense' AND date LIKE ?
      `).get(datePrefix);

      const byCategory = db.prepare(`
        SELECT category, type, SUM(amount) as total
        FROM transactions
        WHERE date LIKE ?
        GROUP BY category, type
        ORDER BY total DESC
      `).all(datePrefix);

      return {
        income: income.total,
        expenses: expenses.total,
        net: income.total - expenses.total,
        byCategory
      };
    } finally {
      db.close();
    }
  }
};

module.exports = TransactionModel;
