'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useArchives, useArchiveMonth, useAppSettings } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/constants';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPrintableArchiveHtml({ archive, month, year, mode = 'detailed', includeDescriptions = true }) {
  const rows = (archive.transactions || []).map((tx) => {
    const amount = `${tx.type === 'Income' ? '+' : '-'}${formatCurrency(tx.amount)}`;

    return `
      <tr>
        <td>
          <div class="category">${escapeHtml(tx.category)}</div>
          ${includeDescriptions && tx.description ? `<div class="description">${escapeHtml(tx.description)}</div>` : ''}
        </td>
        <td>${escapeHtml(tx.type)}</td>
        <td>${escapeHtml(formatDate(tx.date))}</td>
        <td class="amount ${tx.type === 'Income' ? 'income' : 'expense'}">${escapeHtml(amount)}</td>
        <td>${tx.is_recurring ? 'Yes' : ''}</td>
      </tr>
    `;
  }).join('');

  return `
    <html>
      <head>
        <title>${escapeHtml(`${MONTH_NAMES[month]} ${year} - Transactions`)}</title>
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            line-height: 1.4;
          }

          .page {
            max-width: 960px;
            margin: 0 auto;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 16px;
            padding-bottom: 16px;
            border-bottom: 2px solid #d1d5db;
            margin-bottom: 20px;
          }

          .title {
            font-size: 28px;
            font-weight: 700;
            margin: 0;
          }

          .subtitle {
            margin: 4px 0 0;
            color: #4b5563;
            font-size: 14px;
          }

          .generated {
            text-align: right;
            color: #6b7280;
            font-size: 12px;
            white-space: nowrap;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .summary-card {
            border: 1px solid #d1d5db;
            padding: 12px 14px;
            background: #f9fafb;
          }

          .summary-label {
            margin: 0 0 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
          }

          .summary-value {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }

          .income {
            color: #166534;
          }

          .expense {
            color: #b91c1c;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          thead {
            display: table-header-group;
          }

          th {
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #4b5563;
            background: #f3f4f6;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
          }

          td {
            padding: ${mode === 'compact' ? '7px 10px' : '10px 12px'};
            vertical-align: top;
            border-bottom: 1px solid #e5e7eb;
            font-size: ${mode === 'compact' ? '12px' : '13px'};
            word-break: break-word;
          }

          .category {
            font-weight: 600;
          }

          .description {
            margin-top: 3px;
            color: #6b7280;
            font-size: ${mode === 'compact' ? '11px' : '12px'};
          }

          .amount {
            text-align: right;
            font-family: 'Consolas', 'SFMono-Regular', monospace;
            font-weight: 700;
            white-space: nowrap;
          }

          .empty {
            padding: 24px 0;
            text-align: center;
            color: #6b7280;
            border-top: 1px solid #d1d5db;
          }

          @page {
            size: auto;
            margin: 0.5in;
          }

          @media print {
            body {
              padding: 0;
            }

            .page {
              max-width: none;
            }

            tr,
            td,
            th,
            .summary-card {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(`${MONTH_NAMES[month]} ${year}`)}</h1>
              <p class="subtitle">Archived monthly transaction history</p>
            </div>
            <div class="generated">
              <div>${escapeHtml(`${archive.transaction_count} transaction${archive.transaction_count === 1 ? '' : 's'}`)}</div>
              <div>Printed ${escapeHtml(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</div>
            </div>
          </div>

          <section class="summary">
            <div class="summary-card">
              <p class="summary-label">Income</p>
              <p class="summary-value income">+${escapeHtml(formatCurrency(archive.income))}</p>
            </div>
            <div class="summary-card">
              <p class="summary-label">Expenses</p>
              <p class="summary-value expense">-${escapeHtml(formatCurrency(archive.expenses))}</p>
            </div>
            <div class="summary-card">
              <p class="summary-label">Net</p>
              <p class="summary-value ${archive.net >= 0 ? 'income' : 'expense'}">${escapeHtml(formatCurrency(archive.net))}</p>
            </div>
            <div class="summary-card">
              <p class="summary-label">Transactions</p>
              <p class="summary-value">${escapeHtml(archive.transaction_count)}</p>
            </div>
          </section>

          ${archive.transactions && archive.transactions.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th style="width: 42%;">Category / Description</th>
                  <th style="width: 14%;">Type</th>
                  <th style="width: 16%;">Date</th>
                  <th style="width: 16%; text-align: right;">Amount</th>
                  <th style="width: 12%;">Recurring</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          ` : '<div class="empty">No transactions this month.</div>'}
        </div>
      </body>
    </html>
  `;
}

export default function ArchivePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { archives, isLoading, mutate: mutateArchives } = useArchives();
  const [expandedYear, setExpandedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [reconciliationFilter, setReconciliationFilter] = useState('all');

  const filteredArchives = useMemo(() => {
    if (reconciliationFilter === 'reconciled') {
      return archives.filter((archive) => Boolean(archive.reconciled_at));
    }

    if (reconciliationFilter === 'unreconciled') {
      return archives.filter((archive) => !archive.reconciled_at);
    }

    return archives;
  }, [archives, reconciliationFilter]);

  const reconciliationSummary = useMemo(() => {
    const total = archives.length;
    const reconciled = archives.filter((archive) => Boolean(archive.reconciled_at)).length;
    const unreconciled = total - reconciled;

    return { total, reconciled, unreconciled };
  }, [archives]);

  // Group archives by year
  const byYear = useMemo(() => {
    const map = {};
    for (const a of filteredArchives) {
      if (!map[a.year]) map[a.year] = [];
      map[a.year].push(a);
    }
    // Sort months within each year
    for (const y of Object.keys(map)) {
      map[y].sort((a, b) => a.month - b.month);
    }
    return map;
  }, [filteredArchives]);

  const years = useMemo(
    () => Object.keys(byYear).map(Number).sort((a, b) => b - a),
    [byYear]
  );

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  if (isLoading) {
    return <div className="text-center py-20 text-gray-400">Loading archives…</div>;
  }

  if (years.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archive</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-12 text-center text-gray-400">
          {archives.length === 0
            ? 'No archived months yet. Archives are created automatically at the start of each new month.'
            : 'No months match the current reconciliation filter.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archive</h2>
        <p className="text-gray-500 dark:text-gray-400">Monthly transaction history</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ArchiveStatusCard label="Archived Months" value={reconciliationSummary.total} tone="slate" />
          <ArchiveStatusCard label="Reconciled" value={reconciliationSummary.reconciled} tone="green" />
          <ArchiveStatusCard label="Needs Review" value={reconciliationSummary.unreconciled} tone="amber" />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="All Months"
            active={reconciliationFilter === 'all'}
            onClick={() => setReconciliationFilter('all')}
          />
          <FilterButton
            label="Needs Review"
            active={reconciliationFilter === 'unreconciled'}
            onClick={() => setReconciliationFilter('unreconciled')}
          />
          <FilterButton
            label="Reconciled"
            active={reconciliationFilter === 'reconciled'}
            onClick={() => setReconciliationFilter('reconciled')}
          />
        </div>
      </div>

      {/* Year cards */}
      <div className="space-y-4">
        {years.map((year) => (
          <YearCard
            key={year}
            year={year}
            months={byYear[year]}
            expanded={expandedYear === year}
            onToggle={() => setExpandedYear(expandedYear === year ? null : year)}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
        ))}
      </div>

      {/* Month detail overlay */}
      {selectedMonth && (
        <MonthDetail
          year={selectedMonth.year}
          month={selectedMonth.month}
          onUpdated={() => mutateArchives()}
          onClose={() => setSelectedMonth(null)}
        />
      )}
    </div>
  );
}

function YearCard({ year, months, expanded, onToggle, selectedMonth, onSelectMonth }) {
  const yearIncome = months.reduce((s, m) => s + m.income, 0);
  const yearExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const yearNet = yearIncome - yearExpenses;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Year header — clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{year}</span>
          <span className="text-sm text-gray-400">{months.length} month{months.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex gap-6 text-sm">
            <span className="text-green-600">+{formatCurrency(yearIncome)}</span>
            <span className="text-red-600">-{formatCurrency(yearExpenses)}</span>
            <span className={yearNet >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {formatCurrency(yearNet)}
            </span>
          </div>
          <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded months */}
      {expanded && (
        <div className="border-t dark:border-gray-700 divide-y dark:divide-gray-700">
          {months.map((m) => (
            <MonthSummaryRow
              key={m.month}
              archive={m}
              selected={selectedMonth?.year === m.year && selectedMonth?.month === m.month}
              onSelect={() => onSelectMonth({ year: m.year, month: m.month })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MonthSummaryRow({ archive, selected, onSelect }) {
  const { year, month, income, expenses, net, transaction_count } = archive;

  function handleDownload(e) {
    e.stopPropagation();
    const url = api.getArchiveCsvUrl(year, month);
    window.open(url, '_blank');
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-6 py-3.5 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors text-left ${
        selected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-base font-medium text-gray-700 dark:text-gray-200 w-28">
          {MONTH_NAMES[month]}
        </span>
        <span className="text-xs text-gray-400">{transaction_count} txn{transaction_count !== 1 ? 's' : ''}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
          archive.reconciled_at
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        }`}>
          {archive.reconciled_at ? 'Reconciled' : 'Needs Review'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">+{formatCurrency(income)}</span>
          <span className="text-red-600">-{formatCurrency(expenses)}</span>
          <span className={`font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(net)}
          </span>
        </div>
        <span
          onClick={handleDownload}
          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
          title="Download CSV"
        >
          ⬇️
        </span>
      </div>
    </button>
  );
}

function MonthDetail({ year, month, onClose, onUpdated }) {
  const { archive, isLoading, mutate } = useArchiveMonth(year, month);
  const { settings } = useAppSettings();
  const [reconciledEndingInput, setReconciledEndingInput] = useState('');
  const [reconciliationNotesInput, setReconciliationNotesInput] = useState('');
  const [reconciliationError, setReconciliationError] = useState('');
  const [isSavingReconciliation, setIsSavingReconciliation] = useState(false);

  useEffect(() => {
    setReconciledEndingInput(
      archive?.reconciled_ending_balance === null || archive?.reconciled_ending_balance === undefined
        ? ''
        : String(archive.reconciled_ending_balance)
    );
  }, [archive?.reconciled_ending_balance, year, month]);

  useEffect(() => {
    setReconciliationNotesInput(archive?.reconciliation_notes ?? '');
  }, [archive?.reconciliation_notes, year, month]);

  function handleDownload() {
    const url = api.getArchiveCsvUrl(year, month);
    window.open(url, '_blank');
  }

  function handlePrint() {
    if (!archive) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(buildPrintableArchiveHtml({
      archive,
      month,
      year,
      mode: settings.archivePrint.mode,
      includeDescriptions: settings.archivePrint.includeDescriptions,
    }));
    win.document.close();
    win.print();
  }

  async function handleSaveReconciliation() {
    const parsed = parseFloat(reconciledEndingInput);
    const normalizedNotes = reconciliationNotesInput.trim() || null;
    if (!Number.isFinite(parsed)) {
      setReconciliationError('Enter a valid actual ending balance');
      return;
    }

    setIsSavingReconciliation(true);
    setReconciliationError('');
    try {
      const updated = await api.updateDashboardReconciliation(year, month, {
        actualEndingBalance: parsed,
        reconciliationNotes: normalizedNotes,
      });
      await mutate({
        ...archive,
        reconciled_ending_balance: updated.actualEndingBalance,
        reconciliation_notes: updated.reconciliationNotes,
        reconciled_at: updated.reconciledAt,
      }, false);
      onUpdated?.();
    } catch (err) {
      setReconciliationError(err.message || 'Failed to save reconciliation');
    } finally {
      setIsSavingReconciliation(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Download CSV"
          >
            ⬇️ CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title="Print"
          >
            🖨️ Print
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading transactions…</div>
      ) : !archive ? (
        <div className="text-center py-12 text-gray-400">Archive not found.</div>
      ) : (
        <div>
          <div className="px-6 py-4 border-b dark:border-gray-700 bg-emerald-50/40 dark:bg-emerald-900/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Monthly Reconciliation</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {archive.reconciled_at
                    ? `Reconciled ${new Date(archive.reconciled_at).toLocaleString()}`
                    : 'Save the actual ending balance for this archived month.'}
                </p>
              </div>
              {archive.reconciled_at && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                  Reconciled
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Projected End</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(archive.ending_balance ?? archive.net ?? 0)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Actual End</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  {archive.reconciled_ending_balance === null || archive.reconciled_ending_balance === undefined
                    ? 'Not saved'
                    : formatCurrency(archive.reconciled_ending_balance)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Variance</p>
                <p className={`font-semibold ${
                  archive.reconciled_ending_balance === null || archive.reconciled_ending_balance === undefined
                    ? 'text-gray-800 dark:text-gray-100'
                    : archive.reconciled_ending_balance - (archive.ending_balance ?? 0) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                }`}>
                  {archive.reconciled_ending_balance === null || archive.reconciled_ending_balance === undefined
                    ? 'Not reconciled'
                    : formatCurrency(archive.reconciled_ending_balance - (archive.ending_balance ?? 0))}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={reconciledEndingInput}
                onChange={(e) => setReconciledEndingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveReconciliation();
                  }
                }}
                placeholder="Actual ending balance"
                className="w-full max-w-sm px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-emerald-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              />
              <button
                onClick={handleSaveReconciliation}
                disabled={isSavingReconciliation}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Reconciliation Notes</label>
              <textarea
                value={reconciliationNotesInput}
                onChange={(e) => setReconciliationNotesInput(e.target.value)}
                onBlur={handleSaveReconciliation}
                rows={3}
                placeholder="Optional note about any variance or cleared adjustments"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-emerald-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 resize-y"
              />
            </div>
            {isSavingReconciliation && <p className="text-xs text-blue-600">Saving reconciliation…</p>}
            {reconciliationError && <p className="text-xs text-red-500">{reconciliationError}</p>}
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 border-b dark:border-gray-700">
            <SummaryCell label="Income" value={archive.income} className="text-green-600" prefix="+" />
            <SummaryCell label="Expenses" value={archive.expenses} className="text-red-600" prefix="-" />
            <SummaryCell label="Net" value={archive.net} className={archive.net >= 0 ? 'text-green-600' : 'text-red-600'} />
            <SummaryCell label="Transactions" value={archive.transaction_count} raw />
          </div>

          {/* Transaction table */}
          {archive.transactions && archive.transactions.length > 0 ? (
            <>
              <div className="hidden md:grid grid-cols-[1fr_100px_100px_110px_80px] gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <span>Category / Description</span>
                <span>Type</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span>Recurring</span>
              </div>
              {archive.transactions.map((tx, i) => (
                <div
                  key={tx.id || i}
                  className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_110px_80px] gap-2 md:gap-4 px-6 py-3 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 items-center"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{tx.category}</p>
                    {tx.description && (
                      <p className="text-sm text-gray-400 truncate">{tx.description}</p>
                    )}
                  </div>
                  <div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      tx.type === 'Income'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}>
                      {tx.type}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(tx.date)}</span>
                  <span className={`text-right font-mono font-medium ${
                    tx.type === 'Income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                  <span className="text-sm text-gray-400">
                    {tx.is_recurring ? '🔄' : ''}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No transactions this month.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ArchiveStatusCard({ label, value, tone }) {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-200',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  };

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCell({ label, value, className = '', prefix = '', raw = false }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold ${className}`}>
        {raw ? value : `${prefix}${formatCurrency(Math.abs(value))}`}
      </p>
    </div>
  );
}
