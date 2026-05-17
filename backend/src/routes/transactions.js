const express = require('express');
const TransactionModel = require('../models/transaction');
const RecurringTemplateModel = require('../models/recurringTemplate');
const DebtModel = require('../models/debt');
const { runLazyGeneration } = require('../services/lazyGeneration');
const { getSettings } = require('../lib/settings');

const router = express.Router();

function isDebtPaymentTransaction(tx) {
  return Boolean(tx && tx.type === 'Expense' && tx.category === 'Debt Payment' && tx.debt_id);
}

function validateDebtPayment(type, category, debtId) {
  if (category === 'Debt Payment' && type !== 'Expense') {
    return 'Debt payments must be logged as expenses';
  }

  if (category === 'Debt Payment' && !debtId) {
    return 'debtId is required for debt payments';
  }

  if (category !== 'Debt Payment' && debtId) {
    return 'debtId can only be used with Debt Payment transactions';
  }

  return null;
}

function refundDebtPayment(debtId, amount) {
  const debt = DebtModel.getById(debtId);
  if (!debt) {
    return;
  }

  DebtModel.update(debtId, { currentBalance: debt.current_balance + amount });
}

function applyDebtPayment(debtId, amount) {
  const debt = DebtModel.getById(debtId);
  if (!debt) {
    return { error: 'Selected debt was not found' };
  }

  if (amount > debt.current_balance) {
    return { error: `Payment exceeds remaining balance (${debt.current_balance.toFixed(2)})` };
  }

  const nextBalance = Math.max(0, debt.current_balance - amount);
  DebtModel.update(debtId, { currentBalance: nextBalance });

  const settings = getSettings();
  if (nextBalance <= 0 && settings.debt.autoArchivePaidOff) {
    DebtModel.archive(debtId);
  }

  return { debt };
}

// GET /api/transactions?month=&year=&type=&category=
router.get('/', (req, res) => {
  const { month, year, type, category } = req.query;

  const transactions = TransactionModel.getByUser(null, { month, year, type, category });
  res.json(transactions);
});

// GET /api/transactions/summary?month=&year=
router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ error: 'month and year are required' });
  }

  const summary = TransactionModel.getMonthlySummary(null, parseInt(year, 10), parseInt(month, 10));
  res.json(summary);
});

// GET /api/transactions/:id
router.get('/:id', (req, res) => {
  const tx = TransactionModel.getById(req.params.id);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(tx);
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { type, category, amount, date, description, isRecurring,
          recurrence, dayOfMonth, startDate, endDate, debtId } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'type, category, amount, and date are required' });
  }

  if (!['Income', 'Expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be Income or Expense' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const debtPaymentError = validateDebtPayment(type, category, debtId);
  if (debtPaymentError) {
    return res.status(400).json({ error: debtPaymentError });
  }

  try {
    if (debtId && category === 'Debt Payment') {
      const debt = DebtModel.getById(debtId);
      if (!debt) {
        return res.status(400).json({ error: 'Selected debt was not found' });
      }

      if (amount > debt.current_balance) {
        return res.status(400).json({ error: `Payment exceeds remaining balance (${debt.current_balance.toFixed(2)})` });
      }
    }

    const tx = TransactionModel.create({ type, category, amount, date, description, isRecurring, debtId });

    if (debtId && category === 'Debt Payment') {
      applyDebtPayment(debtId, amount);
    }

    // If marked recurring, also create a recurring template
    if (isRecurring && recurrence) {
      RecurringTemplateModel.create({
        type, recurrence,
        dayOfMonth: dayOfMonth || null,
        startDate: startDate || null,
        endDate: endDate || null,
        category, amount, description,
        debtId: debtId || null,
      });
      runLazyGeneration({ force: true });
    }

    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  const { type, category, amount, date, description, debtId } = req.body;
  const hasDebtId = Object.prototype.hasOwnProperty.call(req.body, 'debtId');

  if (type && !['Income', 'Expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be Income or Expense' });
  }

  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const existing = TransactionModel.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const nextType = type ?? existing.type;
  const nextCategory = category ?? existing.category;
  const nextAmount = amount ?? existing.amount;
  const nextDebtId = hasDebtId ? (debtId || null) : existing.debt_id;

  const debtPaymentError = validateDebtPayment(nextType, nextCategory, nextDebtId);
  if (debtPaymentError) {
    return res.status(400).json({ error: debtPaymentError });
  }

  const wasDebtPayment = isDebtPaymentTransaction(existing);
  const isDebtPayment = nextType === 'Expense' && nextCategory === 'Debt Payment' && Boolean(nextDebtId);

  if (isDebtPayment) {
    const targetDebt = DebtModel.getById(nextDebtId);
    if (!targetDebt) {
      return res.status(400).json({ error: 'Selected debt was not found' });
    }

    const availableBalance = targetDebt.current_balance + (wasDebtPayment && existing.debt_id === nextDebtId ? existing.amount : 0);
    if (nextAmount > availableBalance) {
      return res.status(400).json({ error: `Payment exceeds remaining balance (${availableBalance.toFixed(2)})` });
    }
  }

  const updated = TransactionModel.update(req.params.id, {
    type,
    category,
    amount,
    date,
    description,
    ...(hasDebtId ? { debtId: nextDebtId } : {}),
  });
  if (!updated) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (wasDebtPayment) {
    refundDebtPayment(existing.debt_id, existing.amount);
  }

  if (isDebtPayment) {
    applyDebtPayment(nextDebtId, nextAmount);
  }

  res.json({ success: true });
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const existing = TransactionModel.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const deleted = TransactionModel.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (isDebtPaymentTransaction(existing)) {
    refundDebtPayment(existing.debt_id, existing.amount);
  }

  res.json({ success: true });
});

module.exports = router;
