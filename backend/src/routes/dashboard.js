const express = require('express');
const DashboardBalanceModel = require('../models/dashboardBalance');
const TransactionModel = require('../models/transaction');

const router = express.Router();

function parseMonthYear(req, res) {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: 'Valid year and month are required' });
    return null;
  }

  return { year, month };
}

// GET /api/dashboard/balance?year=&month=
router.get('/balance', (req, res) => {
  const parsed = parseMonthYear(req, res);
  if (!parsed) {
    return;
  }

  const { year, month } = parsed;
  const { startingBalance, source } = DashboardBalanceModel.getStartingBalance(year, month);
  const summary = TransactionModel.getMonthlySummary(null, year, month);
  const endingBalance = startingBalance + (summary.net || 0);

  res.json({
    year,
    month,
    source,
    startingBalance,
    endingBalance,
    net: summary.net || 0,
  });
});

// PUT /api/dashboard/balance?year=&month=
router.put('/balance', (req, res) => {
  const parsed = parseMonthYear(req, res);
  if (!parsed) {
    return;
  }

  const { startingBalance } = req.body || {};
  if (typeof startingBalance !== 'number' || Number.isNaN(startingBalance)) {
    return res.status(400).json({ error: 'startingBalance must be a valid number' });
  }

  const { year, month } = parsed;
  const saved = DashboardBalanceModel.setStartingBalance(year, month, startingBalance);
  const summary = TransactionModel.getMonthlySummary(null, year, month);

  res.json({
    year,
    month,
    source: 'saved',
    startingBalance: saved,
    endingBalance: saved + (summary.net || 0),
    net: summary.net || 0,
  });
});

module.exports = router;
