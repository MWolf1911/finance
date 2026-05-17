const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3001/api`
    : 'http://localhost:3001/api');

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

async function parseApiError(res) {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || `API error: ${res.status}`);
}

export const api = {
  // Health / Lazy Generation trigger
  health: () => apiFetch('/health'),

  // Shared household profile
  getHousehold: () => apiFetch('/household'),

  // Dashboard
  getDashboardBalance: (year, month) =>
    apiFetch(`/dashboard/balance?year=${year}&month=${month}`),
  updateDashboardBalance: (year, month, data) => apiFetch(`/dashboard/balance?year=${year}&month=${month}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateDashboardReconciliation: (year, month, data) => apiFetch(`/dashboard/reconciliation?year=${year}&month=${month}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/transactions?${q}`);
  },
  getMonthlySummary: (year, month) =>
    apiFetch(`/transactions/summary?year=${year}&month=${month}`),
  createTransaction: (data) => apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTransaction: (id, data) => apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTransaction: (id) => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),

  // Recurring Templates
  getTemplates: () => apiFetch('/templates'),
  createTemplate: (data) => apiFetch('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTemplate: (id, data) => apiFetch(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTemplate: (id) => apiFetch(`/templates/${id}`, { method: 'DELETE' }),

  // Debts
  getDebts: ({ includeArchived = false } = {}) =>
    apiFetch(`/debts?includeArchived=${includeArchived ? 'true' : 'false'}`),
  getDebtTotal: () => apiFetch('/debts/total'),
  getDebtProjection: (extraPayment = 0) =>
    apiFetch(`/debts/projection?extraPayment=${extraPayment}`),
  createDebt: (data) => apiFetch('/debts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateDebt: (id, data) => apiFetch(`/debts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  archiveDebt: (id) => apiFetch(`/debts/${id}/archive`, { method: 'POST' }),
  unarchiveDebt: (id) => apiFetch(`/debts/${id}/unarchive`, { method: 'POST' }),
  deleteDebt: (id) => apiFetch(`/debts/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => apiFetch('/settings'),
  updateSettings: (data) => apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  downloadBackup: async () => {
    const res = await fetch(`${API_BASE}/settings/backup`);
    if (!res.ok) {
      await parseApiError(res);
    }

    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^\"]+)"?/i);

    return {
      blob: await res.blob(),
      fileName: match?.[1] || 'finance-backup.db',
    };
  },
  restoreBackup: async (file) => {
    const payload = await file.arrayBuffer();
    const res = await fetch(`${API_BASE}/settings/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: payload,
    });

    if (!res.ok) {
      await parseApiError(res);
    }

    return res.json();
  },
  getCategories: () => apiFetch('/settings/categories'),
  updateCategories: (data) => apiFetch('/settings/categories', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Archives
  getArchives: () => apiFetch('/archives'),
  getArchiveMonth: (year, month) => apiFetch(`/archives/${year}/${month}`),
  getArchiveCsvUrl: (year, month) => `${API_BASE}/archives/${year}/${month}/csv`,
};
