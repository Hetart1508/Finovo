import type { Transaction } from '@/types/finance';

export const ITEMS_PER_PAGE = 10;

export const transactionCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Health',
  'Other',
  'Salary',
] as const;

export const paymentModes = [
  'UPI',
  'Card',
  'Cash',
  'Net Banking',
  'Bank Transfer',
  'Bank Statement',
  'Wallet',
] as const;

export type TransactionFilter = 'all' | 'expense' | 'income';
export type SortDirection = 'asc' | 'desc';
export type SortKey = 'type' | 'date' | 'description' | 'category' | 'payment_mode' | 'amount';

export const sortLabels: Record<SortKey, string> = {
  type: 'Type',
  date: 'Date',
  description: 'Description',
  category: 'Category',
  payment_mode: 'Mode',
  amount: 'Amount',
};

export function filterTransactions(
  transactions: Transaction[],
  search: string,
  filter: TransactionFilter,
) {
  const normalizedSearch = search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const matchesSearch = !normalizedSearch || [
      transaction.description,
      transaction.merchant_name,
      transaction.payee_vpa,
      transaction.category,
      transaction.payment_mode,
    ].some((value) => (value || '').toLowerCase().includes(normalizedSearch));
    const matchesFilter = filter === 'all' || transaction.type === filter;
    return matchesSearch && matchesFilter;
  });
}

export function sortTransactions(
  transactions: Transaction[],
  sortKey: SortKey | null,
  sortDirection: SortDirection,
) {
  if (!sortKey) return transactions;

  const getSortValue = (transaction: Transaction) => {
    if (sortKey === 'amount') {
      const amount = Number(transaction.amount) || 0;
      return transaction.type === 'expense' ? -amount : amount;
    }
    if (sortKey === 'date') return new Date(`${transaction.date}T00:00:00`).getTime();
    return String(transaction[sortKey] || '').toLowerCase();
  };

  return [...transactions].sort((first, second) => {
    const firstValue = getSortValue(first);
    const secondValue = getSortValue(second);
    if (firstValue < secondValue) return sortDirection === 'asc' ? -1 : 1;
    if (firstValue > secondValue) return sortDirection === 'asc' ? 1 : -1;
    return Number(second.id || 0) - Number(first.id || 0);
  });
}

export function todayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
