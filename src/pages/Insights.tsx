import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  Download
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
import { AlertCircle, Lightbulb } from 'lucide-react';
import api from '@/src/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export default function Insights() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  const handleSyncAA = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Successfully synced with HDFC, ICICI, and SBI via Account Aggregator!");
    }, 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Financial Insights</h1>
powered by local AI (unlimited).
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
            <CardDescription>Based on your spending patterns from the last 30 days.</CardDescription>
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

          {/* Account Aggregator Mock */}
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-2 bg-indigo-600"></div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Bank Sync (AA)</CardTitle>
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <CardDescription>Connect your Indian bank accounts via Sahamati AA framework.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">HDFC Bank</span>
                  <Badge variant="secondary">Synced</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">SBI</span>
                  <Badge variant="secondary">Synced</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">ICICI Bank</span>
                  <Badge variant="outline" className="text-slate-400 border-slate-200">Disconnected</Badge>
                </div>
              </div>
              <Button className="w-full gap-2" variant="outline" onClick={handleSyncAA} disabled={syncing}>
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Sync All Accounts"}
              </Button>
            </CardContent>
          </Card>

          {/* PDF Import */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg">Statement Import</CardTitle>
              </div>
              <CardDescription>Import PhonePe or GPay PDF statements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                <Download className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Drag & drop your bank statement PDF</p>
              </div>
              <Button className="w-full" variant="secondary">Select PDF File</Button>
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Note: PDF parsing is currently in beta. Ensure the PDF is not password protected.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
