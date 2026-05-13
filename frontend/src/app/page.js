'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useMonthlySummary, useTransactions, useDebtTotal, useDebtProjection } from '@/lib/hooks';
import { formatCurrency, getCurrentMonth, getMonthName, formatDate } from '@/lib/constants';
import TransactionModal from '@/components/TransactionModal';

export default function DashboardPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { month, year } = getCurrentMonth();
  const { summary, mutate: mutateSummary } = useMonthlySummary(month, year);
  const { transactions, mutate: mutateTransactions } = useTransactions(month, year);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  const recentTransactions = transactions.slice(0, 5);

  function handleSaved() {
    mutateSummary();
    mutateTransactions();
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400">{getMonthName(month, year)}</p>
        </div>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="text-lg">+</span> Quick Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Income" value={summary?.income ?? 0} color="green" />
        <SummaryCard label="Total Expenses" value={summary?.expenses ?? 0} color="red" />
        <SummaryCard
          label="Net Budget"
          value={summary?.net ?? 0}
          color={(summary?.net ?? 0) >= 0 ? 'green' : 'red'}
          showSign
        />
      </div>

      {/* Debt Overview Section */}
      <DebtOverview />

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

function DebtOverview() {
  const { total, isLoading: totalLoading } = useDebtTotal();
  const [extraPayment, setExtraPayment] = useState(0);
  const { projection, isLoading: projLoading } = useDebtProjection(extraPayment);

  if (totalLoading) return null;
  if (total === 0) return null;

  const snowball = projection?.snowball;
  const avalanche = projection?.avalanche;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">Debt Payoff Overview</h3>
        <span className="text-xl font-bold text-red-600">{formatCurrency(total)}</span>
      </div>

      {/* Extra Payment Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Extra Monthly Payment</label>
          <span className="text-sm font-bold text-blue-600">{formatCurrency(extraPayment)}/mo</span>
        </div>
        <input
          type="range"
          min="0"
          max="2000"
          step="25"
          value={extraPayment}
          onChange={(e) => setExtraPayment(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>$0</span>
          <span>$500</span>
          <span>$1,000</span>
          <span>$1,500</span>
          <span>$2,000</span>
        </div>
      </div>

      {/* Strategy Comparison */}
      {projLoading ? (
        <div className="text-center py-4 text-sm text-gray-400">Calculating projections…</div>
      ) : snowball && avalanche ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StrategyCard
            name="Avalanche"
            subtitle="Highest interest first"
            months={avalanche.totalMonths}
            interest={avalanche.totalInterest}
            highlight={avalanche.totalInterest <= snowball.totalInterest}
          />
          <StrategyCard
            name="Snowball"
            subtitle="Smallest balance first"
            months={snowball.totalMonths}
            interest={snowball.totalInterest}
            highlight={snowball.totalInterest < avalanche.totalInterest}
          />
        </div>
      ) : null}

      {/* Savings callout */}
      {snowball && avalanche && Math.abs(avalanche.totalInterest - snowball.totalInterest) >= 1 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
          <strong>Avalanche saves you {formatCurrency(snowball.totalInterest - avalanche.totalInterest)}</strong> in interest
          {avalanche.totalMonths < snowball.totalMonths &&
            ` and pays off ${snowball.totalMonths - avalanche.totalMonths} month${snowball.totalMonths - avalanche.totalMonths !== 1 ? 's' : ''} sooner`
          }!
        </div>
      )}
    </div>
  );
}

function StrategyCard({ name, subtitle, months, interest, highlight }) {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const timeStr = years > 0
    ? `${years}y ${remainingMonths}mo`
    : `${remainingMonths}mo`;

  return (
    <div className={`rounded-lg p-4 border-2 ${highlight ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        {highlight && <span className="text-green-500 text-sm">★</span>}
        <h4 className="font-semibold text-gray-800 dark:text-gray-100">{name}</h4>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{subtitle}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Time to payoff</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{timeStr}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total interest</span>
          <span className="font-semibold text-red-600">{formatCurrency(interest)}</span>
        </div>
      </div>
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
