const express = require('express');
const router = express.Router();
const ArchiveModel = require('../models/archive');

// GET /api/archives
// Returns all archived month summaries (without full transaction data) for the household
router.get('/', (req, res) => {
  try {
    const archives = ArchiveModel.getByUser();
    res.json(archives);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/archives/:year/:month
// Returns the full archive for a specific month, including transactions
router.get('/:year/:month', (req, res) => {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10);

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Valid year and month required' });
  }

  try {
    const archive = ArchiveModel.getMonth(null, year, month);
    if (!archive) return res.status(404).json({ error: 'Archive not found for this month' });

    res.json({
      ...archive,
      transactions: JSON.parse(archive.transactions_json),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/archives/:year/:month/csv
// Returns CSV download for a specific archived month
router.get('/:year/:month/csv', (req, res) => {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10);

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Valid year and month required' });
  }

  try {
    const archive = ArchiveModel.getMonth(null, year, month);
    if (!archive) return res.status(404).json({ error: 'Archive not found' });

    const transactions = JSON.parse(archive.transactions_json);
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

    // Build CSV
    const header = 'Date,Type,Category,Amount,Description,Recurring';
    const rows = transactions.map((tx) => {
      const desc = (tx.description || '').replace(/"/g, '""');
      return `${tx.date},${tx.type},${tx.category},${tx.amount},"${desc}",${tx.is_recurring ? 'Yes' : 'No'}`;
    });

    const summaryRows = [
      '',
      'Summary',
      `Total Income,${archive.income}`,
      `Total Expenses,${archive.expenses}`,
      `Net,${archive.net}`,
      `Transaction Count,${archive.transaction_count}`,
    ];

    const csv = [header, ...rows, ...summaryRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="archive-${year}-${String(month).padStart(2, '0')}-${monthName}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
