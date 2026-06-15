import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  RefreshCw, 
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
import { toast } from 'react-toastify';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { getApiMessage } from '@/src/lib/toastMessages';

export default function Insights() {
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
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

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const { data } = await api.get('/transactions');
      setTransactions(data);
      return data;
    } catch (error: any) {
      console.error(error);
      toast.error(getApiMessage(error, "Failed to load transactions."));
      throw error;
    } finally {
      setTransactionsLoading(false);
    }
  };

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await fetchTransactions();
      if (!data.length) {
        setInsights(null);
        toast.info('Add transactions before generating AI insights.');
        return;
      }

      const aiInsights = await getFinancialInsights(data);
      setInsights(aiInsights);
      toast.success('AI suggestions generated!');
    } catch (error: any) {
      console.error(error);
      toast.error(getApiMessage(error, "Failed to generate AI insights."));
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions().catch(() => undefined);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Financial Insights</h1>
          <p className="text-sm text-slate-500">Powered by Gemini, with local AI fallback.</p>
        </div>
        <Button variant="outline" onClick={generateInsights} disabled={insightsLoading || transactionsLoading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", insightsLoading && "animate-spin")} />
          {insights ? 'Regenerate AI Insights' : 'Generate AI Insights'}
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
            {insightsLoading ? (
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
              <div className="py-12 text-center">
                <p className="text-slate-500">AI insights have not been generated yet.</p>
                <p className="mt-2 text-sm text-slate-400">Click Generate AI Insights when you want to use AI tokens.</p>
              </div>
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
              {transactionsLoading ? (
                <div className="h-full flex items-center justify-center text-slate-500">Loading data...</div>
              ) : categoryData.length === 0 ? (
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

        </div>
      </div>
    </div>
  );
}
