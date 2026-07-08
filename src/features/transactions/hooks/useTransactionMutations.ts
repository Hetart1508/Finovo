import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { transactionsApi } from '@/src/api/transactionsApi';
import { invalidateTransactions } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import type { ExtractedTransaction } from '@/src/api/transactionsApi';
import type { Transaction } from '../transactions.types';

type UseTransactionMutationsArgs = {
  editingTransaction: Transaction | null;
  transactionDate: string;
  todayDateString: string;
  onAdded: () => void;
  onUpdated: () => void;
};

export function useTransactionMutations({
  editingTransaction,
  transactionDate,
  todayDateString,
  onAdded,
  onUpdated,
}: UseTransactionMutationsArgs) {
  const queryClient = useQueryClient();
  const refreshTransactions = () => invalidateTransactions(queryClient);

  const deleteTransaction = useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: refreshTransactions,
  });
  const addTransaction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transactionsApi.create(payload),
    onSuccess: refreshTransactions,
  });
  const extractTransaction = useMutation({
    mutationFn: (description: string) => transactionsApi.extract(description),
  });
  const updateTransaction = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => transactionsApi.update(id, payload),
    onSuccess: refreshTransactions,
  });

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this transaction permanently? This action cannot be undone.')) return;

    try {
      const response = await deleteTransaction.mutateAsync(id);
      toast.success(getApiSuccessMessage(response.data, 'Transaction deleted successfully'));
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to delete transaction.'));
    }
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (transactionDate > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return false;
    }

    try {
      const response = await addTransaction.mutateAsync({
        ...data,
        amount: parseFloat(data.amount as string),
        date: transactionDate,
      });
      toast.success(getApiSuccessMessage(response.data, 'Transaction added successfully'));
      onAdded();
      return true;
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to add transaction.'));
      return false;
    }
  };

  const handleExtract = async (description: string): Promise<ExtractedTransaction | null> => {
    try {
      const response = await extractTransaction.mutateAsync(description);
      toast.success('Transaction details extracted. Review before saving.');
      return response.transaction;
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Could not extract transaction details. Try manual add.'));
      return null;
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(event.currentTarget);
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
      onUpdated();
      toast.success(getApiSuccessMessage(response.data, 'Transaction updated successfully'));
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to update transaction.'));
    }
  };

  return {
    handleAdd,
    handleUpdate,
    handleDelete,
    handleExtract,
    extractingTransaction: extractTransaction.isPending,
  };
}
