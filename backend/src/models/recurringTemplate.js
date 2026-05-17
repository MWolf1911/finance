const crypto = require('crypto');
const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const RecurringTemplateModel = {
  getByUser() {
    const db = getDb();
    try {
      return db.prepare(
        'SELECT * FROM recurring_templates WHERE active = 1 ORDER BY day_of_month'
      ).all();
    } finally {
      db.close();
    }
  },

  getById(id) {
    const db = getDb();
    try {
      return db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(id);
    } finally {
      db.close();
    }
  },

  getAllActive() {
    const db = getDb();
    try {
      return db.prepare(
        'SELECT * FROM recurring_templates WHERE active = 1 ORDER BY day_of_month'
      ).all();
    } finally {
      db.close();
    }
  },

  create({ type = 'Expense', recurrence = 'monthly', dayOfMonth, startDate, endDate, category, amount, description, debtId }) {
    const db = getDb();
    try {
      const household = ensureHouseholdUser(db);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO recurring_templates (id, user_id, type, recurrence, day_of_month, start_date, end_date, category, amount, description, debt_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, household.id, type, recurrence, dayOfMonth || null, startDate || null, endDate || null, category, amount, description || null, debtId || null);
      return { id, userId: household.id, type, recurrence, dayOfMonth, startDate, endDate, category, amount, description, debtId };
    } finally {
      db.close();
    }
  },

  update(id, { type, recurrence, dayOfMonth, startDate, endDate, category, amount, description, debtId }) {
    const db = getDb();
    try {
      const fields = [];
      const values = [];

      if (type !== undefined) {
        fields.push('type = ?');
        values.push(type);
      }

      if (recurrence !== undefined) {
        fields.push('recurrence = ?');
        values.push(recurrence);
      }

      if (Object.prototype.hasOwnProperty.call(arguments[1], 'dayOfMonth')) {
        fields.push('day_of_month = ?');
        values.push(dayOfMonth ?? null);
      }

      if (Object.prototype.hasOwnProperty.call(arguments[1], 'startDate')) {
        fields.push('start_date = ?');
        values.push(startDate ?? null);
      }

      if (Object.prototype.hasOwnProperty.call(arguments[1], 'endDate')) {
        fields.push('end_date = ?');
        values.push(endDate ?? null);
      }

      if (category !== undefined) {
        fields.push('category = ?');
        values.push(category);
      }

      if (amount !== undefined) {
        fields.push('amount = ?');
        values.push(amount);
      }

      if (Object.prototype.hasOwnProperty.call(arguments[1], 'description')) {
        fields.push('description = ?');
        values.push(description ?? null);
      }

      if (Object.prototype.hasOwnProperty.call(arguments[1], 'debtId')) {
        fields.push('debt_id = ?');
        values.push(debtId ?? null);
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(id);

      const result = db.prepare(`
        UPDATE recurring_templates
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  deactivate(id) {
    const db = getDb();
    try {
      const result = db.prepare('UPDATE recurring_templates SET active = 0 WHERE id = ?').run(id);
      return result.changes > 0;
    } finally {
      db.close();
    }
  },

  delete(id) {
    const db = getDb();
    try {
      const result = db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(id);
      return result.changes > 0;
    } finally {
      db.close();
    }
  }
};

module.exports = RecurringTemplateModel;
