import { useEffect, useMemo, useState } from 'react';
import { ITEMS_PER_PAGE } from '../transactions.constants';
import type { SortDirection, SortKey, Transaction } from '../transactions.types';
import { filterTransactions, sortTransactions } from '../transactions.utils';

export function useTransactionsView(transactions: Transaction[], debouncedSearch: string, filter: string) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedTransactions = useMemo(() => {
    const filteredTransactions = filterTransactions(transactions, debouncedSearch, filter);
    return sortTransactions(filteredTransactions, sortKey, sortDirection);
  }, [debouncedSearch, filter, sortDirection, sortKey, transactions]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = sortedTransactions.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);

    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    setSortKey(null);
    setSortDirection('asc');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    sortedTransactions,
    paginatedTransactions,
    pageStartIndex,
    safeCurrentPage,
    totalPages,
    sortKey,
    sortDirection,
    setCurrentPage,
    handleSort,
  };
}
