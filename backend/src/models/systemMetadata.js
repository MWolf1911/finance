const { getDb } = require('../db/init');

const SystemMetadataModel = {
  get(key) {
    const db = getDb();
    try {
      const row = db.prepare('SELECT value FROM system_metadata WHERE key = ?').get(key);
      return row ? row.value : null;
    } finally {
      db.close();
    }
  },

  set(key, value) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO system_metadata (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, value);
    } finally {
      db.close();
    }
  },

  getAll() {
    const db = getDb();
    try {
      return db.prepare('SELECT * FROM system_metadata').all();
    } finally {
      db.close();
    }
  }
};

module.exports = SystemMetadataModel;
