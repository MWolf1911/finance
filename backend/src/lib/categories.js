const SystemMetadataModel = require('../models/systemMetadata');

const DEFAULT_CATEGORIES = {
  Expense: [
    'Rent/Mortgage', 'Utilities', 'Internet', 'Phone', 'Insurance',
    'Groceries', 'Dining Out', 'Transportation', 'Gas', 'Car Payment',
    'Medical', 'Subscriptions', 'Entertainment', 'Clothing', 'Personal Care',
    'Education', 'Childcare', 'Pet', 'Home Maintenance', 'Gifts', 'Other Expense'
  ],
  Income: [
    'Salary', 'Freelance', 'Side Hustle', 'Bonus', 'Tax Refund',
    'Investment', 'Rental Income', 'Other Income'
  ]
};

const CATEGORIES_KEY = 'categories_config';

function normalizeCategories(input = {}) {
  const normalized = {
    Expense: normalizeList(input.Expense, DEFAULT_CATEGORIES.Expense),
    Income: normalizeList(input.Income, DEFAULT_CATEGORIES.Income)
  };

  return normalized;
}

function normalizeList(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set();
  const result = [];

  for (const item of source) {
    const trimmed = String(item || '').trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function getCategories() {
  const raw = SystemMetadataModel.get(CATEGORIES_KEY);
  if (!raw) {
    return DEFAULT_CATEGORIES;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeCategories(parsed);
  } catch (err) {
    return DEFAULT_CATEGORIES;
  }
}

function setCategories(categories) {
  const normalized = normalizeCategories(categories);
  SystemMetadataModel.set(CATEGORIES_KEY, JSON.stringify(normalized));
  return normalized;
}

module.exports = {
  DEFAULT_CATEGORIES,
  getCategories,
  setCategories
};
