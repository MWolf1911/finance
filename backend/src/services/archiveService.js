/**
 * Archive Service
 *
 * On the first of a new month (triggered lazily at startup or health check),
 * snapshots all transactions from the previous month into monthly_archives
 * for each user. Uses system_metadata key 'last_archive_run' to track
 * the last archived month (YYYY-MM).
 */

const { getDb } = require('../db/init');
const ArchiveModel = require('../models/archive');
const DashboardBalanceModel = require('../models/dashboardBalance');

const METADATA_KEY = 'last_archive_run';

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonth(dateKey) {
  const [y, m] = dateKey.split('-').map(Number);
  if (m === 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

function monthKeyFromParts(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function runArchiveSnapshot() {
  const db = getDb();
  try {
    const currentKey = getCurrentMonthKey();

    // Check what we last archived
    const lastRun = db.prepare('SELECT value FROM system_metadata WHERE key = ?').get(METADATA_KEY);
    const lastArchived = lastRun ? lastRun.value : null;

    // If we already archived up to the month before the current one, nothing to do
    const prev = getPreviousMonth(currentKey);
    const prevKey = monthKeyFromParts(prev.year, prev.month);

    if (lastArchived && lastArchived >= prevKey) {
      return { archived: false, reason: 'already up to date' };
    }

    // Determine the range of months to archive
    // Start from the month after lastArchived (or from the earliest transaction month)
    let startYear, startMonth;
    if (lastArchived) {
      const next = getNextMonth(lastArchived);
      startYear = next.year;
      startMonth = next.month;
    } else {
      // Find the earliest transaction
      const earliest = db.prepare('SELECT MIN(date) as minDate FROM transactions').get();
      if (!earliest || !earliest.minDate) {
        return { archived: false, reason: 'no transactions' };
      }
      const [ey, em] = earliest.minDate.split('-').map(Number);
      startYear = ey;
      startMonth = em;
    }

    // Get all users
    const users = db.prepare('SELECT id FROM users').all();

    let totalArchived = 0;
    let curYear = startYear;
    let curMonth = startMonth;

    // Archive each month up to (but not including) the current month
    while (monthKeyFromParts(curYear, curMonth) < currentKey) {
      const monthStr = String(curMonth).padStart(2, '0');
      const datePrefix = `${curYear}-${monthStr}%`;

      for (const user of users) {
        // Skip if already archived for this user/month
        if (ArchiveModel.exists(user.id, curYear, curMonth)) {
          continue;
        }

        // Get transactions for this user/month
        const transactions = db.prepare(`
          SELECT * FROM transactions
          WHERE user_id = ? AND date LIKE ?
          ORDER BY date ASC
        `).all(user.id, datePrefix);

        // Calculate summary
        let income = 0;
        let expenses = 0;
        for (const tx of transactions) {
          if (tx.type === 'Income') income += tx.amount;
          else expenses += tx.amount;
        }

        const { startingBalance } = DashboardBalanceModel.getStartingBalance(curYear, curMonth);
        const endingBalance = startingBalance + (income - expenses);

        ArchiveModel.create({
          userId: user.id,
          year: curYear,
          month: curMonth,
          startingBalance,
          endingBalance,
          income,
          expenses,
          net: income - expenses,
          transactionCount: transactions.length,
          transactionsJson: JSON.stringify(transactions),
        });

        totalArchived++;
      }

      // Move to the next month
      const next = getNextMonth(monthKeyFromParts(curYear, curMonth));
      curYear = next.year;
      curMonth = next.month;
    }

    // Update the metadata to mark last archived month
    db.prepare(`
      INSERT INTO system_metadata (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(METADATA_KEY, prevKey);

    return { archived: true, count: totalArchived, upTo: prevKey };
  } finally {
    db.close();
  }
}

function getNextMonth(dateKey) {
  const [y, m] = dateKey.split('-').map(Number);
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}

module.exports = { runArchiveSnapshot };
