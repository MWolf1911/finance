'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDebtTotal, useMonthlySummary, useTransactions } from '@/lib/hooks';
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
  const [startingBalance, setStartingBalance] = useState('');
  const [extraPayment, setExtraPayment] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem('finance.dashboard.startingBalance');
    if (saved) {
      setStartingBalance(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('finance.dashboard.startingBalance', startingBalance);
  }, [startingBalance]);

  if (totalLoading) return null;
  if (total === 0) return null;

  const parsedStartingBalance = parseFloat(startingBalance);
  const hasStartingBalance = Number.isFinite(parsedStartingBalance) && parsedStartingBalance > 0;
  const paidDown = hasStartingBalance ? Math.max(parsedStartingBalance - total, 0) : null;
  const progress = hasStartingBalance ? Math.min((paidDown / parsedStartingBalance) * 100, 100) : null;
  const monthlyGain = extraPayment;
  const estimatedMonths = extraPayment > 0 ? Math.ceil(total / extraPayment) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Debt payoff overview</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">Track the household payoff runway</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use your original debt total to see what you have paid down and how much remains.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <MiniMetric label="Current debt" value={formatCurrency(total)} accent="red" />
            <MiniMetric label="Estimated months @ extra payment" value={estimatedMonths ? `${estimatedMonths} mo` : '—'} accent="blue" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting balance</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="Enter original debt total"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This is only used for the dashboard calculation and does not change your actual debt records.</p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile label="Paid down" value={hasStartingBalance ? formatCurrency(paidDown) : '—'} tone="green" />
            <StatTile label="Remaining" value={formatCurrency(total)} tone="red" />
            <StatTile
              label="Progress"
              value={hasStartingBalance ? `${progress.toFixed(1)}%` : '—'}
              tone="slate"
            />
          </div>
        </div>

        {hasStartingBalance && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Payoff progress</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(paidDown)} of {formatCurrency(parsedStartingBalance)}</span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>0%</span>
              <span>{progress >= 50 ? 'Halfway there' : 'In progress'}</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Extra monthly payment</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">See how extra principal speeds up the payoff.</p>
              </div>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(monthlyGain)}/mo</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="25"
              value={extraPayment}
              onChange={(e) => setExtraPayment(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>$0</span>
              <span>$500</span>
              <span>$1,000</span>
              <span>$1,500</span>
              <span>$2,000</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-800 space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Quick snapshot</h4>
            <OverviewLine label="Current monthly debt total" value={formatCurrency(total)} />
            <OverviewLine label="Starting balance" value={hasStartingBalance ? formatCurrency(parsedStartingBalance) : 'Enter a value'} />
            <OverviewLine label="Already paid" value={hasStartingBalance ? formatCurrency(paidDown) : '—'} />
            <OverviewLine label="Projected months with extra payment" value={estimatedMonths ? `${estimatedMonths} month${estimatedMonths !== 1 ? 's' : ''}` : 'Set extra payment'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, accent }) {
  const accentClasses = {
    red: 'from-red-500 to-orange-500',
    blue: 'from-blue-500 to-cyan-500',
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className={`h-1.5 w-10 rounded-full bg-gradient-to-r ${accentClasses[accent] || accentClasses.blue} mb-3`} />
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function StatTile({ label, value, tone }) {
  const toneClasses = {
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    slate: 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
  };

  return (
    <div className={`rounded-2xl p-4 border border-gray-200 dark:border-gray-700 ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function OverviewLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">{value}</span>
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
