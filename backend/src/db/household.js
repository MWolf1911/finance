const crypto = require('crypto');

const HOUSEHOLD_NAME = 'Household';
const HOUSEHOLD_PIN = '0000';
const HOUSEHOLD_USER_KEY = 'household_user_id';
const LAST_ARCHIVE_RUN_KEY = 'last_archive_run';

function upsertMetadata(db, key, value) {
  db.prepare(`
    INSERT INTO system_metadata (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value);
}

function ensureHouseholdUser(db) {
  const savedHouseholdId = db.prepare(
    'SELECT value FROM system_metadata WHERE key = ?'
  ).get(HOUSEHOLD_USER_KEY)?.value;

  if (savedHouseholdId) {
    const savedHousehold = db.prepare(
      'SELECT id, name, created_at FROM users WHERE id = ?'
    ).get(savedHouseholdId);

    if (savedHousehold) {
      if (savedHousehold.name !== HOUSEHOLD_NAME) {
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(HOUSEHOLD_NAME, savedHousehold.id);
        return { ...savedHousehold, name: HOUSEHOLD_NAME };
      }
      return savedHousehold;
    }
  }

  const existingHousehold = db.prepare(
    'SELECT id, name, created_at FROM users WHERE name = ? ORDER BY created_at ASC LIMIT 1'
  ).get(HOUSEHOLD_NAME);

  if (existingHousehold) {
    upsertMetadata(db, HOUSEHOLD_USER_KEY, existingHousehold.id);
    return existingHousehold;
  }

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, name, pin) VALUES (?, ?, ?)').run(id, HOUSEHOLD_NAME, HOUSEHOLD_PIN);
  upsertMetadata(db, HOUSEHOLD_USER_KEY, id);

  return db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(id);
}

function migrateLegacyUsersToHousehold(db) {
  const household = ensureHouseholdUser(db);
  const legacyUsers = db.prepare('SELECT id FROM users WHERE id != ?').all(household.id);

  if (legacyUsers.length === 0) {
    return { household, migrated: false, removedUsers: 0 };
  }

  db.transaction(() => {
    db.prepare('UPDATE transactions SET user_id = ? WHERE user_id != ?').run(household.id, household.id);
    db.prepare('UPDATE debts SET user_id = ? WHERE user_id != ?').run(household.id, household.id);
    db.prepare('UPDATE recurring_templates SET user_id = ? WHERE user_id != ?').run(household.id, household.id);

    // Rebuild archives from transactions after the consolidation finishes.
    db.prepare('DELETE FROM monthly_archives').run();
    db.prepare('DELETE FROM system_metadata WHERE key = ?').run(LAST_ARCHIVE_RUN_KEY);

    db.prepare('DELETE FROM users WHERE id != ?').run(household.id);
    db.prepare('UPDATE users SET name = ?, pin = ? WHERE id = ?').run(HOUSEHOLD_NAME, HOUSEHOLD_PIN, household.id);
    upsertMetadata(db, HOUSEHOLD_USER_KEY, household.id);
  })();

  return {
    household: { ...household, name: HOUSEHOLD_NAME },
    migrated: true,
    removedUsers: legacyUsers.length,
  };
}

module.exports = {
  HOUSEHOLD_NAME,
  ensureHouseholdUser,
  migrateLegacyUsersToHousehold,
};