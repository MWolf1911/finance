'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCategories } from '@/lib/hooks';
import { api } from '@/lib/api';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export default function SettingsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { categories, isLoading, mutate } = useCategories();
  const [draft, setDraft] = useState(DEFAULT_CATEGORIES);
  const [newExpense, setNewExpense] = useState('');
  const [newIncome, setNewIncome] = useState('');
  const [editing, setEditing] = useState({ type: null, index: -1, value: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setDraft({
        Expense: categories.Expense?.length ? categories.Expense : DEFAULT_CATEGORIES.Expense,
        Income: categories.Income?.length ? categories.Income : DEFAULT_CATEGORIES.Income,
      });
    }
  }, [categories, isLoading]);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  async function persist(nextDraft) {
    setSaving(true);
    setError('');
    try {
      await api.updateCategories(nextDraft);
      await mutate();
    } catch (err) {
      setError(err.message || 'Failed to save category changes');
    } finally {
      setSaving(false);
    }
  }

  function addCategory(type) {
    const raw = type === 'Expense' ? newExpense : newIncome;
    const value = raw.trim();
    if (!value) {
      return;
    }

    const list = draft[type] || [];
    if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError(`${type} category already exists`);
      return;
    }

    const nextDraft = { ...draft, [type]: [...list, value] };
    setDraft(nextDraft);
    if (type === 'Expense') setNewExpense('');
    if (type === 'Income') setNewIncome('');
    persist(nextDraft);
  }

  function deleteCategory(type, index) {
    const list = draft[type] || [];
    const nextDraft = { ...draft, [type]: list.filter((_, i) => i !== index) };
    setDraft(nextDraft);
    persist(nextDraft);
  }

  function startEdit(type, index) {
    setEditing({ type, index, value: draft[type][index] });
  }

  function cancelEdit() {
    setEditing({ type: null, index: -1, value: '' });
  }

  function saveEdit() {
    if (!editing.type || editing.index < 0) {
      return;
    }

    const value = editing.value.trim();
    if (!value) {
      setError('Category name cannot be empty');
      return;
    }

    const list = draft[editing.type] || [];
    const duplicate = list.some((item, idx) => idx !== editing.index && item.toLowerCase() === value.toLowerCase());
    if (duplicate) {
      setError(`${editing.type} category already exists`);
      return;
    }

    const nextList = [...list];
    nextList[editing.index] = value;
    const nextDraft = { ...draft, [editing.type]: nextList };
    setDraft(nextDraft);
    cancelEdit();
    persist(nextDraft);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Customize categories used in transaction forms.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CategoryCard
          title="Expense Categories"
          type="Expense"
          categories={draft.Expense || []}
          newValue={newExpense}
          setNewValue={setNewExpense}
          onAdd={() => addCategory('Expense')}
          onDelete={(index) => deleteCategory('Expense', index)}
          onStartEdit={(index) => startEdit('Expense', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={saving}
        />

        <CategoryCard
          title="Income Categories"
          type="Income"
          categories={draft.Income || []}
          newValue={newIncome}
          setNewValue={setNewIncome}
          onAdd={() => addCategory('Income')}
          onDelete={(index) => deleteCategory('Income', index)}
          onStartEdit={(index) => startEdit('Income', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={saving}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  title,
  type,
  categories,
  newValue,
  setNewValue,
  onAdd,
  onDelete,
  onStartEdit,
  editing,
  setEditing,
  onSaveEdit,
  onCancelEdit,
  saving,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder={`Add new ${type.toLowerCase()} category`}
            className="flex-1 px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
          />
          <button
            onClick={onAdd}
            disabled={saving}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400">No categories configured.</p>
          ) : (
            categories.map((category, index) => {
              const isEditing = editing.type === type && editing.index === index;

              return (
                <div
                  key={`${type}-${category}-${index}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700"
                >
                  {isEditing ? (
                    <input
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      className="flex-1 px-2 py-1.5 border dark:border-gray-600 rounded focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{category}</span>
                  )}

                  {isEditing ? (
                    <>
                      <button
                        onClick={onSaveEdit}
                        disabled={saving}
                        className="text-xs px-2.5 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={onCancelEdit}
                        disabled={saving}
                        className="text-xs px-2.5 py-1.5 rounded border dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onStartEdit(index)}
                        disabled={saving}
                        className="text-xs px-2.5 py-1.5 rounded border dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(index)}
                        disabled={saving}
                        className="text-xs px-2.5 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
