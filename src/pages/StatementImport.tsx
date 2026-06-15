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
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, FileText, Trash2, Upload } from 'lucide-react';
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

      if (importedTransactions.length) {
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
      const response = await api.post('/statement-import/approve', { transactions });
      const savedCount = response.data.savedCount || 0;
      const skippedCount = response.data.skippedCount || 0;

      setApprovedCount(savedCount);
      setTransactions([]);
      toast.success(getApiSuccessMessage(response.data, `Saved ${savedCount} statement transactions.`));

      if (skippedCount > 0) {
        toast.warn(`${skippedCount} rows were skipped because they failed validation.`);
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
          <p className="text-slate-500">Extract income and expenses from a bank, card, UPI, or wallet statement before saving them.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(event) => handleStatementFile(event.target.files?.[0] || null)}
        />

        <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={previewLoading || approveLoading}>
          <Upload className="h-4 w-4" />
          {previewLoading ? 'Reading Statement...' : 'Select Statement File'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Statement</p>
            <div className="mt-2 flex items-center gap-3">
              <FileText className="h-5 w-5 text-indigo-600" />
              <p className="min-w-0 truncate font-semibold">{statementFile ? statementFile.name : 'No file selected'}</p>
            </div>
            {model ? <p className="mt-2 text-xs text-slate-400">Parsed with {model}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Income Found</p>
            <p className="mt-2 text-2xl font-black text-emerald-600">₹{totals.income.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Expense Found</p>
            <p className="mt-2 text-2xl font-black text-rose-600">₹{totals.expense.toLocaleString()}</p>
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
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleApproveAll}
            disabled={!transactions.length || previewLoading || approveLoading}
          >
            <CheckCircle2 className="h-4 w-4" />
            {approveLoading ? 'Saving...' : `Approve All${transactions.length ? ` (${transactions.length})` : ''}`}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
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
                  <TableCell colSpan={7} className="py-10 text-center text-slate-500">Extracting statement transactions...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                    {approvedCount ? `Saved ${approvedCount} transactions. Select another statement to import more.` : 'Select a statement file to preview transactions.'}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction, index) => (
                  <TableRow key={`${transaction.date}-${transaction.amount}-${index}`} className="border-slate-100 dark:border-slate-800">
                    <TableCell>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        transaction.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {transaction.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {format(parseISO(transaction.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{transaction.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{transaction.payment_mode}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      transaction.type === 'income' ? "text-emerald-600" : "text-slate-900 dark:text-white"
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => handleRemovePreviewRow(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
        <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Statement extraction uses AI when you upload the file. Saving approved rows does not call AI again.
        </p>
      </div>
    </div>
  );
}
