const { getDb } = require('../db/init');
const { ensureHouseholdUser } = require('../db/household');

const HouseholdModel = {
  getProfile() {
    const db = getDb();
    try {
      return ensureHouseholdUser(db);
    } finally {
      db.close();
    }
  },
};

module.exports = HouseholdModel;