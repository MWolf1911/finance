'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useTransactions, useMonthlySummary, useTemplates, useCategories, useAppSettings } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getCurrentMonth, getMonthName } from '@/lib/constants';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { usePersistentState } from '@/lib/usePersistentState';
import TransactionModal from '@/components/TransactionModal';

const DEFAULT_SORT = { key: 'date', dir: 'desc' };
const SORT_KEYS = new Set(['category', 'type', 'date', 'amount']);

export default function TransactionsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { month, year } = getCurrentMonth();
  const { transactions, isLoading, mutate } = useTransactions(month, year);
  const { mutate: mutateSummary } = useMonthlySummary(month, year);
  const { templates, mutate: mutateTemplates } = useTemplates();
  const { categories } = useCategories();
  const { settings } = useAppSettings();

  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [savedSort, setSavedSort] = usePersistentState('finance.transactions.sort', DEFAULT_SORT);

  const sortKey = SORT_KEYS.has(savedSort?.key) ? savedSort.key : DEFAULT_SORT.key;
  const sortDir = savedSort?.dir === 'asc' ? 'asc' : DEFAULT_SORT.dir;

  const filtered = useMemo(() => {
    const list = transactions.filter((tx) => {
      if (filterType && tx.type !== filterType) return false;
      if (filterCategory && tx.category !== filterCategory) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !tx.category.toLowerCase().includes(s) &&
          !(tx.description || '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'amount': cmp = a.amount - b.amount; break;
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [transactions, filterType, filterCategory, search, sortKey, sortDir]);

  const expenseCategories = useMemo(
    () => [...(categories.Expense || [])].sort((a, b) => a.localeCompare(b)),
    [categories]
  );
  const incomeCategories = useMemo(
    () => [...(categories.Income || [])].sort((a, b) => a.localeCompare(b)),
    [categories]
  );

  useAutoRefresh([mutate, mutateTemplates]);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  function handleSaved() {
    mutate();
    mutateSummary();
    mutateTemplates();
    setEditData(null);
  }

  async function handleDelete(id) {
    if (settings.transactionDefaults.confirmBeforeDelete && !confirm('Delete this transaction?')) return;
    await api.deleteTransaction(id);
    handleSaved();
  }

  async function handleDeleteTemplate(id) {
    if (settings.transactionDefaults.confirmBeforeDelete && !confirm('Delete this recurring rule? Future transactions will no longer be auto-generated.')) return;
    await api.deleteTemplate(id);
    mutateTemplates();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Transactions</h2>
          <p className="text-gray-500 dark:text-gray-400">{getMonthName(month, year)}</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="text-lg">+</span> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search category or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Categories</option>
            {expenseCategories.length > 0 && (
              <optgroup label="Expense">
                {expenseCategories.map((c) => (
                  <option key={`expense-${c}`} value={c}>{c}</option>
                ))}
              </optgroup>
            )}
            {incomeCategories.length > 0 && (
              <optgroup label="Income">
                {incomeCategories.map((c) => (
                  <option key={`income-${c}`} value={c}>{c}</option>
                ))}
              </optgroup>
            )}
          </select>
          {(filterType || filterCategory || search) && (
            <button
              onClick={() => { setFilterType(''); setFilterCategory(''); setSearch(''); }}
              className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading transactions…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {transactions.length === 0
              ? 'No transactions this month. Add one above!'
              : 'No transactions match your filters.'}
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[1fr_120px_100px_110px_130px_80px] gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <SortHeader label="Category" field="category" sortKey={sortKey} sortDir={sortDir} onSort={(field) => {
                if (sortKey === field) {
                  setSavedSort({ key: field, dir: sortDir === 'asc' ? 'desc' : 'asc' });
                } else {
                  setSavedSort({ key: field, dir: 'asc' });
                }
              }} />
              <SortHeader label="Type" field="type" sortKey={sortKey} sortDir={sortDir} onSort={(field) => {
                if (sortKey === field) {
                  setSavedSort({ key: field, dir: sortDir === 'asc' ? 'desc' : 'asc' });
                } else {
                  setSavedSort({ key: field, dir: 'asc' });
                }
              }} />
              <SortHeader label="Date" field="date" sortKey={sortKey} sortDir={sortDir} onSort={(field) => {
                if (sortKey === field) {
                  setSavedSort({ key: field, dir: sortDir === 'asc' ? 'desc' : 'asc' });
                } else {
                  setSavedSort({ key: field, dir: 'asc' });
                }
              }} />
              <SortHeader label="Amount" field="amount" sortKey={sortKey} sortDir={sortDir} onSort={(field) => {
                if (sortKey === field) {
                  setSavedSort({ key: field, dir: sortDir === 'asc' ? 'desc' : 'asc' });
                } else {
                  setSavedSort({ key: field, dir: 'asc' });
                }
              }} className="justify-end" />
              <span>Recurring</span>
              <span className="text-right">Actions</span>
            </div>

            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_110px_130px_80px] gap-2 md:gap-4 px-6 py-4 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 items-center"
              >
                {/* Category + Description */}
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{tx.category}</p>
                  {tx.description && (
                    <p className="text-sm text-gray-400 truncate">{tx.description}</p>
                  )}
                </div>

                {/* Type badge */}
                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    tx.type === 'Income'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                  }`}>
                    {tx.type}
                  </span>
                </div>

                {/* Date */}
                <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(tx.date)}</span>

                {/* Amount */}
                <span className={`text-right font-mono font-medium ${
                  tx.type === 'Income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>

                {/* Recurring tag */}
                <span className="text-sm text-gray-400">
                  {tx.is_recurring ? '🔄 Recurring' : ''}
                </span>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditData(tx)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Count footer */}
      <p className="text-sm text-gray-400 text-center">
        Showing {filtered.length} of {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
      </p>

      {/* Active Recurring Rules */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Active Recurring Rules</h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm divide-y dark:divide-gray-700">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{tpl.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tpl.type === 'Income' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}>{tpl.type}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatRecurringSchedule(tpl)}
                    {tpl.end_date ? ` · Ends ${tpl.end_date}` : ''}
                    {tpl.description ? ` · ${tpl.description}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`font-mono font-medium ${tpl.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(tpl.amount)}
                  </span>
                  <button onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Delete recurring rule">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      <TransactionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleSaved}
      />

      {/* Edit modal */}
      {editData && (
        <TransactionModal
          open={true}
          onClose={() => setEditData(null)}
          onSaved={handleSaved}
          editData={editData}
        />
      )}
    </div>
  );
}

function formatRecurringSchedule(tpl) {
  const rec = tpl.recurrence || 'monthly';
  if (rec === 'monthly') {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = (tpl.day_of_month || 1) % 100;
    const ord = (tpl.day_of_month || 1) + (s[(v - 20) % 10] || s[v] || s[0]);
    return `Monthly (${ord})`;
  }
  const label = rec === 'biweekly' ? 'Bi-Weekly' : 'Weekly';
  if (tpl.start_date) {
    const d = new Date(tpl.start_date + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${label} (${days[d.getDay()]})`;
  }
  return label;
}

function SortHeader({ label, field, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === field;
  function handleClick() {
    onSort(field);
  }
  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${className}`}
    >
      {label}
      <span className={`text-[10px] ${active ? 'text-blue-500' : 'opacity-30'}`}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
      </span>
    </button>
  );
}
