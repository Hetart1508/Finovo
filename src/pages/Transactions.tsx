import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/src/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { transactionsQuery } from '@/src/server-state/transactionsQueries';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getApiMessage } from '@/src/lib/toastMessages';
import { useDebouncedValue } from '@/src/lib/useDebouncedValue';
import { BillPreviewDialog } from '@/src/features/transactions/components/BillPreviewDialog';
import { TransactionForm } from '@/src/features/transactions/components/TransactionForm';
import { TransactionsTableCard } from '@/src/features/transactions/components/TransactionsTableCard';
import { TransactionsToolbar } from '@/src/features/transactions/components/TransactionsToolbar';
import { useTransactionMutations } from '@/src/features/transactions/hooks/useTransactionMutations';
import { useTransactionsView } from '@/src/features/transactions/hooks/useTransactionsView';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import type { Transaction } from '@/src/features/transactions/transactions.types';

export default function Transactions() {
  const { selectedWallet, selectedWalletId } = useWallets();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addDialogRequestKey, setAddDialogRequestKey] = useState(0);
  const transactionsResult = useQuery(transactionsQuery(selectedWalletId));
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const loading = transactionsResult.isPending;

  useEffect(() => {
    if (transactionsResult.error) {
      toast.error(getApiMessage(transactionsResult.error, "Failed to fetch transactions."), { toastId: 'transactions-query-error' });
    }
  }, [transactionsResult.error]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [transactionDate, setTransactionDate] = useState(todayDateString);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingBill, setViewingBill] = useState<Transaction | null>(null);
  const debouncedSearch = useDebouncedValue(search, 500);
  const transactionView = useTransactionsView(transactions, debouncedSearch, filter);
  const transactionMutations = useTransactionMutations({
    editingTransaction,
    transactionDate,
    todayDateString,
    selectedWalletId,
    onAdded: () => setTransactionDate(todayDateString),
    onUpdated: () => setEditingTransaction(null),
  });

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    setAddDialogRequestKey((key) => key + 1);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
      <TransactionsToolbar
        search={search}
        filter={filter}
        transactionDate={transactionDate}
        maxDate={todayDateString}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        onTransactionDateChange={setTransactionDate}
        onAddTransaction={transactionMutations.handleAdd}
        onExtractTransaction={transactionMutations.handleExtract}
        extractingTransaction={transactionMutations.extractingTransaction}
        selectedWalletName={selectedWallet?.name ?? 'Wallet'}
        addDialogRequestKey={addDialogRequestKey}
      />

      <TransactionsTableCard
        loading={loading}
        transactions={transactionView.paginatedTransactions}
        totalTransactions={transactionView.sortedTransactions.length}
        pageStartIndex={transactionView.pageStartIndex}
        safeCurrentPage={transactionView.safeCurrentPage}
        totalPages={transactionView.totalPages}
        sortKey={transactionView.sortKey}
        sortDirection={transactionView.sortDirection}
        onSort={transactionView.handleSort}
        onPageChange={transactionView.setCurrentPage}
        onViewBill={setViewingBill}
        onEditTransaction={setEditingTransaction}
        onDeleteTransaction={transactionMutations.handleDelete}
        showCreatedBy={selectedWallet?.type === 'family'}
      />

      <BillPreviewDialog transaction={viewingBill} onOpenChange={(open) => !open && setViewingBill(null)} />

      <Dialog open={Boolean(editingTransaction)} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        {editingTransaction ? (
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto p-3 sm:max-w-md">
            <DialogHeader className="pr-8">
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              mode="edit"
              transaction={editingTransaction}
              maxDate={todayDateString}
              onSubmit={transactionMutations.handleUpdate}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );

}
