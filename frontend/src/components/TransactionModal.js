'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useDebts } from '@/lib/hooks';
import { api } from '@/lib/api';
import { CATEGORIES, todayISO } from '@/lib/constants';

function getInitialFormState(editData) {
  const isDebtPayment = editData?.category === 'Debt Payment' || Boolean(editData?.debt_id);

  return {
    type: isDebtPayment ? 'Expense' : editData?.type || 'Expense',
    category: isDebtPayment ? 'Debt Payment' : editData?.category || '',
    amount: editData?.amount?.toString() || '',
    date: editData?.date || todayISO(),
    description: editData?.description || '',
    debtId: editData?.debt_id || '',
    isDebtPayment,
    isRecurring: false,
    recurrence: 'monthly',
    dayOfMonth: '1',
    startDate: '',
    endDate: '',
  };
}

export default function TransactionModal({ open, onClose, onSaved, editData }) {
  const { debts } = useDebts();
  const isEdit = !!editData;
  const initialState = getInitialFormState(editData);

  const [type, setType] = useState(initialState.type);
  const [category, setCategory] = useState(initialState.category);
  const [amount, setAmount] = useState(initialState.amount);
  const [date, setDate] = useState(initialState.date);
  const [description, setDescription] = useState(initialState.description);
  const [debtId, setDebtId] = useState(initialState.debtId);
  const [isDebtPayment, setIsDebtPayment] = useState(initialState.isDebtPayment);
  const [isRecurring, setIsRecurring] = useState(initialState.isRecurring);
  const [recurrence, setRecurrence] = useState(initialState.recurrence);
  const [dayOfMonth, setDayOfMonth] = useState(initialState.dayOfMonth);
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextState = getInitialFormState(editData);
    setType(nextState.type);
    setCategory(nextState.category);
    setAmount(nextState.amount);
    setDate(nextState.date);
    setDescription(nextState.description);
    setDebtId(nextState.debtId);
    setIsDebtPayment(nextState.isDebtPayment);
    setIsRecurring(nextState.isRecurring);
    setRecurrence(nextState.recurrence);
    setDayOfMonth(nextState.dayOfMonth);
    setStartDate(nextState.startDate);
    setEndDate(nextState.endDate);
    setError('');
    setLoading(false);
  }, [open, editData]);

  const selectedDebt = isDebtPayment ? debts.find(d => d.id === debtId) : null;
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
      setError('Select which debt to pay');
      return;
    }
    if (isDebtPayment && selectedDebt && parsedAmount > selectedDebt.current_balance) {
      setError(`Payment exceeds remaining balance (${selectedDebt.current_balance.toFixed(2)})`);
      return;
    }

    if (isRecurring) {
      if (recurrence === 'monthly') {
        const parsedDay = parseInt(dayOfMonth, 10);
        if (!parsedDay || parsedDay < 1 || parsedDay > 31) { setError('Day must be 1-31'); return; }
      } else {
        if (!startDate) { setError('Start date is required for weekly/bi-weekly'); return; }
      }
      if (endDate && startDate && endDate < startDate) {
        setError('End date must be on or after start date');
        return;
      }
    }

    setLoading(true);
    try {
      if (isEdit) {
        await api.updateTransaction(editData.id, {
          type: normalizedType,
          category: normalizedCategory,
          amount: parsedAmount,
          date,
          description,
          debtId: isDebtPayment ? debtId : null,
        });
      } else {
        const payload = {
          type: normalizedType,
          category: normalizedCategory,
          amount: parsedAmount,
          date,
          description: description || (isDebtPayment && selectedDebt ? `Payment → ${selectedDebt.name}` : ''),
          isRecurring,
          debtId: isDebtPayment ? debtId : null,
        };
        if (isRecurring) {
          payload.recurrence = recurrence;
          payload.dayOfMonth = recurrence === 'monthly' ? parseInt(dayOfMonth, 10) : null;
          payload.startDate = recurrence !== 'monthly' ? startDate : null;
          payload.endDate = endDate || null;
        }
        await api.createTransaction(payload);
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Transaction' : 'Add Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
          {['Expense', 'Income'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                if (t === 'Income') {
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
              disabled={isDebtPayment && t === 'Income'}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                type === t
                  ? t === 'Expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Category */}
        {!isDebtPayment ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Select category…</option>
              {CATEGORIES[type].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            This transaction will be logged as a debt payment.
          </div>
        )}

        {/* Amount */}
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

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            placeholder="e.g. Weekly grocery run"
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Apply this transaction to a debt</span>
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
              {debts.filter(d => d.current_balance > 0).map((d) => (
                <option key={d.id} value={d.id}>{d.name} — ${d.current_balance.toFixed(2)} remaining</option>
              ))}
            </select>
          </div>
        )}

        {/* Recurring toggle — only on create */}
        {!isEdit && (
          <>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Make this recurring</span>
            </label>

            {isRecurring && (
              <div className="space-y-3 pl-1 border-l-2 border-blue-400 ml-2">
                {/* Recurrence selector */}
                <div className="pl-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                  <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
                    {[['monthly', 'Monthly'], ['biweekly', 'Bi-Weekly'], ['weekly', 'Weekly']].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setRecurrence(val)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          recurrence === val
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pl-3 grid grid-cols-2 gap-3">
                  {recurrence === 'monthly' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Month</label>
                      <input type="number" min="1" max="31" value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(e.target.value)}
                        className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input type="date" value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
                    <input type="date" value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

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
            {loading ? 'Saving…' : isEdit ? 'Update' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
