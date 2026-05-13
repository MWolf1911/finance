'use client';

import { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useArchives, useArchiveMonth } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/constants';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ArchivePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { archives, isLoading } = useArchives();
  const [expandedYear, setExpandedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Group archives by year
  const byYear = useMemo(() => {
    const map = {};
    for (const a of archives) {
      if (!map[a.year]) map[a.year] = [];
      map[a.year].push(a);
    }
    // Sort months within each year
    for (const y of Object.keys(map)) {
      map[y].sort((a, b) => a.month - b.month);
    }
    return map;
  }, [archives]);

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
          No archived months yet. Archives are created automatically at the start of each new month.
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

function MonthDetail({ year, month, onClose }) {
  const { archive, isLoading } = useArchiveMonth(year, month);
  const printRef = useRef(null);

  function handleDownload() {
    const url = api.getArchiveCsvUrl(year, month);
    window.open(url, '_blank');
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>${MONTH_NAMES[month]} ${year} - Transactions</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1f2937; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .subtitle { color: #6b7280; margin-bottom: 20px; }
            .summary { display: flex; gap: 32px; margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
            .summary div { text-align: center; }
            .summary .label { font-size: 12px; color: #6b7280; }
            .summary .value { font-size: 18px; font-weight: 600; }
            .green { color: #16a34a; }
            .red { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th { text-align: left; padding: 8px 12px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280; }
            td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
            .amount { text-align: right; font-family: monospace; font-weight: 500; }
            @media print { .summary { background: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
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
        <div ref={printRef}>
          {/* Print-only header (hidden on screen) */}
          <div className="hidden">
            <h1>{MONTH_NAMES[month]} {year} — Transactions</h1>
            <p className="subtitle">{archive.transaction_count} transactions</p>
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
