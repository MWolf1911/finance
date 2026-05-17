const SystemMetadataModel = require('./systemMetadata');
const ArchiveModel = require('./archive');

function metadataKey(year, month) {
  return `dashboard_starting_balance_${year}-${String(month).padStart(2, '0')}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DashboardBalanceModel = {
  getStartingBalance(year, month) {
    const archive = ArchiveModel.getMonth(null, year, month);
    if (archive && archive.starting_balance !== null && archive.starting_balance !== undefined) {
      return { startingBalance: normalizeNumber(archive.starting_balance), source: 'archive' };
    }

    const saved = SystemMetadataModel.get(metadataKey(year, month));
    if (saved !== null) {
      return { startingBalance: normalizeNumber(saved), source: 'saved' };
    }

    const previous = ArchiveModel.getLatestBefore(year, month);
    if (previous && previous.ending_balance !== null && previous.ending_balance !== undefined) {
      return { startingBalance: normalizeNumber(previous.ending_balance), source: 'carryover' };
    }

    return { startingBalance: 0, source: 'default' };
  },

  setStartingBalance(year, month, startingBalance) {
    const normalized = normalizeNumber(startingBalance);
    SystemMetadataModel.set(metadataKey(year, month), String(normalized));
    return normalized;
  },
};

module.exports = DashboardBalanceModel;
