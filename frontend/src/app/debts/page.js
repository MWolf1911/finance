'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useDebts, useDebtTotal, useMonthlySummary, useTransactions } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonth, todayISO } from '@/lib/constants';
import Modal from '@/components/Modal';
import TransactionModal from '@/components/TransactionModal';

export default function DebtsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { debts, isLoading, mutate } = useDebts();
  const { total, mutate: mutateTotal } = useDebtTotal();
  const { month, year } = getCurrentMonth();
  const { mutate: mutateSummary } = useMonthlySummary(month, year);
  const { mutate: mutateTransactions } = useTransactions(month, year);

  const [addOpen, setAddOpen] = useState(false);
  const [editDebt, setEditDebt] = useState(null);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const sortedDebts = useMemo(() => {
    return [...debts].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'balance': cmp = a.current_balance - b.current_balance; break;
        case 'rate': cmp = (a.interest_rate || 0) - (b.interest_rate || 0); break;
        case 'payment': cmp = (a.minimum_payment || 0) - (b.minimum_payment || 0); break;
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [debts, sortKey, sortDir]);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  function refreshAll() {
    mutate();
    mutateTotal();
    mutateSummary();
    mutateTransactions();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this debt account?')) return;
    await api.deleteDebt(id);
    refreshAll();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Debt Tracker</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Total outstanding: <span className="font-semibold text-red-600">{formatCurrency(total)}</span>
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="text-lg">+</span> Add Debt
        </button>
      </div>

      {/* Debt cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading debts…</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          No debts tracked yet. Add one above!
        </div>
      ) : (
        <>
          {/* Sort controls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-3 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Sort by:</span>
            {[['name', 'Name'], ['balance', 'Balance'], ['rate', 'Rate'], ['payment', 'Min Payment']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  else { setSortKey(key); setSortDir('asc'); }
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  sortKey === key
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {label}
                {sortKey === key && (
                  <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedDebts.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => setEditDebt(debt)}
                onDelete={() => handleDelete(debt.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Add Debt Modal */}
      <AddDebtModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refreshAll}
      />

      {/* Edit Debt Modal */}
      {editDebt && (
        <EditDebtModal
          debt={editDebt}
          onClose={() => setEditDebt(null)}
          onSaved={refreshAll}
        />
      )}

    </div>
  );
}

function DebtCard({ debt, onEdit, onDelete }) {
  const paid = debt.starting_balance - debt.current_balance;
  const percent = debt.starting_balance > 0 ? (paid / debt.starting_balance) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">{debt.name}</h3>
          <div className="flex gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {debt.interest_rate > 0 && <span>{debt.interest_rate}% APR</span>}
            {debt.minimum_payment > 0 && <span>Min: {formatCurrency(debt.minimum_payment)}/mo</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="text-gray-300 hover:text-blue-500 transition-colors"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">
            Paid: <span className="font-medium text-green-600">{formatCurrency(paid)}</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            Remaining: <span className="font-medium text-red-600">{formatCurrency(debt.current_balance)}</span>
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{percent.toFixed(1)}% paid</span>
          <span>of {formatCurrency(debt.starting_balance)}</span>
        </div>
      </div>
    </div>
  );
}

function AddDebtModal({ open, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const sb = parseFloat(startingBalance);
    if (!name || !sb || sb <= 0) {
      setError('Name and starting balance are required');
      return;
    }
    setLoading(true);
    try {
      await api.createDebt({
        name,
        startingBalance: sb,
        currentBalance: parseFloat(currentBalance) || sb,
        interestRate: parseFloat(interestRate) || 0,
        minimumPayment: parseFloat(minimumPayment) || 0,
      });
      onSaved?.();
      setName(''); setStartingBalance(''); setCurrentBalance('');
      setInterestRate(''); setMinimumPayment('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Debt Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            placeholder="e.g. Chase Credit Card" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting Balance</label>
            <input type="number" step="0.01" min="0" value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              placeholder="10000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Balance</label>
            <input type="number" step="0.01" min="0" value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              placeholder="Same as starting" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest Rate (%)</label>
            <input type="number" step="0.01" min="0" value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              placeholder="18.9" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Payment/mo</label>
            <input type="number" step="0.01" min="0" value={minimumPayment}
              onChange={(e) => setMinimumPayment(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              placeholder="150" />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
            {loading ? 'Saving…' : 'Add Debt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDebtModal({ debt, onClose, onSaved }) {
  const [name, setName] = useState(debt.name);
  const [currentBalance, setCurrentBalance] = useState(String(debt.current_balance));
  const [interestRate, setInterestRate] = useState(String(debt.interest_rate || ''));
  const [minimumPayment, setMinimumPayment] = useState(String(debt.minimum_payment || ''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const newBalance = parseFloat(currentBalance);
    if (!name) { setError('Name is required'); return; }
    if (isNaN(newBalance) || newBalance < 0) { setError('Valid balance is required'); return; }

    setLoading(true);
    try {
      const balanceDiff = newBalance - debt.current_balance;

      await api.updateDebt(debt.id, {
        name,
        currentBalance: newBalance,
        interestRate: parseFloat(interestRate) || 0,
        minimumPayment: parseFloat(minimumPayment) || 0,
      });

      // Auto-log balance adjustment as a transaction if balance changed
      if (Math.abs(balanceDiff) >= 0.01) {
        await api.createTransaction({
          type: balanceDiff > 0 ? 'Expense' : 'Income',
          category: 'Balance Adjustment',
          amount: Math.abs(balanceDiff),
          date: todayISO(),
          description: `${debt.name}: balance ${balanceDiff > 0 ? 'increased' : 'decreased'} by ${formatCurrency(Math.abs(balanceDiff))}`,
        });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Edit: ${debt.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Balance ($)</label>
          <input type="number" step="0.01" min="0" value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
          {Math.abs(parseFloat(currentBalance || 0) - debt.current_balance) >= 0.01 && (
            <p className="text-xs text-amber-600 mt-1">
              Balance change will be auto-logged as a &quot;Balance Adjustment&quot; transaction
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest Rate (%)</label>
            <input type="number" step="0.01" min="0" value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Payment/mo</label>
            <input type="number" step="0.01" min="0" value={minimumPayment}
              onChange={(e) => setMinimumPayment(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}


