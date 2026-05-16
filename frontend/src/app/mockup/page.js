'use client';

import { formatCurrency } from '@/lib/constants';

const MOCK = {
  currentDebt: 14872.44,
  startingBalance: 26850,
  extraPayment: 425,
  debts: [
    { name: 'Chase Freedom', current: 4120.18, min: 95, apr: 24.99 },
    { name: 'Car Loan', current: 7584.22, min: 310, apr: 6.49 },
    { name: 'CareCredit', current: 3168.04, min: 74, apr: 0 },
  ],
};

export default function MockupPage() {
  const paidDown = MOCK.startingBalance - MOCK.currentDebt;
  const progress = (paidDown / MOCK.startingBalance) * 100;
  const estimatedMonths = Math.ceil(MOCK.currentDebt / MOCK.extraPayment);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Preview route</p>
        <h2 className="mt-1 text-2xl font-bold">Debt dashboard mockup</h2>
        <p className="mt-2 text-sm opacity-80">
          This page uses sample data only. It is for layout review before you push changes.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Debt payoff overview</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">Track the household payoff runway</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">A cleaner snapshot of where you started, where you are now, and how extra principal changes the pace.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <MiniMetric label="Current debt" value={formatCurrency(MOCK.currentDebt)} accent="red" />
              <MiniMetric label="Estimated months @ extra payment" value={`${estimatedMonths} mo`} accent="blue" />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting balance</label>
              <input
                type="number"
                value={MOCK.startingBalance}
                readOnly
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This mockup shows the original debt total as a dedicated dashboard input.</p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile label="Paid down" value={formatCurrency(paidDown)} tone="green" />
              <StatTile label="Remaining" value={formatCurrency(MOCK.currentDebt)} tone="red" />
              <StatTile label="Progress" value={`${progress.toFixed(1)}%`} tone="slate" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Payoff progress</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(paidDown)} of {formatCurrency(MOCK.startingBalance)}</span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-blue-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>0%</span>
              <span>Halfway there</span>
              <span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Extra monthly payment</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">The mockup keeps one simple control instead of the older strategy comparison cards.</p>
                </div>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(MOCK.extraPayment)}/mo</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="25"
                value={MOCK.extraPayment}
                readOnly
                className="w-full h-2 rounded-lg appearance-none cursor-default accent-blue-600"
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
              <OverviewLine label="Current debt" value={formatCurrency(MOCK.currentDebt)} />
              <OverviewLine label="Starting balance" value={formatCurrency(MOCK.startingBalance)} />
              <OverviewLine label="Already paid" value={formatCurrency(paidDown)} />
              <OverviewLine label="Projected months with extra payment" value={`${estimatedMonths} months`} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mock debt cards</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">No separate make-payment action. Payments would only come from the transaction modal.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {MOCK.debts.map((debt) => {
            const debtPaid = MOCK.startingBalance - MOCK.currentDebt;
            const debtProgress = Math.min(((debtPaid / MOCK.startingBalance) * 100) / 3, 100);

            return (
              <div key={debt.name} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-850 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{debt.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">APR {debt.apr}% · Min {formatCurrency(debt.min)}/mo</p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>✏️</span>
                    <span>🗑️</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                    <span className="font-semibold text-red-600">{formatCurrency(debt.current)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500" style={{ width: `${debtProgress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
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
      <div className={`h-1.5 w-10 rounded-full bg-gradient-to-r ${accentClasses[accent]} mb-3`} />
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
    <div className={`rounded-2xl p-4 border border-gray-200 dark:border-gray-700 ${toneClasses[tone]}`}>
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