import { parseISO } from 'date-fns';
import type { SortDirection, SortKey, Transaction } from './transactions.types';

export const isPdfBill = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.pdf') || cleanUrl.includes('/raw/upload/');
};

export const getBillUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const filterTransactions = (transactions: Transaction[], search: string, filter: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const matchesSearch = !normalizedSearch ||
      (transaction.description || '').toLowerCase().includes(normalizedSearch) ||
      (transaction.merchant_name || '').toLowerCase().includes(normalizedSearch) ||
      (transaction.payee_vpa || '').toLowerCase().includes(normalizedSearch) ||
      (transaction.category || '').toLowerCase().includes(normalizedSearch) ||
      (transaction.payment_mode || '').toLowerCase().includes(normalizedSearch);
    const matchesFilter = filter === 'all' || transaction.type === filter;
    return matchesSearch && matchesFilter;
  });
};

export const sortTransactions = (
  transactions: Transaction[],
  sortKey: SortKey | null,
  sortDirection: SortDirection
) => {
  if (!sortKey) return transactions;

  const getSortValue = (transaction: Transaction) => {
    if (sortKey === 'amount') {
      const amount = Number(transaction.amount) || 0;
      return transaction.type === 'expense' ? -amount : amount;
    }
    if (sortKey === 'date') return parseISO(transaction.date).getTime();
    return String(transaction[sortKey] || '').toLowerCase();
  };

  return [...transactions].sort((first, second) => {
    const firstValue = getSortValue(first);
    const secondValue = getSortValue(second);
    if (firstValue < secondValue) return sortDirection === 'asc' ? -1 : 1;
    if (firstValue > secondValue) return sortDirection === 'asc' ? 1 : -1;
    return Number(second.id || 0) - Number(first.id || 0);
  });
};
