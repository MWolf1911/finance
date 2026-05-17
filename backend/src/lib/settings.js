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
  liveRefresh: {
    intervalSeconds: 10,
  },
  budgetTargets: {
    Expense: {},
    Income: {},
  },
};

const ALLOWED_REFRESH_INTERVALS = new Set([0, 5, 10, 30, 60]);

function normalizeBudgetTargets(input = {}) {
  const normalized = {
    Expense: {},
    Income: {},
  };

  for (const type of ['Expense', 'Income']) {
    const rawGroup = input[type];
    if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
      continue;
    }

    for (const [rawCategory, rawValue] of Object.entries(rawGroup)) {
      const category = String(rawCategory || '').trim();
      const parsed = parseFloat(rawValue);
      if (!category || !Number.isFinite(parsed) || parsed <= 0) {
        continue;
      }

      normalized[type][category] = Number(parsed.toFixed(2));
    }
  }

  return normalized;
}

function normalizeRefreshIntervalSeconds(value) {
  const parsed = parseInt(value, 10);
  if (ALLOWED_REFRESH_INTERVALS.has(parsed)) {
    return parsed;
  }
  return DEFAULT_SETTINGS.liveRefresh.intervalSeconds;
}

function normalizeSettings(input = {}) {
  const tx = input.transactionDefaults || {};
  const debt = input.debt || {};
  const archivePrint = input.archivePrint || {};
  const liveRefresh = input.liveRefresh || {};
  const budgetTargets = input.budgetTargets || {};

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
    liveRefresh: {
      intervalSeconds: normalizeRefreshIntervalSeconds(liveRefresh.intervalSeconds),
    },
    budgetTargets: normalizeBudgetTargets(budgetTargets),
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
    liveRefresh: {
      ...DEFAULT_SETTINGS.liveRefresh,
      ...(input.liveRefresh || {}),
    },
    budgetTargets: {
      Expense: {
        ...DEFAULT_SETTINGS.budgetTargets.Expense,
        ...((input.budgetTargets && input.budgetTargets.Expense) || {}),
      },
      Income: {
        ...DEFAULT_SETTINGS.budgetTargets.Income,
        ...((input.budgetTargets && input.budgetTargets.Income) || {}),
      },
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
  const nextBudgetTargets = settings && settings.budgetTargets
    ? {
        Expense: Object.prototype.hasOwnProperty.call(settings.budgetTargets, 'Expense')
          ? ((settings.budgetTargets && settings.budgetTargets.Expense) || {})
          : current.budgetTargets.Expense,
        Income: Object.prototype.hasOwnProperty.call(settings.budgetTargets, 'Income')
          ? ((settings.budgetTargets && settings.budgetTargets.Income) || {})
          : current.budgetTargets.Income,
      }
    : current.budgetTargets;

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
    liveRefresh: {
      ...current.liveRefresh,
      ...((settings && settings.liveRefresh) || {}),
    },
    budgetTargets: nextBudgetTargets,
  });
  SystemMetadataModel.set(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
};
