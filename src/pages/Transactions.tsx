import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/src/components/ui/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/src/api/transactionsApi';
import { transactionsQuery } from '@/src/server-state/transactionsQueries';
import { invalidateTransactions } from '@/src/server-state/invalidations';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { useDebouncedValue } from '@/src/lib/useDebouncedValue';
import {
  RiExternalLinkLine,
} from 'react-icons/ri';
import { TransactionForm } from '@/src/features/transactions/components/TransactionForm';
import { TransactionsTableCard } from '@/src/features/transactions/components/TransactionsTableCard';
import { TransactionsToolbar } from '@/src/features/transactions/components/TransactionsToolbar';
import { ITEMS_PER_PAGE } from '@/src/features/transactions/transactions.constants';
import type { SortDirection, SortKey, Transaction } from '@/src/features/transactions/transactions.types';

const isPdfBill = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.pdf') || cleanUrl.includes('/raw/upload/');
};

const getBillUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function Transactions() {
  const queryClient = useQueryClient();
  const transactionsResult = useQuery(transactionsQuery());
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const loading = transactionsResult.isPending;
  const deleteTransaction = useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: () => invalidateTransactions(queryClient),
  });
  const addTransaction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transactionsApi.create(payload),
    onSuccess: () => invalidateTransactions(queryClient),
  });
  const updateTransaction = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => transactionsApi.update(id, payload),
    onSuccess: () => invalidateTransactions(queryClient),
  });

  useEffect(() => {
    if (transactionsResult.error) {
      toast.error(getApiMessage(transactionsResult.error, "Failed to fetch transactions."), { toastId: 'transactions-query-error' });
    }
  }, [transactionsResult.error]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [transactionDate, setTransactionDate] = useState(todayDateString);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingBill, setViewingBill] = useState<Transaction | null>(null);
  const debouncedSearch = useDebouncedValue(search, 500);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this transaction permanently? This action cannot be undone.')) return;

    try {
      const response = await deleteTransaction.mutateAsync(id);
      toast.success(getApiSuccessMessage(response.data, "Transaction deleted successfully"));
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to delete transaction."));
    }
  };

  const openBillInNewTab = (url: string) => {
    const openedWindow = window.open(getBillUrl(url), '_blank');
    if (openedWindow) {
      openedWindow.opener = null;
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const selectedDate = transactionDate;

    if (selectedDate > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return;
    }
    
    try {
      const response = await addTransaction.mutateAsync({
        ...data,
        amount: parseFloat(data.amount as string),
        date: selectedDate,
      });
      toast.success(getApiSuccessMessage(response.data, "Transaction added successfully"));
      setTransactionDate(todayDateString);
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to add transaction."));
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const selectedDate = String(data.date || '');

    if (selectedDate > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return;
    }

    try {
      const response = await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        payload: { ...data, amount: parseFloat(data.amount as string) },
      });
      setEditingTransaction(null);
      toast.success(getApiSuccessMessage(response.data, "Transaction updated successfully"));
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to update transaction."));
    }
  };

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

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    return transactions.filter(t => {
      const matchesSearch = !normalizedSearch ||
        (t.description || '').toLowerCase().includes(normalizedSearch) ||
        (t.merchant_name || '').toLowerCase().includes(normalizedSearch) ||
        (t.payee_vpa || '').toLowerCase().includes(normalizedSearch) ||
        (t.category || '').toLowerCase().includes(normalizedSearch) ||
        (t.payment_mode || '').toLowerCase().includes(normalizedSearch);
      const matchesFilter = filter === 'all' || t.type === filter;
      return matchesSearch && matchesFilter;
    });
  }, [debouncedSearch, filter, transactions]);

  const sortedTransactions = useMemo(() => {
    if (!sortKey) return filteredTransactions;

    const getSortValue = (transaction: Transaction) => {
      if (sortKey === 'amount') {
        const amount = Number(transaction.amount) || 0;
        return transaction.type === 'expense' ? -amount : amount;
      }
      if (sortKey === 'date') return parseISO(transaction.date).getTime();
      return String(transaction[sortKey] || '').toLowerCase();
    };

    return [...filteredTransactions].sort((first, second) => {
      const firstValue = getSortValue(first);
      const secondValue = getSortValue(second);
      if (firstValue < secondValue) return sortDirection === 'asc' ? -1 : 1;
      if (firstValue > secondValue) return sortDirection === 'asc' ? 1 : -1;
      return Number(second.id || 0) - Number(first.id || 0);
    });
  }, [filteredTransactions, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = sortedTransactions.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      <TransactionsToolbar
        search={search}
        filter={filter}
        transactionDate={transactionDate}
        maxDate={todayDateString}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        onTransactionDateChange={setTransactionDate}
        onAddTransaction={handleAdd}
      />

      <TransactionsTableCard
        loading={loading}
        transactions={paginatedTransactions}
        totalTransactions={sortedTransactions.length}
        pageStartIndex={pageStartIndex}
        safeCurrentPage={safeCurrentPage}
        totalPages={totalPages}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onPageChange={setCurrentPage}
        onViewBill={setViewingBill}
        onEditTransaction={setEditingTransaction}
        onDeleteTransaction={handleDelete}
      />

      <Dialog open={Boolean(viewingBill)} onOpenChange={(open) => !open && setViewingBill(null)}>
        {viewingBill ? (
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Invoice Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 dark:border-[#334155] dark:bg-[#111827]">
                <p className="truncate text-sm font-semibold text-[#1F2937] dark:text-[#CBD5E1]">
                  {viewingBill.description || viewingBill.category}
                </p>
                <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                  {format(parseISO(viewingBill.date), 'dd MMM yyyy')} • ₹{Number(viewingBill.amount).toLocaleString()}
                </p>
              </div>

              {isPdfBill(viewingBill.bill_url) ? (
                <div className="h-[70vh] overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-[#334155]">
                  <iframe
                    src={getBillUrl(viewingBill.bill_url)}
                    title="Invoice bill PDF"
                    className="h-full w-full bg-white"
                  />
                </div>
              ) : (
                <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-[#E5E7EB] bg-[#0F172A]/5 p-3 dark:border-[#334155]">
                  <img
                    src={getBillUrl(viewingBill.bill_url)}
                    alt="Invoice bill"
                    className="max-h-[66vh] max-w-full rounded-md object-contain"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openBillInNewTab(viewingBill.bill_url)}
                >
                  <RiExternalLinkLine className="text-base" aria-hidden="true" />
                  Open in new tab
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(editingTransaction)} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        {editingTransaction ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              mode="edit"
              transaction={editingTransaction}
              maxDate={todayDateString}
              onSubmit={handleUpdate}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
