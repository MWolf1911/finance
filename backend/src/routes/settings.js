const express = require('express');
const { getCategories, setCategories } = require('../lib/categories');
const { getSettings, setSettings } = require('../lib/settings');
const {
  cleanupTempFile,
  createBackupFile,
  restoreBackupBuffer,
} = require('../services/backupService');

const router = express.Router();

router.get('/backup', async (req, res, next) => {
  try {
    const { backupPath, fileName } = await createBackupFile();
    res.download(backupPath, fileName, (err) => {
      cleanupTempFile(backupPath);
      if (err) {
        console.error('[Backup]', err.message);
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/restore', express.raw({ type: () => true, limit: '100mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Upload a backup file to restore' });
  }

  try {
    const result = await restoreBackupBuffer(req.body);
    res.json(result);
  } catch (err) {
    const message = err.message || 'Failed to restore backup';
    const status = message.includes('maintenance already in progress')
      ? 409
      : message.includes('Backup file') || message.includes('Upload a backup file')
        ? 400
        : 500;

    res.status(status).json({ error: message });
  }
});

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

// GET /api/settings
router.get('/', (req, res) => {
  const settings = getSettings();
  res.json(settings);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const settings = setSettings(req.body || {});
  res.json(settings);
});

module.exports = router;
