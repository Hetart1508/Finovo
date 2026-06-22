import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import api from '@/src/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { merchantAliasesQuery, queryKeys } from '@/src/lib/serverState';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import {
  RiArrowLeftDownLine,
  RiArrowRightUpLine,
  RiCheckboxCircleLine,
  RiDeleteBin6Line,
  RiErrorWarningLine,
  RiFileTextLine,
  RiSave3Line,
  RiStore2Line,
  RiUploadCloudLine,
} from 'react-icons/ri';

type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  payment_mode: string;
  vpa: string | null;
  merchant_name: string | null;
  original_description: string;
  alias_status: 'matched' | 'unknown' | 'not_applicable';
};

const getTodayDateString = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

const isFutureTransactionDate = (date: string) => date > getTodayDateString();

const getDisplayDescription = (transaction: StatementTransaction) => {
  const description = transaction.original_description || transaction.description || '';
  if (!transaction.vpa) return description || '-';
  const escapedVpa = transaction.vpa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutVpa = description.replace(new RegExp(escapedVpa, 'i'), '').replace(/[\s/|:;-]+$/g, '').trim();
  return !withoutVpa || /^upi(?:\s+(?:gpay|paytm|phonepe))?$/i.test(withoutVpa)
    ? 'UPI payment'
    : withoutVpa;
};

export default function StatementImport() {
  const queryClient = useQueryClient();
  const aliasesResult = useQuery(merchantAliasesQuery());
  const previewStatement = useMutation({
    mutationFn: (payload: { base64Data: string; mimeType: string }) => api.post('/statement-import/preview', payload),
  });
  const approveStatement = useMutation({
    mutationFn: (payload: { transactions: StatementTransaction[]; statementHash: string }) => api.post('/statement-import/approve', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchantAliases });
    },
  });
  const deleteAlias = useMutation({
    mutationFn: (id: number) => api.delete(`/merchant-aliases/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantAliases }),
  });
  const updateAlias = useMutation({
    mutationFn: ({ id, company_name }: { id: number; company_name: string }) => api.patch(`/merchant-aliases/${id}`, { company_name }),
    onSuccess: (_response, variables) => {
      setAliasEdits((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchantAliases });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      toast.success('Merchant name updated.');
    },
    onError: (error) => toast.error(getApiMessage(error, 'Failed to update merchant name.')),
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [model, setModel] = useState('');
  const [statementHash, setStatementHash] = useState('');
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [aliasEdits, setAliasEdits] = useState<Record<number, string>>({});

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.type === 'income') acc.income += transaction.amount;
        if (transaction.type === 'expense') acc.expense += transaction.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);
  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

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
      const { data } = await previewStatement.mutateAsync({
        base64Data,
        mimeType: selectedFile.type,
      });

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
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
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
      const response = await approveStatement.mutateAsync({ transactions, statementHash });
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
    } catch (error: any) {
      console.error(error);
      toast.error(getApiMessage(error, 'Failed to save approved statement transactions.'));
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statement Import</h1>
          <p className="text-[#6B7280]">Extract income and expenses from a bank, card, UPI, or wallet statement before saving them.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(event) => handleStatementFile(event.target.files?.[0] || null)}
        />

        <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={previewLoading || approveLoading}>
          <RiUploadCloudLine className="text-base" aria-hidden="true" />
          {previewLoading ? 'Reading Statement...' : 'Select Statement File'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B7280]">Statement</p>
            <div className="mt-2 flex items-center gap-3">
              <RiFileTextLine className="text-lg text-[#4F9CF9]" aria-hidden="true" />
              <p className="min-w-0 truncate font-semibold">{statementFile ? statementFile.name : 'No file selected'}</p>
            </div>
            {model ? <p className="mt-2 text-xs text-[#6B7280]">Parsed with {model}</p> : null}
          </CardContent>
        </Card>

        <Card className="compact-metric-card border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-[#6B7280]">Income Found</p>
            <p className="mt-2 text-2xl font-black text-[#34C759]">₹{totals.income.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="compact-metric-card border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-[#6B7280]">Expense Found</p>
            <p className="mt-2 text-2xl font-black text-[#FF6B6B]">₹{totals.expense.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiStore2Line className="text-[#4F9CF9]" aria-hidden="true" />
            Saved UPI Merchant Names
          </CardTitle>
          <CardDescription>These names are private to your account and reused whenever the same VPA appears again.</CardDescription>
        </CardHeader>
        <CardContent>
          {aliasesResult.isPending ? (
            <p className="text-sm text-[#6B7280]">Loading saved merchants...</p>
          ) : !aliasesResult.data?.length ? (
            <p className="text-sm text-[#6B7280]">No saved merchants yet. Import a statement to teach Finovo its first VPA.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {aliasesResult.data.map((alias) => (
                <div key={alias.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] p-3">
                  <div className="min-w-0">
                    <Input
                      value={aliasEdits[alias.id] ?? alias.company_name}
                      maxLength={255}
                      onChange={(event) => setAliasEdits((current) => ({ ...current, [alias.id]: event.target.value }))}
                      aria-label={`Company name for ${alias.vpa}`}
                      className="h-8 font-semibold"
                    />
                    <p className="truncate text-xs text-[#6B7280]">{alias.vpa}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-[#6B7280] hover:text-[#34C759]"
                      disabled={updateAlias.isPending || !(aliasEdits[alias.id] ?? alias.company_name).trim()}
                      onClick={() => updateAlias.mutate({ id: alias.id, company_name: aliasEdits[alias.id] ?? alias.company_name })}
                      aria-label={`Save ${alias.vpa}`}
                    >
                      <RiSave3Line className="text-base" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-[#6B7280] hover:text-[#FF6B6B]"
                      disabled={deleteAlias.isPending}
                      onClick={() => deleteAlias.mutate(alias.id)}
                      aria-label={`Forget ${alias.company_name}`}
                    >
                      <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Preview Transactions</CardTitle>
            <CardDescription>Review extracted income and outgoing rows. Nothing is saved until you approve.</CardDescription>
          </div>
          <Button
            className="gap-2 bg-[#34C759] hover:bg-[#2EB851]"
            onClick={handleApproveAll}
            disabled={!transactions.length || alreadyImported || previewLoading || approveLoading}
          >
            <RiCheckboxCircleLine className="text-base" aria-hidden="true" />
            {approveLoading ? 'Saving...' : `Approve All${transactions.length ? ` (${transactions.length})` : ''}`}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-[#E5E7EB] dark:border-[#E5E7EB]">
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">Extracting statement transactions...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">
                    {approvedCount ? `Saved ${approvedCount} transactions. Select another statement to import more.` : 'Select a statement file to preview transactions.'}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction, index) => (
                  <TableRow key={`${transaction.date}-${transaction.amount}-${index}`} className="border-[#E5E7EB] dark:border-[#E5E7EB]">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleTransactionType(index)}
                        title={`Change to ${transaction.type === 'income' ? 'expense' : 'income'}`}
                        aria-label={`Currently ${transaction.type}; change to ${transaction.type === 'income' ? 'expense' : 'income'}`}
                        className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                        transaction.type === 'income' ? "bg-[#EAFBF0] text-[#34C759]" : "bg-[#FFF1F1] text-[#FF6B6B]"
                      )}>
                        {transaction.type === 'income' ? <RiArrowRightUpLine className="text-base" aria-hidden="true" /> : <RiArrowLeftDownLine className="text-base" aria-hidden="true" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">
                      {format(parseISO(transaction.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="min-w-[260px] font-medium">
                      <p>{getDisplayDescription(transaction)}</p>
                      {transaction.type === 'expense' && transaction.vpa ? (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded bg-[#EEF6FF] px-2 py-1 text-xs text-[#2878D0]">{transaction.vpa}</code>
                            <Badge variant="outline" className={transaction.alias_status === 'matched' ? 'border-[#EAFBF0] text-[#34C759]' : 'border-[#FFF7E8] text-[#B87516]'}>
                              {transaction.alias_status === 'matched' ? 'Saved match' : 'Add name (optional)'}
                            </Badge>
                          </div>
                          <Label htmlFor={`merchant-name-${index}`} className="text-xs font-semibold">
                            Merchant/company name (optional)
                          </Label>
                          <Input
                            id={`merchant-name-${index}`}
                            value={transaction.merchant_name || ''}
                            maxLength={255}
                            placeholder="Enter merchant name"
                            onChange={(event) => handleMerchantNameChange(transaction.vpa!, event.target.value)}
                            aria-label={`Company name for ${transaction.vpa}`}
                            className="h-9"
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">{transaction.payment_mode}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      transaction.type === 'income' ? "text-[#34C759]" : "text-[#1F2937] text-[#FF6B6B]"
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#6B7280] hover:text-[#FF6B6B]"
                        onClick={() => handleRemovePreviewRow(index)}
                      >
                        <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg bg-[#FFF7E8] p-3 ">
        <RiErrorWarningLine className="mt-0.5 text-base text-[#FFB84D]" aria-hidden="true" />
        <p className="text-xs text-[#B87516] ">
          Statement extraction uses AI when you upload the file. Merchant names are matched locally by exact VPA—Finovo never guesses them.
        </p>
      </div>
    </div>
  );
}
