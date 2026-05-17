export const DEFAULT_CATEGORIES = {
  Expense: [
    'Rent/Mortgage', 'Utilities', 'Internet', 'Phone', 'Insurance',
    'Groceries', 'Dining Out', 'Transportation', 'Gas', 'Car Payment',
    'Medical', 'Subscriptions', 'Entertainment', 'Clothing', 'Personal Care',
    'Education', 'Childcare', 'Pet', 'Home Maintenance', 'Gifts', 'Other Expense',
  ],
  Income: [
    'Salary', 'Freelance', 'Side Hustle', 'Bonus', 'Tax Refund',
    'Investment', 'Rental Income', 'Other Income',
  ],
};

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getCurrentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function getMonthName(month, year) {
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDebtLabel(debtOrName, last4) {
  const name = typeof debtOrName === 'string' ? debtOrName : debtOrName?.name;
  const accountLast4 = typeof debtOrName === 'string' ? last4 : debtOrName?.account_last4 ?? debtOrName?.accountLast4 ?? last4;

  if (!name) {
    return '';
  }

  return accountLast4 ? `${name} •••• ${accountLast4}` : name;
}
