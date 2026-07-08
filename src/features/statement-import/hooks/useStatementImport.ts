import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { statementImportApi } from '@/src/api/statementImportApi';
import { invalidateMerchantAliases, invalidateTransactions } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import type { StatementTransaction } from '../statementImport.types';
import { isFutureTransactionDate, readFileAsBase64 } from '../statementImport.utils';

export function useStatementImport() {
  const queryClient = useQueryClient();
  const { selectedWalletId } = useWallets();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [model, setModel] = useState('');
  const [statementHash, setStatementHash] = useState('');
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);

  const previewStatement = useMutation({
    mutationFn: (payload: { base64Data: string; mimeType: string }) => statementImportApi.preview(payload),
  });
  const approveStatement = useMutation({
    mutationFn: (payload: { transactions: StatementTransaction[]; statementHash: string; wallet_id?: number | null }) => statementImportApi.approve(payload),
    onSuccess: () => {
      invalidateTransactions(queryClient);
      invalidateMerchantAliases(queryClient);
    },
  });

  const totals = useMemo(() => transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === 'income') acc.income += transaction.amount;
      if (transaction.type === 'expense') acc.expense += transaction.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  ), [transactions]);

  const handleStatementFile = async (selectedFile: File | null) => {
    if (!selectedFile) return;

    const supported = selectedFile.type === 'application/pdf' || selectedFile.type.startsWith('image/');
    if (!supported) {
      toast.error('Upload a PDF, JPG, or PNG statement.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Statement file must be 10MB or smaller.');
      return;
    }

    setStatementFile(selectedFile);
    setTransactions([]);
    setModel('');
    setStatementHash('');
    setAlreadyImported(false);
    setApprovedCount(0);
    setPreviewLoading(true);

    try {
      const base64Data = await readFileAsBase64(selectedFile);
      const { data } = await previewStatement.mutateAsync({ base64Data, mimeType: selectedFile.type });
      const importedTransactions: StatementTransaction[] = data.transactions || [];
      const validTransactions = importedTransactions.filter((transaction) => !isFutureTransactionDate(transaction.date));
      const futureTransactionCount = importedTransactions.length - validTransactions.length;

      setTransactions(validTransactions);
      setModel(data.model || '');
      setStatementHash(data.statementHash || '');
      setAlreadyImported(Boolean(data.alreadyImported));

      if (data.alreadyImported) {
        toast.warn('This statement was already imported. No transactions will be added again.');
      } else if (validTransactions.length) {
        toast.success(`Found ${validTransactions.length} statement transactions. Review and approve to save.`);
      } else {
        toast.warn('No transactions found in this statement.');
      }

      if (futureTransactionCount > 0) {
        toast.warn(`${futureTransactionCount} future-dated statement row${futureTransactionCount === 1 ? '' : 's'} skipped.`);
      }
    } catch (error: unknown) {
      console.error(error);
      const detail = (error as any).response?.data?.detail;
      const message = getApiMessage(error, 'Failed to import statement.');
      toast.error(detail ? `${message}: ${detail}` : message);
    } finally {
      setPreviewLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePreviewRow = (indexToRemove: number) => {
    setTransactions((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleToggleTransactionType = (indexToToggle: number) => {
    setTransactions((current) => current.map((transaction, index) =>
      index === indexToToggle
        ? { ...transaction, type: transaction.type === 'income' ? 'expense' : 'income' }
        : transaction
    ));
  };

  const handleMerchantNameChange = (vpa: string, companyName: string) => {
    setTransactions((current) => current.map((transaction) =>
      transaction.vpa === vpa
        ? { ...transaction, merchant_name: companyName, alias_status: companyName.trim() ? 'matched' : 'unknown' }
        : transaction
    ));
  };

  const handleApproveAll = async () => {
    if (!transactions.length) return;

    if (transactions.some((transaction) => isFutureTransactionDate(transaction.date))) {
      toast.error('Statement transactions cannot include future dates.');
      return;
    }

    setApproveLoading(true);
    try {
      const response = await approveStatement.mutateAsync({ transactions, statementHash, wallet_id: selectedWalletId });
      const savedCount = response.data.savedCount || 0;
      const skippedCount = response.data.skippedCount || 0;

      setApprovedCount(savedCount);
      setTransactions([]);
      setStatementHash('');
      setAlreadyImported(false);
      toast.success(getApiSuccessMessage(response.data, `Saved ${savedCount} statement transactions.`));

      if (skippedCount > 0) {
        toast.warn(`${skippedCount} rows were skipped because they were duplicates or failed validation.`);
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiMessage(error, 'Failed to save approved statement transactions.'));
    } finally {
      setApproveLoading(false);
    }
  };

  return {
    fileInputRef,
    statementFile,
    transactions,
    model,
    alreadyImported,
    previewLoading,
    approveLoading,
    approvedCount,
    totals,
    handleStatementFile,
    handleRemovePreviewRow,
    handleToggleTransactionType,
    handleMerchantNameChange,
    handleApproveAll,
  };
}
