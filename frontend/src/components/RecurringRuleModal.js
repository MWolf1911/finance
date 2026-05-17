'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useCategories, useDebts } from '@/lib/hooks';
import { api } from '@/lib/api';
import { DEFAULT_CATEGORIES, formatDebtLabel, todayISO } from '@/lib/constants';

function getInitialFormState(template) {
  const isDebtPayment = template?.category === 'Debt Payment' || Boolean(template?.debt_id);

  return {
    type: isDebtPayment ? 'Expense' : template?.type === 'Income' ? 'Income' : 'Expense',
    category: isDebtPayment ? 'Debt Payment' : template?.category || '',
    amount: template?.amount?.toString() || '',
    description: template?.description || '',
    debtId: template?.debt_id || '',
    isDebtPayment,
    recurrence: template?.recurrence || 'monthly',
    dayOfMonth: template?.day_of_month?.toString() || '1',
    startDate: template?.start_date || todayISO(),
    endDate: template?.end_date || '',
  };
}

export default function RecurringRuleModal({ open, onClose, onSaved, template }) {
  const { categories } = useCategories();
  const { debts } = useDebts(true);
  const initialState = getInitialFormState(template);

  const [type, setType] = useState(initialState.type);
  const [category, setCategory] = useState(initialState.category);
  const [amount, setAmount] = useState(initialState.amount);
  const [description, setDescription] = useState(initialState.description);
  const [debtId, setDebtId] = useState(initialState.debtId);
  const [isDebtPayment, setIsDebtPayment] = useState(initialState.isDebtPayment);
  const [recurrence, setRecurrence] = useState(initialState.recurrence);
  const [dayOfMonth, setDayOfMonth] = useState(initialState.dayOfMonth);
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !template) {
      return;
    }

    const nextState = getInitialFormState(template);
    setType(nextState.type);
    setCategory(nextState.category);
    setAmount(nextState.amount);
    setDescription(nextState.description);
    setDebtId(nextState.debtId);
    setIsDebtPayment(nextState.isDebtPayment);
    setRecurrence(nextState.recurrence);
    setDayOfMonth(nextState.dayOfMonth);
    setStartDate(nextState.startDate);
    setEndDate(nextState.endDate);
    setError('');
    setLoading(false);
  }, [open, template]);

  if (!template) {
    return null;
  }

  const availableCategories = categories[type]?.length ? categories[type] : DEFAULT_CATEGORIES[type];
  const selectedDebt = isDebtPayment ? debts.find((debt) => debt.id === debtId) : null;
  const normalizedType = isDebtPayment ? 'Expense' : type;
  const normalizedCategory = isDebtPayment ? 'Debt Payment' : category;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (!normalizedCategory) {
      setError('Select a category');
      return;
    }

    if (isDebtPayment && !debtId) {
      setError('Select which debt this rule should pay');
      return;
    }

    let parsedDayOfMonth = null;
    if (recurrence === 'monthly') {
      parsedDayOfMonth = parseInt(dayOfMonth, 10);
      if (!parsedDayOfMonth || parsedDayOfMonth < 1 || parsedDayOfMonth > 31) {
        setError('Day must be between 1 and 31');
        return;
      }
    } else if (!startDate) {
      setError('Start date is required for weekly and bi-weekly rules');
      return;
    }

    if (endDate && recurrence !== 'monthly' && endDate < startDate) {
      setError('End date must be on or after the start date');
      return;
    }

    setLoading(true);
    try {
      await api.updateTemplate(template.id, {
        type: normalizedType,
        category: normalizedCategory,
        amount: parsedAmount,
        description: description.trim() || null,
        debtId: isDebtPayment ? debtId : null,
        recurrence,
        dayOfMonth: recurrence === 'monthly' ? parsedDayOfMonth : null,
        startDate: recurrence === 'monthly' ? null : startDate,
        endDate: endDate || null,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to update recurring rule');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Recurring Rule">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
          {['Expense', 'Income'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setType(value);
                if (value === 'Income') {
                  setIsDebtPayment(false);
                  setDebtId('');
                  setCategory('');
                  return;
                }

                if (isDebtPayment) {
                  setCategory('Debt Payment');
                  return;
                }

                setCategory('');
              }}
              disabled={isDebtPayment && value === 'Income'}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                type === value
                  ? value === 'Expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-gray-700'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {!isDebtPayment ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Select category…</option>
              {availableCategories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            This recurring rule will be logged as a debt payment.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            placeholder="e.g. First paycheck"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDebtPayment}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsDebtPayment(checked);
              setError('');

              if (checked) {
                setType('Expense');
                setCategory('Debt Payment');
                return;
              }

              setDebtId('');
              setCategory('');
            }}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Apply this recurring rule to a debt</span>
        </label>

        {isDebtPayment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Which Debt?</label>
            <select
              value={debtId}
              onChange={(e) => setDebtId(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Select a debt…</option>
              {debts.map((debt) => (
                <option key={debt.id} value={debt.id}>
                  {formatDebtLabel(debt)} — ${debt.current_balance.toFixed(2)} remaining{debt.archived_at ? ' (archived)' : ''}
                </option>
              ))}
            </select>
            {selectedDebt && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Rule will apply payments to {formatDebtLabel(selectedDebt)}.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
          <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
            {[['monthly', 'Monthly'], ['biweekly', 'Bi-Weekly'], ['weekly', 'Weekly']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRecurrence(value)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  recurrence === value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recurrence === 'monthly' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? 'Saving…' : 'Update Rule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}