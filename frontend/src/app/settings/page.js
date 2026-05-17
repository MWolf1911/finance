'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useAppSettings, useCategories } from '@/lib/hooks';
import { api } from '@/lib/api';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

const DEFAULT_APP_SETTINGS = {
  transactionDefaults: {
    defaultType: 'Expense',
    defaultDateBehavior: 'today',
    requireDescription: false,
    confirmBeforeDelete: true,
  },
  debt: {
    autoArchivePaidOff: true,
  },
  archivePrint: {
    mode: 'detailed',
    includeDescriptions: true,
  },
};

export default function SettingsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { categories, isLoading: categoriesLoading, mutate: mutateCategories } = useCategories();
  const { settings, isLoading: settingsLoading, mutate: mutateSettings } = useAppSettings();

  const [categoryDraft, setCategoryDraft] = useState(DEFAULT_CATEGORIES);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_APP_SETTINGS);
  const [newExpense, setNewExpense] = useState('');
  const [newIncome, setNewIncome] = useState('');
  const [editing, setEditing] = useState({ type: null, index: -1, value: '' });
  const [savingCategories, setSavingCategories] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categoriesLoading) {
      setCategoryDraft({
        Expense: categories.Expense?.length ? categories.Expense : DEFAULT_CATEGORIES.Expense,
        Income: categories.Income?.length ? categories.Income : DEFAULT_CATEGORIES.Income,
      });
    }
  }, [categories, categoriesLoading]);

  useEffect(() => {
    if (!settingsLoading) {
      setSettingsDraft({
        transactionDefaults: {
          defaultType: settings.transactionDefaults?.defaultType || 'Expense',
          defaultDateBehavior: settings.transactionDefaults?.defaultDateBehavior || 'today',
          requireDescription: Boolean(settings.transactionDefaults?.requireDescription),
          confirmBeforeDelete: settings.transactionDefaults?.confirmBeforeDelete !== false,
        },
        debt: {
          autoArchivePaidOff: settings.debt?.autoArchivePaidOff !== false,
        },
        archivePrint: {
          mode: settings.archivePrint?.mode === 'compact' ? 'compact' : 'detailed',
          includeDescriptions: settings.archivePrint?.includeDescriptions !== false,
        },
      });
    }
  }, [settings, settingsLoading]);

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!currentUser) return <div className="text-center py-20 text-gray-400">Unable to load household data.</div>;

  async function persistCategories(nextDraft) {
    setSavingCategories(true);
    setError('');
    try {
      await api.updateCategories(nextDraft);
      await mutateCategories();
    } catch (err) {
      setError(err.message || 'Failed to save category changes');
    } finally {
      setSavingCategories(false);
    }
  }

  async function persistSettings(nextSettings) {
    setSavingSettings(true);
    setError('');
    try {
      await api.updateSettings(nextSettings);
      await mutateSettings();
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  function updateSettingsDraft(nextPartial) {
    const next = {
      transactionDefaults: {
        ...settingsDraft.transactionDefaults,
        ...(nextPartial.transactionDefaults || {}),
      },
      debt: {
        ...settingsDraft.debt,
        ...(nextPartial.debt || {}),
      },
      archivePrint: {
        ...settingsDraft.archivePrint,
        ...(nextPartial.archivePrint || {}),
      },
    };
    setSettingsDraft(next);
    persistSettings(next);
  }

  function addCategory(type) {
    const raw = type === 'Expense' ? newExpense : newIncome;
    const value = raw.trim();
    if (!value) {
      return;
    }

    const list = categoryDraft[type] || [];
    if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError(`${type} category already exists`);
      return;
    }

    const nextDraft = { ...categoryDraft, [type]: [...list, value] };
    setCategoryDraft(nextDraft);
    if (type === 'Expense') setNewExpense('');
    if (type === 'Income') setNewIncome('');
    persistCategories(nextDraft);
  }

  function deleteCategory(type, index) {
    const list = categoryDraft[type] || [];
    const nextDraft = { ...categoryDraft, [type]: list.filter((_, i) => i !== index) };
    setCategoryDraft(nextDraft);
    persistCategories(nextDraft);
  }

  function startEdit(type, index) {
    setEditing({ type, index, value: categoryDraft[type][index] });
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

    const list = categoryDraft[editing.type] || [];
    const duplicate = list.some((item, idx) => idx !== editing.index && item.toLowerCase() === value.toLowerCase());
    if (duplicate) {
      setError(`${editing.type} category already exists`);
      return;
    }

    const nextList = [...list];
    nextList[editing.index] = value;
    const nextDraft = { ...categoryDraft, [editing.type]: nextList };
    setCategoryDraft(nextDraft);
    cancelEdit();
    persistCategories(nextDraft);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Configure categories and behavior defaults.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-5 space-y-5">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Behavior</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default transaction type</label>
            <select
              value={settingsDraft.transactionDefaults.defaultType}
              onChange={(e) => updateSettingsDraft({ transactionDefaults: { defaultType: e.target.value } })}
              disabled={savingSettings}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default transaction date</label>
            <select
              value={settingsDraft.transactionDefaults.defaultDateBehavior}
              onChange={(e) => updateSettingsDraft({ transactionDefaults: { defaultDateBehavior: e.target.value } })}
              disabled={savingSettings}
              className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              <option value="today">Today</option>
              <option value="lastUsed">Last used date</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ToggleRow
            label="Require transaction description"
            checked={settingsDraft.transactionDefaults.requireDescription}
            disabled={savingSettings}
            onChange={(checked) => updateSettingsDraft({ transactionDefaults: { requireDescription: checked } })}
          />
          <ToggleRow
            label="Confirm before deleting"
            checked={settingsDraft.transactionDefaults.confirmBeforeDelete}
            disabled={savingSettings}
            onChange={(checked) => updateSettingsDraft({ transactionDefaults: { confirmBeforeDelete: checked } })}
          />
          <ToggleRow
            label="Auto-archive paid-off debts"
            checked={settingsDraft.debt.autoArchivePaidOff}
            disabled={savingSettings}
            onChange={(checked) => updateSettingsDraft({ debt: { autoArchivePaidOff: checked } })}
          />
          <ToggleRow
            label="Include descriptions in archive print"
            checked={settingsDraft.archivePrint.includeDescriptions}
            disabled={savingSettings}
            onChange={(checked) => updateSettingsDraft({ archivePrint: { includeDescriptions: checked } })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Archive print mode</label>
          <select
            value={settingsDraft.archivePrint.mode}
            onChange={(e) => updateSettingsDraft({ archivePrint: { mode: e.target.value } })}
            disabled={savingSettings}
            className="w-full max-w-sm px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            <option value="detailed">Detailed</option>
            <option value="compact">Compact</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CategoryCard
          title="Expense Categories"
          type="Expense"
          categories={categoryDraft.Expense || []}
          newValue={newExpense}
          setNewValue={setNewExpense}
          onAdd={() => addCategory('Expense')}
          onDelete={(index) => deleteCategory('Expense', index)}
          onStartEdit={(index) => startEdit('Expense', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={savingCategories}
        />

        <CategoryCard
          title="Income Categories"
          type="Income"
          categories={categoryDraft.Income || []}
          newValue={newIncome}
          setNewValue={setNewIncome}
          onAdd={() => addCategory('Income')}
          onDelete={(index) => deleteCategory('Income', index)}
          onStartEdit={(index) => startEdit('Income', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={savingCategories}
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

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center justify-between rounded-lg border dark:border-gray-700 px-3 py-2.5">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
      />
    </label>
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
