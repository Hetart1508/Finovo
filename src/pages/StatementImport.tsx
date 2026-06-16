import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';

type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  payment_mode: string;
};

export default function StatementImport() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [model, setModel] = useState('');
  const [statementHash, setStatementHash] = useState('');
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);

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
      const { data } = await api.post('/statement-import/preview', {
        base64Data,
        mimeType: selectedFile.type,
      });

      const importedTransactions: StatementTransaction[] = data.transactions || [];
      setTransactions(importedTransactions);
      setModel(data.model || '');
      setStatementHash(data.statementHash || '');
      setAlreadyImported(Boolean(data.alreadyImported));

      if (data.alreadyImported) {
        toast.warn('This statement was already imported. No transactions will be added again.');
      } else if (importedTransactions.length) {
        toast.success(`Found ${importedTransactions.length} statement transactions. Review and approve to save.`);
      } else {
        toast.warn('No transactions found in this statement.');
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

  const handleApproveAll = async () => {
    if (!transactions.length) return;

    setApproveLoading(true);
    try {
      const response = await api.post('/statement-import/approve', { transactions, statementHash });
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
          <i className="ki-outline ki-cloud-add text-base" aria-hidden="true" />
          {previewLoading ? 'Reading Statement...' : 'Select Statement File'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B7280]">Statement</p>
            <div className="mt-2 flex items-center gap-3">
              <i className="ki-outline ki-document text-lg text-[#4F9CF9]" aria-hidden="true" />
              <p className="min-w-0 truncate font-semibold">{statementFile ? statementFile.name : 'No file selected'}</p>
            </div>
            {model ? <p className="mt-2 text-xs text-[#6B7280]">Parsed with {model}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B7280]">Income Found</p>
            <p className="mt-2 text-2xl font-black text-[#34C759]">₹{totals.income.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B7280]">Expense Found</p>
            <p className="mt-2 text-2xl font-black text-[#FF6B6B]">₹{totals.expense.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

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
            <i className="ki-solid ki-check text-base" aria-hidden="true" />
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
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        transaction.type === 'income' ? "bg-[#EAFBF0] text-[#34C759]" : "bg-[#FFF1F1] text-[#FF6B6B]"
                      )}>
                        <i className={cn("ki-solid text-base", transaction.type === 'income' ? "ki-arrow-up-right" : "ki-arrow-down-left")} aria-hidden="true" />
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">
                      {format(parseISO(transaction.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{transaction.description || '-'}</TableCell>
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
                        <i className="ki-outline ki-trash text-base" aria-hidden="true" />
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
        <i className="ki-outline ki-warning mt-0.5 text-base text-[#FFB84D]" aria-hidden="true" />
        <p className="text-xs text-[#B87516] ">
          Statement extraction uses AI when you upload the file. Saving approved rows does not call AI again.
        </p>
      </div>
    </div>
  );
}
