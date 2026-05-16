const express = require('express');
const DebtModel = require('../models/debt');
const { calculateProjection } = require('../services/debtProjection');

const router = express.Router();

// GET /api/debts
router.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const debts = DebtModel.getByUser({ includeArchived });
  res.json(debts);
});

// GET /api/debts/total
router.get('/total', (req, res) => {
  const total = DebtModel.getTotalDebt();
  res.json({ total });
});

// GET /api/debts/projection?extraPayment=
router.get('/projection', (req, res) => {
  const { extraPayment } = req.query;

  const extra = parseFloat(extraPayment) || 0;
  if (extra < 0) {
    return res.status(400).json({ error: 'extraPayment must be non-negative' });
  }

  const debts = DebtModel.getByUser();
  const projection = calculateProjection(debts, extra);
  res.json(projection);
});

// POST /api/debts/:id/archive
router.post('/:id/archive', (req, res) => {
  const result = DebtModel.archive(req.params.id);
  if (!result.ok && result.reason === 'not_found') {
    return res.status(404).json({ error: 'Debt not found' });
  }
  if (!result.ok && result.reason === 'balance_remaining') {
    return res.status(400).json({ error: 'Only paid off debts can be archived' });
  }
  res.json({ success: true });
});

// POST /api/debts/:id/unarchive
router.post('/:id/unarchive', (req, res) => {
  const updated = DebtModel.unarchive(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Debt not found' });
  }
  res.json({ success: true });
});

// GET /api/debts/:id
router.get('/:id', (req, res) => {
  const debt = DebtModel.getById(req.params.id);
  if (!debt) {
    return res.status(404).json({ error: 'Debt not found' });
  }
  res.json(debt);
});

// POST /api/debts
router.post('/', (req, res) => {
  const { name, accountLast4, startingBalance, currentBalance, interestRate, minimumPayment } = req.body;

  if (!name || startingBalance === undefined) {
    return res.status(400).json({ error: 'name and startingBalance are required' });
  }

  if (accountLast4 !== undefined && accountLast4 !== null && !/^\d{4}$/.test(String(accountLast4))) {
    return res.status(400).json({ error: 'accountLast4 must be exactly 4 digits' });
  }

  if (typeof startingBalance !== 'number' || startingBalance < 0) {
    return res.status(400).json({ error: 'startingBalance must be a non-negative number' });
  }

  try {
    const debt = DebtModel.create({ name, accountLast4, startingBalance, currentBalance, interestRate, minimumPayment });
    res.status(201).json(debt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create debt' });
  }
});

// PUT /api/debts/:id
router.put('/:id', (req, res) => {
  const { name, accountLast4, currentBalance, interestRate, minimumPayment } = req.body;

  if (accountLast4 !== undefined && accountLast4 !== null && !/^\d{4}$/.test(String(accountLast4))) {
    return res.status(400).json({ error: 'accountLast4 must be exactly 4 digits' });
  }

  const updated = DebtModel.update(req.params.id, { name, accountLast4, currentBalance, interestRate, minimumPayment });
  if (!updated) {
    return res.status(404).json({ error: 'Debt not found' });
  }
  res.json({ success: true });
});

// DELETE /api/debts/:id
router.delete('/:id', (req, res) => {
  const deleted = DebtModel.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Debt not found' });
  }
  res.json({ success: true });
});

module.exports = router;
