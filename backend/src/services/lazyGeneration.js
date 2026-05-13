/**
 * Lazy Generation Service
 *
 * On app load (or first request of a new month), checks if recurring
 * transactions have been generated for the current month. If not,
 * generates all occurrences for each active template based on its
 * recurrence type (weekly, biweekly, monthly) up to today's date.
 *
 * Uses system_metadata key 'last_recurring_run' to track the last
 * month (YYYY-MM) for which generation was completed, and
 * 'last_recurring_run_date' for the last actual date processed.
 */

const crypto = require('crypto');
const { getDb } = require('../db/init');

const METADATA_MONTH_KEY = 'last_recurring_run';
const METADATA_DATE_KEY = 'last_recurring_run_date';

/**
 * Returns the current month string in YYYY-MM format.
 */
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns today as YYYY-MM-DD.
 */
function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Clamps a day to the maximum days in a given month.
 * e.g., day 31 in February → 28 (or 29 in leap years)
 */
function clampDay(day, year, month) {
  const maxDay = new Date(year, month, 0).getDate(); // month is 1-based here
  return Math.min(day, maxDay);
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Get all occurrence dates for a template in a given month, up to cutoffDate.
 * Respects end_date: no occurrences are generated past the template's end_date.
 */
function getOccurrences(tpl, year, month, cutoffDate) {
  const recurrence = tpl.recurrence || 'monthly';
  const dates = [];

  // If template has an end_date, clamp the cutoff so we never generate past it
  let effectiveCutoff = cutoffDate;
  if (tpl.end_date) {
    const endDate = new Date(tpl.end_date + 'T00:00:00');
    if (endDate < effectiveCutoff) {
      effectiveCutoff = endDate;
    }
  }

  if (recurrence === 'monthly') {
    const day = clampDay(tpl.day_of_month || 1, year, month);
    const d = new Date(year, month - 1, day);
    if (d <= effectiveCutoff) {
      dates.push(dateToStr(d));
    }
  } else {
    // weekly or biweekly — compute from start_date
    const startDate = tpl.start_date ? new Date(tpl.start_date + 'T00:00:00') : new Date(tpl.created_at);
    const intervalDays = recurrence === 'biweekly' ? 14 : 7;

    // First day of target month
    const monthStart = new Date(year, month - 1, 1);
    // Last day of target month
    const monthEnd = new Date(year, month, 0);
    // Don't go past cutoff
    const end = monthEnd < effectiveCutoff ? monthEnd : effectiveCutoff;

    if (startDate > end) return dates;

    // Calculate first occurrence on or after monthStart
    const diffMs = monthStart.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    let skipCycles;
    if (diffDays <= 0) {
      skipCycles = 0;
    } else {
      skipCycles = Math.floor(diffDays / intervalDays);
    }

    // Walk from there forward through the month
    let cursor = new Date(startDate.getTime() + skipCycles * intervalDays * 86400000);
    // Step back one cycle to be safe (rounding)
    if (cursor > monthStart) {
      cursor = new Date(cursor.getTime() - intervalDays * 86400000);
    }

    for (let i = 0; i < 10; i++) {
      if (cursor >= monthStart && cursor <= end) {
        dates.push(dateToStr(cursor));
      }
      cursor = new Date(cursor.getTime() + intervalDays * 86400000);
      if (cursor > end) break;
    }
  }

  return dates;
}

/**
 * Main lazy generation function.
 * - Checks system_metadata for last run month/date
 * - If current month not run yet, generates all occurrences up to today
 * - If same month but new day, generates any new weekly/biweekly occurrences
 *
 * Returns: { generated: boolean, count: number, month: string }
 */
function runLazyGeneration({ force = false } = {}) {
  const db = getDb();

  try {
    const currentMonth = getCurrentMonthKey();
    const today = getTodayStr();
    const [yearStr, monthStr] = currentMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const todayDate = new Date(today + 'T00:00:00');

    // Check last run state
    const lastMonth = db.prepare(
      "SELECT value FROM system_metadata WHERE key = ?"
    ).get(METADATA_MONTH_KEY);

    const lastDate = db.prepare(
      "SELECT value FROM system_metadata WHERE key = ?"
    ).get(METADATA_DATE_KEY);

    const lastRunMonth = lastMonth?.value;
    const lastRunDate = lastDate?.value;

    // If we already ran today for this month, skip entirely (unless forced)
    if (!force && lastRunMonth === currentMonth && lastRunDate === today) {
      console.log(`[LazyGen] Already generated for ${currentMonth} up to ${today}, skipping.`);
      return { generated: false, count: 0, month: currentMonth };
    }

    const isNewMonth = lastRunMonth !== currentMonth;

    // Fetch all active recurring templates
    const templates = db.prepare(
      'SELECT * FROM recurring_templates WHERE active = 1'
    ).all();

    if (templates.length === 0) {
      updateMetadata(db, currentMonth, today);
      console.log(`[LazyGen] No active templates. Marked ${currentMonth} as done.`);
      return { generated: true, count: 0, month: currentMonth };
    }

    // Build set of dates that already have recurring transactions this month
    const existingRows = db.prepare(`
      SELECT date, category, user_id, amount FROM transactions
      WHERE is_recurring = 1 AND date LIKE ?
    `).all(`${currentMonth}%`);

    const existingSet = new Set(
      existingRows.map(r => `${r.user_id}|${r.category}|${r.amount}|${r.date}`)
    );

    // Generate transactions in a single atomic transaction
    const insertTx = db.prepare(`
      INSERT INTO transactions (id, user_id, type, category, amount, date, description, is_recurring, debt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const updateDebtBalance = db.prepare(`
      UPDATE debts SET current_balance = MAX(0, current_balance - ?) WHERE id = ?
    `);

    const generateAll = db.transaction(() => {
      let count = 0;

      for (const tpl of templates) {
        // Auto-deactivate templates whose end_date has passed
        if (tpl.end_date && tpl.end_date < today) {
          db.prepare('UPDATE recurring_templates SET active = 0 WHERE id = ?').run(tpl.id);
          continue;
        }

        const occurrences = getOccurrences(tpl, year, month, todayDate);

        for (const txDate of occurrences) {
          // Dedup: skip if this exact (user, category, amount, date) already exists
          const key = `${tpl.user_id}|${tpl.category}|${tpl.amount}|${txDate}`;
          if (existingSet.has(key)) continue;

          insertTx.run(
            crypto.randomUUID(),
            tpl.user_id,
            tpl.type,
            tpl.category,
            tpl.amount,
            txDate,
            tpl.description,
            tpl.debt_id || null
          );

          // If this is a debt payment, reduce the debt balance
          if (tpl.debt_id && tpl.category === 'Debt Payment') {
            updateDebtBalance.run(tpl.amount, tpl.debt_id);
          }

          existingSet.add(key);
          count++;
        }
      }

      updateMetadata(db, currentMonth, today);
      return count;
    });

    const count = generateAll();
    console.log(`[LazyGen] Generated ${count} recurring transactions for ${currentMonth} (up to ${today}).`);
    return { generated: true, count, month: currentMonth };

  } finally {
    db.close();
  }
}

function updateMetadata(db, monthKey, dateKey) {
  const upsert = db.prepare(`
    INSERT INTO system_metadata (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  upsert.run(METADATA_MONTH_KEY, monthKey);
  upsert.run(METADATA_DATE_KEY, dateKey);
}

module.exports = { runLazyGeneration, getCurrentMonthKey, clampDay };
