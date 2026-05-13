const express = require('express');
const TransactionModel = require('../models/transaction');
const RecurringTemplateModel = require('../models/recurringTemplate');
const DebtModel = require('../models/debt');
const { runLazyGeneration } = require('../services/lazyGeneration');

const router = express.Router();

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

  try {
    const tx = TransactionModel.create({ type, category, amount, date, description, isRecurring, debtId });

    // If this is a debt payment, reduce the debt balance
    if (debtId && category === 'Debt Payment') {
      const debt = DebtModel.getById(debtId);
      if (debt) {
        const newBalance = Math.max(0, debt.current_balance - amount);
        DebtModel.update(debtId, { currentBalance: newBalance });
      }
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
  const { type, category, amount, date, description } = req.body;

  if (type && !['Income', 'Expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be Income or Expense' });
  }

  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const updated = TransactionModel.update(req.params.id, { type, category, amount, date, description });
  if (!updated) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json({ success: true });
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const deleted = TransactionModel.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json({ success: true });
});

module.exports = router;
