'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// ── Transactions ───────────────────────────────────────────
export function useTransactions(month, year, filters = {}) {
  const { currentUser } = useAuth();
  const key = currentUser
    ? ['transactions', month, year, JSON.stringify(filters)]
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getTransactions({
      month: String(month),
      year: String(year),
      ...filters,
    })
  );

  return { transactions: data || [], error, isLoading, mutate };
}

export function useMonthlySummary(month, year) {
  const { currentUser } = useAuth();
  const key = currentUser ? ['summary', month, year] : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getMonthlySummary(year, month)
  );

  return { summary: data, error, isLoading, mutate };
}

// ── Recurring Templates ────────────────────────────────────
export function useTemplates() {
  const { currentUser } = useAuth();
  const key = currentUser ? ['templates'] : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getTemplates()
  );

  return { templates: data || [], error, isLoading, mutate };
}

// ── Debts ──────────────────────────────────────────────────
export function useDebts() {
  const { currentUser } = useAuth();
  const key = currentUser ? ['debts'] : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getDebts()
  );

  return { debts: data || [], error, isLoading, mutate };
}

export function useDebtTotal() {
  const { currentUser } = useAuth();
  const key = currentUser ? ['debtTotal'] : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getDebtTotal()
  );

  return { total: data?.total ?? 0, error, isLoading, mutate };
}

export function useDebtProjection(extraPayment) {
  const { currentUser } = useAuth();
  const key = currentUser
    ? ['debtProjection', extraPayment]
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getDebtProjection(extraPayment)
  );

  return { projection: data, error, isLoading, mutate };
}

// ── Archives ───────────────────────────────────────────────
export function useArchives() {
  const { currentUser } = useAuth();
  const key = currentUser ? ['archives'] : null;

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    api.getArchives()
  );

  return { archives: data || [], error, isLoading, mutate };
}

export function useArchiveMonth(year, month) {
  const { currentUser } = useAuth();
  const key = currentUser && year && month
    ? ['archiveMonth', year, month]
    : null;

  const { data, error, isLoading } = useSWR(key, () =>
    api.getArchiveMonth(year, month)
  );

  return { archive: data, error, isLoading };
}
