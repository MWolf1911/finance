const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db/init');
const { runLazyGeneration } = require('./services/lazyGeneration');
const { runArchiveSnapshot } = require('./services/archiveService');

// Route imports
const householdRouter = require('./routes/household');
const transactionsRouter = require('./routes/transactions');
const templatesRouter = require('./routes/templates');
const debtsRouter = require('./routes/debts');
const archivesRouter = require('./routes/archives');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    // and any origin on the local network
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// ── Initialize Database ────────────────────────────────────
initializeDatabase();

// ── Lazy Generation: run on server start ───────────────────
try {
  const result = runLazyGeneration();
  if (result.generated) {
    console.log(`[Startup] Recurring generation complete: ${result.count} transactions for ${result.month}`);
  }
} catch (err) {
  console.error('[Startup] Lazy generation failed:', err.message);
}

try {
  const archiveResult = runArchiveSnapshot();
  if (archiveResult.archived) {
    console.log(`[Startup] Archive snapshot complete: ${archiveResult.count} month snapshots archived up to ${archiveResult.upTo}`);
  }
} catch (err) {
  console.error('[Startup] Archive snapshot failed:', err.message);
}

// ── API Routes ─────────────────────────────────────────────
app.use('/api/household', householdRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/archives', archivesRouter);

// Health check + trigger lazy generation/archive on app load.
app.get('/api/health', (req, res) => {
  let recurringGeneration, archiveSnapshot;
  try {
    recurringGeneration = runLazyGeneration();
  } catch (err) {
    recurringGeneration = { error: err.message };
  }
  try {
    archiveSnapshot = runArchiveSnapshot();
  } catch (err) {
    archiveSnapshot = { error: err.message };
  }
  res.json({
    status: 'ok',
    recurringGeneration,
    archiveSnapshot
  });
});

// ── Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Finance Tracker API running on http://0.0.0.0:${PORT}`);
});
