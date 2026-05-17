const SystemMetadataModel = require('./systemMetadata');
const ArchiveModel = require('./archive');

function metadataKey(year, month) {
  return `dashboard_starting_balance_${year}-${String(month).padStart(2, '0')}`;
}

function reconciliationKey(year, month) {
  return `dashboard_reconciliation_${year}-${String(month).padStart(2, '0')}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getStoredReconciliation(year, month) {
  const raw = SystemMetadataModel.get(reconciliationKey(year, month));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const actualEndingBalance = normalizeOptionalNumber(parsed.actualEndingBalance);
    if (actualEndingBalance === null) {
      return null;
    }

    return {
      actualEndingBalance,
      reconciliationNotes: parsed.reconciliationNotes || null,
      reconciledAt: parsed.reconciledAt || null,
    };
  } catch {
    return null;
  }
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
    if (previous) {
      const carryover = previous.reconciled_ending_balance !== null && previous.reconciled_ending_balance !== undefined
        ? previous.reconciled_ending_balance
        : previous.ending_balance;

      if (carryover !== null && carryover !== undefined) {
        return { startingBalance: normalizeNumber(carryover), source: 'carryover' };
      }
    }

    return { startingBalance: 0, source: 'default' };
  },

  getMonthBalance(year, month, net = 0) {
    const archive = ArchiveModel.getMonth(null, year, month);
    const { startingBalance, source } = this.getStartingBalance(year, month);
    const projectedEndingBalance = archive
      ? normalizeNumber(archive.ending_balance, startingBalance + net)
      : startingBalance + net;

    const reconciliation = archive
      ? {
          actualEndingBalance: normalizeOptionalNumber(archive.reconciled_ending_balance),
          reconciliationNotes: archive.reconciliation_notes || null,
          reconciledAt: archive.reconciled_at || null,
        }
      : getStoredReconciliation(year, month);

    const actualEndingBalance = reconciliation?.actualEndingBalance ?? null;
    const variance = actualEndingBalance === null
      ? null
      : actualEndingBalance - projectedEndingBalance;

    return {
      year,
      month,
      source,
      startingBalance,
      projectedEndingBalance,
      actualEndingBalance,
      variance,
      reconciliationNotes: reconciliation?.reconciliationNotes ?? null,
      reconciledAt: reconciliation?.reconciledAt ?? null,
      isReconciled: actualEndingBalance !== null,
      net,
    };
  },

  setStartingBalance(year, month, startingBalance) {
    const normalized = normalizeNumber(startingBalance);
    SystemMetadataModel.set(metadataKey(year, month), String(normalized));
    return normalized;
  },

  reconcileMonth(year, month, { actualEndingBalance, reconciliationNotes = null }) {
    const normalized = normalizeNumber(actualEndingBalance);
    const archive = ArchiveModel.getMonth(null, year, month);

    if (archive) {
      ArchiveModel.updateReconciliation(year, month, {
        reconciledEndingBalance: normalized,
        reconciliationNotes,
      });
      return normalized;
    }

    SystemMetadataModel.set(reconciliationKey(year, month), JSON.stringify({
      actualEndingBalance: normalized,
      reconciliationNotes: reconciliationNotes || null,
      reconciledAt: new Date().toISOString(),
    }));
    return normalized;
  },
};

module.exports = DashboardBalanceModel;
