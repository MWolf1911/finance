const express = require('express');
const { getCategories, setCategories } = require('../lib/categories');

const router = express.Router();

// GET /api/settings/categories
router.get('/categories', (req, res) => {
  const categories = getCategories();
  res.json(categories);
});

// PUT /api/settings/categories
router.put('/categories', (req, res) => {
  const { Expense, Income } = req.body || {};

  if (!Array.isArray(Expense) || !Array.isArray(Income)) {
    return res.status(400).json({ error: 'Expense and Income must be arrays' });
  }

  const normalized = setCategories({ Expense, Income });
  res.json(normalized);
});

module.exports = router;
