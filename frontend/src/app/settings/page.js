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
  liveRefresh: {
    intervalSeconds: 10,
  },
  budgetTargets: {
    Expense: {},
    Income: {},
  },
};

function copyBudgetTargets(targets = DEFAULT_APP_SETTINGS.budgetTargets) {
  return {
    Expense: { ...((targets && targets.Expense) || {}) },
    Income: { ...((targets && targets.Income) || {}) },
  };
}

function normalizeBudgetTargets(targets = DEFAULT_APP_SETTINGS.budgetTargets) {
  const normalized = {
    Expense: {},
    Income: {},
  };

  for (const type of ['Expense', 'Income']) {
    for (const [rawCategory, rawValue] of Object.entries((targets && targets[type]) || {})) {
      const category = String(rawCategory || '').trim();
      const parsed = parseFloat(rawValue);
      if (!category || !Number.isFinite(parsed) || parsed <= 0) {
        continue;
      }

      normalized[type][category] = Number(parsed.toFixed(2));
    }
  }

  return normalized;
}

function toBudgetInputDrafts(targets = DEFAULT_APP_SETTINGS.budgetTargets) {
  const normalized = normalizeBudgetTargets(targets);
  return {
    Expense: Object.fromEntries(
      Object.entries(normalized.Expense).map(([category, value]) => [category, String(value)])
    ),
    Income: Object.fromEntries(
      Object.entries(normalized.Income).map(([category, value]) => [category, String(value)])
    ),
  };
}

export default function SettingsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { categories, isLoading: categoriesLoading, mutate: mutateCategories } = useCategories();
  const { settings, isLoading: settingsLoading, mutate: mutateSettings } = useAppSettings();

  const [categoryDraft, setCategoryDraft] = useState(DEFAULT_CATEGORIES);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_APP_SETTINGS);
  const [budgetDrafts, setBudgetDrafts] = useState(toBudgetInputDrafts());
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
      const normalizedBudgetTargets = normalizeBudgetTargets(settings.budgetTargets);
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
        liveRefresh: {
          intervalSeconds: [0, 5, 10, 30, 60].includes(settings.liveRefresh?.intervalSeconds)
            ? settings.liveRefresh.intervalSeconds
            : 10,
        },
        budgetTargets: normalizedBudgetTargets,
      });
      setBudgetDrafts(toBudgetInputDrafts(normalizedBudgetTargets));
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
      liveRefresh: {
        ...settingsDraft.liveRefresh,
        ...(nextPartial.liveRefresh || {}),
      },
      budgetTargets: normalizeBudgetTargets({
        ...copyBudgetTargets(settingsDraft.budgetTargets),
        ...(nextPartial.budgetTargets || {}),
        Expense: {
          ...(settingsDraft.budgetTargets?.Expense || {}),
          ...((nextPartial.budgetTargets && nextPartial.budgetTargets.Expense) || {}),
        },
        Income: {
          ...(settingsDraft.budgetTargets?.Income || {}),
          ...((nextPartial.budgetTargets && nextPartial.budgetTargets.Income) || {}),
        },
      }),
    };
    setSettingsDraft(next);
    persistSettings(next);
  }

  function updateBudgetDraft(type, category, value) {
    setBudgetDrafts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [category]: value,
      },
    }));
  }

  function saveBudgetTarget(type, category) {
    const rawValue = budgetDrafts[type]?.[category] ?? '';
    const parsed = parseFloat(rawValue);
    const normalizedValue = Number.isFinite(parsed) && parsed > 0
      ? Number(parsed.toFixed(2))
      : null;

    if ((settingsDraft.budgetTargets?.[type]?.[category] ?? null) === normalizedValue) {
      setBudgetDrafts((current) => ({
        ...current,
        [type]: {
          ...current[type],
          [category]: normalizedValue === null ? '' : String(normalizedValue),
        },
      }));
      return;
    }

    const nextBudgetTargets = copyBudgetTargets(settingsDraft.budgetTargets);
    if (normalizedValue === null) {
      delete nextBudgetTargets[type][category];
    } else {
      nextBudgetTargets[type][category] = normalizedValue;
    }

    const nextSettings = {
      ...settingsDraft,
      budgetTargets: normalizeBudgetTargets(nextBudgetTargets),
    };

    setSettingsDraft(nextSettings);
    setBudgetDrafts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [category]: normalizedValue === null ? '' : String(normalizedValue),
      },
    }));
    persistSettings(nextSettings);
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
    const removedCategory = list[index];
    const nextDraft = { ...categoryDraft, [type]: list.filter((_, i) => i !== index) };
    const nextBudgetTargets = copyBudgetTargets(settingsDraft.budgetTargets);
    const nextBudgetDrafts = {
      ...budgetDrafts,
      [type]: { ...budgetDrafts[type] },
    };

    delete nextBudgetTargets[type][removedCategory];
    delete nextBudgetDrafts[type][removedCategory];

    setCategoryDraft(nextDraft);
    setSettingsDraft({
      ...settingsDraft,
      budgetTargets: normalizeBudgetTargets(nextBudgetTargets),
    });
    setBudgetDrafts(nextBudgetDrafts);
    persistCategories(nextDraft);
    persistSettings({
      ...settingsDraft,
      budgetTargets: normalizeBudgetTargets(nextBudgetTargets),
    });
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

    const previousName = list[editing.index];
    const nextList = [...list];
    nextList[editing.index] = value;
    const nextDraft = { ...categoryDraft, [editing.type]: nextList };
    const nextBudgetTargets = copyBudgetTargets(settingsDraft.budgetTargets);
    const nextBudgetDrafts = {
      ...budgetDrafts,
      [editing.type]: { ...budgetDrafts[editing.type] },
    };

    if (previousName !== value) {
      const existingTarget = nextBudgetTargets[editing.type][previousName];
      const existingDraft = nextBudgetDrafts[editing.type][previousName];

      delete nextBudgetTargets[editing.type][previousName];
      delete nextBudgetDrafts[editing.type][previousName];

      if (existingTarget !== undefined) {
        nextBudgetTargets[editing.type][value] = existingTarget;
      }

      if (existingDraft !== undefined) {
        nextBudgetDrafts[editing.type][value] = existingDraft;
      }
    }

    const nextSettings = {
      ...settingsDraft,
      budgetTargets: normalizeBudgetTargets(nextBudgetTargets),
    };

    setCategoryDraft(nextDraft);
    setSettingsDraft(nextSettings);
    setBudgetDrafts(nextBudgetDrafts);
    cancelEdit();
    persistCategories(nextDraft);
    if (previousName !== value) {
      persistSettings(nextSettings);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Configure categories, monthly budget targets, and behavior defaults.</p>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-refresh interval</label>
          <select
            value={settingsDraft.liveRefresh.intervalSeconds}
            onChange={(e) => updateSettingsDraft({ liveRefresh: { intervalSeconds: parseInt(e.target.value, 10) } })}
            disabled={savingSettings}
            className="w-full max-w-sm px-3 py-2.5 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            <option value="0">Off</option>
            <option value="5">Every 5 seconds</option>
            <option value="10">Every 10 seconds</option>
            <option value="30">Every 30 seconds</option>
            <option value="60">Every minute</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Controls how often live pages check for changes made by another user.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CategoryCard
          title="Expense Categories"
          type="Expense"
          categories={categoryDraft.Expense || []}
          budgetDrafts={budgetDrafts.Expense || {}}
          newValue={newExpense}
          setNewValue={setNewExpense}
          onAdd={() => addCategory('Expense')}
          onBudgetChange={(category, value) => updateBudgetDraft('Expense', category, value)}
          onBudgetSave={(category) => saveBudgetTarget('Expense', category)}
          onDelete={(index) => deleteCategory('Expense', index)}
          onStartEdit={(index) => startEdit('Expense', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={savingCategories || savingSettings}
        />

        <CategoryCard
          title="Income Categories"
          type="Income"
          categories={categoryDraft.Income || []}
          budgetDrafts={budgetDrafts.Income || {}}
          newValue={newIncome}
          setNewValue={setNewIncome}
          onAdd={() => addCategory('Income')}
          onBudgetChange={(category, value) => updateBudgetDraft('Income', category, value)}
          onBudgetSave={(category) => saveBudgetTarget('Income', category)}
          onDelete={(index) => deleteCategory('Income', index)}
          onStartEdit={(index) => startEdit('Income', index)}
          editing={editing}
          setEditing={setEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={savingCategories || savingSettings}
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
  budgetDrafts,
  newValue,
  setNewValue,
  onAdd,
  onBudgetChange,
  onBudgetSave,
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

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Leave the monthly target blank to disable it for a category.
        </p>

        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400">No categories configured.</p>
          ) : (
            categories.map((category, index) => {
              const isEditing = editing.type === type && editing.index === index;
              const budgetValue = budgetDrafts[category] ?? '';

              return (
                <div
                  key={`${type}-${category}-${index}`}
                  className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_170px_auto] gap-3 px-3 py-3 rounded-lg border dark:border-gray-700"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {isEditing ? (
                      <input
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        className="flex-1 px-2 py-1.5 border dark:border-gray-600 rounded focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{category}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Monthly target</label>
                    <input
                      type="number"
                      step="0.01"
                      value={budgetValue}
                      onChange={(e) => onBudgetChange(category, e.target.value)}
                      onBlur={() => onBudgetSave(category)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onBudgetSave(category);
                        }
                      }}
                      disabled={saving}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200 text-sm disabled:opacity-50"
                    />
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
