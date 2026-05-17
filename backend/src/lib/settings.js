const SystemMetadataModel = require('../models/systemMetadata');

const SETTINGS_KEY = 'app_settings';

const DEFAULT_SETTINGS = {
  transactionDefaults: {
    defaultType: 'Expense',
    defaultDateBehavior: 'today',
    requireDescription: false,
    confirmBeforeDelete: true,
  },
  debt: {
    autoArchivePaidOff: true,
  },
  archivePrint: {
    mode: 'detailed',
    includeDescriptions: true,
  },
};

function normalizeSettings(input = {}) {
  const tx = input.transactionDefaults || {};
  const debt = input.debt || {};
  const archivePrint = input.archivePrint || {};

  return {
    transactionDefaults: {
      defaultType: tx.defaultType === 'Income' ? 'Income' : 'Expense',
      defaultDateBehavior: tx.defaultDateBehavior === 'lastUsed' ? 'lastUsed' : 'today',
      requireDescription: Boolean(tx.requireDescription),
      confirmBeforeDelete: tx.confirmBeforeDelete !== undefined ? Boolean(tx.confirmBeforeDelete) : true,
    },
    debt: {
      autoArchivePaidOff: debt.autoArchivePaidOff !== undefined ? Boolean(debt.autoArchivePaidOff) : true,
    },
    archivePrint: {
      mode: archivePrint.mode === 'compact' ? 'compact' : 'detailed',
      includeDescriptions: archivePrint.includeDescriptions !== undefined
        ? Boolean(archivePrint.includeDescriptions)
        : true,
    },
  };
}

function mergeWithDefaults(input = {}) {
  return normalizeSettings({
    transactionDefaults: {
      ...DEFAULT_SETTINGS.transactionDefaults,
      ...(input.transactionDefaults || {}),
    },
    debt: {
      ...DEFAULT_SETTINGS.debt,
      ...(input.debt || {}),
    },
    archivePrint: {
      ...DEFAULT_SETTINGS.archivePrint,
      ...(input.archivePrint || {}),
    },
  });
}

function getSettings() {
  const raw = SystemMetadataModel.get(SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

function setSettings(settings) {
  const current = getSettings();
  const normalized = mergeWithDefaults({
    ...current,
    ...(settings || {}),
    transactionDefaults: {
      ...current.transactionDefaults,
      ...((settings && settings.transactionDefaults) || {}),
    },
    debt: {
      ...current.debt,
      ...((settings && settings.debt) || {}),
    },
    archivePrint: {
      ...current.archivePrint,
      ...((settings && settings.archivePrint) || {}),
    },
  });
  SystemMetadataModel.set(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
};
