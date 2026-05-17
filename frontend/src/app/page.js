'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useAppSettings, useDashboardBalance, useMonthlySummary, useTransactions } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonth, getMonthName, formatDate } from '@/lib/constants';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import AutoRefreshIndicator from '@/components/AutoRefreshIndicator';
import TransactionModal from '@/components/TransactionModal';

export default function DashboardPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { month, year } = getCurrentMonth();
  const { summary, mutate: mutateSummary } = useMonthlySummary(month, year);
  const { transactions, mutate: mutateTransactions } = useTransactions(month, year);
  const { balance, mutate: mutateBalance } = useDashboardBalance(month, year);
  const { settings } = useAppSettings();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [startingBalanceInput, setStartingBalanceInput] = useState('0');
  const [reconciledEndingInput, setReconciledEndingInput] = useState('');
  const [reconciliationNotesInput, setReconciliationNotesInput] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [reconciliationError, setReconciliationError] = useState('');
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [isSavingReconciliation, setIsSavingReconciliation] = useState(false);

  const refreshIntervalSeconds = settings.liveRefresh?.intervalSeconds ?? 10;
  const refreshStatus = useAutoRefresh([mutateSummary, mutateTransactions, mutateBalance], refreshIntervalSeconds * 1000);

  useEffect(() => {
    setStartingBalanceInput(String(balance.startingBalance ?? 0));
  }, [balance.startingBalance, month, year]);

  useEffect(() => {
    setReconciledEndingInput(
      balance.actualEndingBalance === null || balance.actualEndingBalance === undefined
        ? ''
        : String(balance.actualEndingBalance)
    );
  }, [balance.actualEndingBalance, month, year]);

  useEffect(() => {
    setReconciliationNotesInput(balance.reconciliationNotes ?? '');
  }, [balance.reconciliationNotes, month, year]);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  const recentTransactions = transactions.slice(0, 5);
  const parsedStartingBalance = parseFloat(startingBalanceInput);
  const hasStartingBalance = Number.isFinite(parsedStartingBalance);
  const endingBalance = hasStartingBalance
    ? parsedStartingBalance + ((summary?.income ?? 0) - (summary?.expenses ?? 0))
    : null;
  const parsedReconciledEnding = parseFloat(reconciledEndingInput);
  const hasReconciledEnding = Number.isFinite(parsedReconciledEnding);
  const normalizedReconciliationNotes = reconciliationNotesInput.trim() || null;
  const reconciliationVariance = hasReconciledEnding && endingBalance !== null
    ? parsedReconciledEnding - endingBalance
    : balance.variance;
  const categoryTotals = Object.fromEntries(
    (summary?.byCategory || []).map((item) => [`${item.type}:${item.category}`, item.total])
  );
  const budgetRows = ['Expense', 'Income']
    .flatMap((type) => Object.entries(settings.budgetTargets?.[type] || {}).map(([category, target]) => {
      const actual = categoryTotals[`${type}:${category}`] ?? 0;
      const progressPercent = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
      const difference = type === 'Expense' ? target - actual : actual - target;

      return {
        type,
        category,
        target,
        actual,
        progressPercent,
        difference,
        statusLabel: type === 'Expense'
          ? difference >= 0
            ? `${formatCurrency(difference)} left`
            : `${formatCurrency(Math.abs(difference))} over`
          : difference >= 0
            ? `${formatCurrency(difference)} above goal`
            : `${formatCurrency(Math.abs(difference))} to goal`,
      };
    }))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.category.localeCompare(b.category);
    });

  async function saveStartingBalance() {
    if (!Number.isFinite(parsedStartingBalance)) {
      setStartingBalanceInput(String(balance.startingBalance ?? 0));
      setBalanceError('');
      return;
    }

    if (Math.abs(parsedStartingBalance - (balance.startingBalance ?? 0)) < 0.005) {
      return;
    }

    setIsSavingBalance(true);
    setBalanceError('');
    try {
      const updated = await api.updateDashboardBalance(year, month, {
        startingBalance: parsedStartingBalance,
      });
      await mutateBalance(updated, false);
    } catch (err) {
      setBalanceError(err.message || 'Failed to save balance');
      setStartingBalanceInput(String(balance.startingBalance ?? 0));
    } finally {
      setIsSavingBalance(false);
    }
  }

  async function saveReconciliation() {
    if (!hasReconciledEnding) {
      setReconciliationError('Enter the actual ending balance before saving reconciliation');
      return;
    }

    const noteUnchanged = normalizedReconciliationNotes === (balance.reconciliationNotes ?? null);
    const endingUnchanged = balance.actualEndingBalance !== null
      && Math.abs(parsedReconciledEnding - balance.actualEndingBalance) < 0.005;

    if (endingUnchanged && noteUnchanged) {
      return;
    }

    setIsSavingReconciliation(true);
    setReconciliationError('');
    try {
      const updated = await api.updateDashboardReconciliation(year, month, {
        actualEndingBalance: parsedReconciledEnding,
        reconciliationNotes: normalizedReconciliationNotes,
      });
      await mutateBalance(updated, false);
    } catch (err) {
      setReconciliationError(err.message || 'Failed to save reconciliation');
    } finally {
      setIsSavingReconciliation(false);
    }
  }

  function handleSaved() {
    mutateSummary();
    mutateTransactions();
    mutateBalance();
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400">{getMonthName(month, year)}</p>
          <div className="mt-2">
            <AutoRefreshIndicator
              intervalSeconds={refreshIntervalSeconds}
              isRefreshing={refreshStatus.isRefreshing}
              lastRefreshedAt={refreshStatus.lastRefreshedAt}
            />
          </div>
        </div>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="text-lg">+</span> Quick Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard label="Total Income" value={summary?.income ?? 0} color="green" />
        <SummaryCard label="Total Expenses" value={summary?.expenses ?? 0} color="red" />
        <SummaryCard
          label="Net Budget"
          value={summary?.net ?? 0}
          color={(summary?.net ?? 0) >= 0 ? 'green' : 'red'}
          showSign
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6 space-y-3">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Starting Balance</p>
            <input
              type="number"
              step="0.01"
              value={startingBalanceInput}
              onChange={(e) => setStartingBalanceInput(e.target.value)}
              onBlur={saveStartingBalance}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveStartingBalance();
                }
              }}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Projected ending balance:{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {endingBalance !== null ? formatCurrency(endingBalance) : 'Enter a starting balance'}
            </span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {balance.source === 'carryover'
              ? 'This month started from last month\'s ending balance.'
              : balance.source === 'saved'
                ? 'Saved for this month across devices.'
                : balance.source === 'archive'
                  ? 'Loaded from this archived month\'s saved balance.'
                  : 'Set this to begin monthly carry-over.'}
          </p>
          {isSavingBalance && <p className="text-xs text-blue-600">Saving balance…</p>}
          {balanceError && <p className="text-xs text-red-500">{balanceError}</p>}
          <div className="border-t border-gray-200 pt-3 dark:border-gray-700 space-y-2">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reconciled Ending Balance</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {balance.reconciledAt
                  ? `Reconciled ${new Date(balance.reconciledAt).toLocaleString()}`
                  : 'Save the actual end-of-month balance when you verify it.'}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={reconciledEndingInput}
                onChange={(e) => setReconciledEndingInput(e.target.value)}
                onBlur={saveReconciliation}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveReconciliation();
                  }
                }}
                placeholder="Actual month end"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                type="button"
                onClick={saveReconciliation}
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
                rows={3}
                placeholder="Optional note about any variance or manual adjustments"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Variance:{' '}
              <span className={`font-semibold ${
                reconciliationVariance === null || Math.abs(reconciliationVariance) < 0.005
                  ? 'text-gray-700 dark:text-gray-200'
                  : reconciliationVariance > 0
                    ? 'text-green-600'
                    : 'text-red-600'
              }`}>
                {reconciliationVariance === null ? 'Not reconciled' : formatCurrency(reconciliationVariance)}
              </span>
            </p>
            {balance.reconciliationNotes && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saved note: <span className="text-gray-700 dark:text-gray-200">{balance.reconciliationNotes}</span>
              </p>
            )}
            {isSavingReconciliation && <p className="text-xs text-blue-600">Saving reconciliation…</p>}
            {reconciliationError && <p className="text-xs text-red-500">{reconciliationError}</p>}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {summary?.byCategory?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Spending by Category</h3>
          <div className="space-y-2">
            {summary.byCategory.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{item.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.type === 'Income' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                  }`}>{item.type}</span>
                </div>
                <span className="font-mono text-gray-800 dark:text-gray-200">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Budget Targets</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly progress for saved category targets.</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Update targets from Settings.</p>
        </div>

        {budgetRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
            No budget targets configured yet.
          </div>
        ) : (
          <div className="space-y-3">
            {budgetRows.map((row) => {
              const statusClass = row.difference >= 0
                ? row.type === 'Expense'
                  ? 'text-blue-600'
                  : 'text-green-600'
                : 'text-red-600';
              const barClass = row.difference >= 0
                ? row.type === 'Expense'
                  ? 'bg-blue-500'
                  : 'bg-green-500'
                : 'bg-red-500';

              return (
                <div
                  key={`${row.type}-${row.category}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-gray-100">{row.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          row.type === 'Income'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        }`}>
                          {row.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {row.type === 'Expense' ? 'Spent' : 'Received'} {formatCurrency(row.actual)} of {formatCurrency(row.target)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`text-sm font-semibold ${statusClass}`}>{row.statusLabel}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Monthly target</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barClass}`}
                      style={{ width: `${row.progressPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent Transactions</h3>
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{tx.category}</span>
                  {tx.description && (
                    <span className="text-gray-400 text-sm ml-2">— {tx.description}</span>
                  )}
                  <span className="text-gray-400 text-xs ml-2">{formatDate(tx.date)}</span>
                </div>
                <span className={`font-mono font-medium ${
                  tx.type === 'Income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TransactionModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function SummaryCard({ label, value, color, showSign }) {
  const colorClasses = { green: 'text-green-600', red: 'text-red-600' };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>
        {showSign && value > 0 && '+'}{formatCurrency(value)}
      </p>
    </div>
  );
}
