import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  RefreshCw, 
  FileText, 
  Download,
  AlertCircle,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { getFinancialInsights } from '@/src/lib/ai';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import api from '@/src/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

type ImportedStatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  payment_mode: string;
};

export default function Insights() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementResult, setStatementResult] = useState<{
    transactions: ImportedStatementTransaction[];
    model?: string;
    savedCount?: number;
    skippedCount?: number;
  } | null>(null);
  const statementInputRef = useRef<HTMLInputElement | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  
  const monthTransactions = useMemo(() => {
    const currentMonth = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return transactions.filter(t => isWithinInterval(parseISO(t.date), { start: currentMonth, end: monthEnd }));
  }, [transactions]);

  const categoryDataMemo = useMemo(() => {
    const expenses = monthTransactions.filter(t => t.type === 'expense');
    const catMap = expenses.reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    return Object.entries(catMap)
      .map(([name, value]: any) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [monthTransactions]);

  useEffect(() => {
    setCategoryData(categoryDataMemo);
  }, [categoryDataMemo]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/transactions');
      setTransactions(data);
      const aiInsights = await getFinancialInsights(data);
      setInsights(aiInsights);
      console.log('AI Insights:', aiInsights); // Debug log
      toast.success('AI suggestions generated!');
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate AI insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

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
    setStatementResult(null);
    setStatementLoading(true);

    try {
      const base64Data = await readFileAsBase64(selectedFile);
      const { data } = await api.post('/ai/import-statement', {
        base64Data,
        mimeType: selectedFile.type,
      });

      const importedTransactions: ImportedStatementTransaction[] = data.transactions || [];

      setStatementResult({
        transactions: importedTransactions,
        model: data.model,
        savedCount: data.savedCount || 0,
        skippedCount: data.skippedCount || 0,
      });

      if (data.savedCount > 0) {
        toast.success(`Imported ${data.savedCount} statement transactions.`);
        if (data.skippedCount > 0) {
          toast.warning(`${data.skippedCount} extracted rows were skipped.`);
        }
        await fetchInsights();
      } else {
        toast.warning(importedTransactions.length ? 'Transactions were found but could not be saved.' : 'No transactions found in this statement.');
      }
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to import statement.';
      toast.error(detail ? `${message}: ${detail}` : message);
    } finally {
      setStatementLoading(false);
    }
  };

  const statementTotals = useMemo(() => {
    const rows = statementResult?.transactions || [];
    return rows.reduce(
      (acc, transaction) => {
        if (transaction.type === 'income') acc.income += transaction.amount;
        if (transaction.type === 'expense') acc.expense += transaction.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [statementResult]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Financial Insights</h1>
          <p className="text-sm text-slate-500">Powered by Gemini, with local AI fallback.</p>
        </div>
        <Button variant="outline" onClick={fetchInsights} disabled={loading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh Insights
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main AI Insights */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/10 dark:to-slate-900">
          <CardHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
<CardTitle className="text-xl">AI Analysis</CardTitle>
            </div>
            <CardDescription>
              Based on your spending patterns from the last 30 days
              {insights?.model ? ` using ${insights.model}.` : '.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-20 w-full mt-8" />
              </div>
            ) : insights ? (
              <>
                {insights.summary && (
                  <div className="space-y-3 mb-8 prose prose-slate dark:prose-invert max-w-none">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> AI Financial Analysis</h3>
                    <p>{insights.summary}</p>
                  </div>
                )}

              </>
            ) : (
              <p className="text-slate-500 text-center py-12">No insights available. Add some transactions to get started.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8 lg:col-span-1">
          {/* Client-side Category Chart */}
          <Card className="border-none shadow-sm h-[320px]">
            <CardHeader>
              <CardTitle className="text-lg">Top Categories</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis tickFormatter={(v) => `₹${v}`} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Statement Import */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg">Statement Import</CardTitle>
              </div>
              <CardDescription>Import PDF or image statements for income and expenses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={statementInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(event) => handleStatementFile(event.target.files?.[0] || null)}
              />

              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                {statementResult?.transactions.length ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                ) : (
                  <Download className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                )}
                <p className="text-xs text-slate-500">
                  {statementFile ? statementFile.name : 'Upload a PDF, JPG, or PNG statement'}
                </p>
                {statementResult?.model ? (
                  <p className="mt-1 text-[10px] text-slate-400">Parsed with {statementResult.model}</p>
                ) : null}
              </div>

              <Button
                className="w-full gap-2"
                variant="secondary"
                onClick={() => statementInputRef.current?.click()}
                disabled={statementLoading}
              >
                <Upload className="w-4 h-4" />
                {statementLoading ? 'Reading and saving...' : 'Select Statement File'}
              </Button>

              {statementResult ? (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      Income ₹{statementTotals.income.toFixed(2)}
                    </div>
                    <div className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                      Expense ₹{statementTotals.expense.toFixed(2)}
                    </div>
                  </div>

                  <div className="max-h-44 space-y-2 overflow-auto pr-1">
                    {statementResult.savedCount !== undefined ? (
                      <p className="rounded-md bg-emerald-50 p-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        Saved {statementResult.savedCount} transactions automatically
                        {statementResult.skippedCount ? `, skipped ${statementResult.skippedCount}` : ''}.
                      </p>
                    ) : null}
                    {statementResult.transactions.slice(0, 8).map((transaction, index) => (
                      <div key={`${transaction.date}-${transaction.amount}-${index}`} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{transaction.description}</span>
                          <span className={transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                            {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{transaction.date} · {transaction.category}</p>
                      </div>
                    ))}
                    {statementResult.transactions.length > 8 ? (
                      <p className="text-[10px] text-slate-500">+{statementResult.transactions.length - 8} more transactions</p>
                    ) : null}
                  </div>

                </div>
              ) : null}

              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  The uploaded file is not stored permanently. Extracted income and expense rows are saved automatically as transactions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
