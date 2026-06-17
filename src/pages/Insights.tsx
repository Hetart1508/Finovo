import { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { endOfMonth, format, isAfter, isWithinInterval, parseISO, startOfMonth, subDays, subMonths } from 'date-fns';
import { getApiMessage } from '@/src/lib/toastMessages';
import { RiRefreshLine, RiSparkling2Line } from 'react-icons/ri';

type RangeMode = 'currentMonth' | 'last30Days' | 'last4Months' | 'selectedMonth' | 'custom';
type InsightSectionKey =
  | 'spendingHighlights'
  | 'trendAnalysis'
  | 'futureExpensePrediction'
  | 'savingAdvice'
  | 'investmentGuidance'
  | 'actionPlan';

const insightSections: { key: InsightSectionKey; title: string }[] = [
  { key: 'spendingHighlights', title: 'Spending Highlights' },
  { key: 'trendAnalysis', title: 'Previous Transaction Trends' },
  { key: 'futureExpensePrediction', title: 'Future Expense Prediction' },
  { key: 'savingAdvice', title: 'Saving Advice' },
  { key: 'investmentGuidance', title: 'Investment & Planning Notes' },
  { key: 'actionPlan', title: 'Next Actions' },
];

const clampToToday = (date: Date, today: Date) => (isAfter(date, today) ? today : date);

const getPresetRange = (mode: RangeMode, selectedMonth: Date, customStartDate: Date | null, customEndDate: Date | null) => {
  const today = new Date();

  if (mode === 'last30Days') {
    return { start: subDays(today, 29), end: today };
  }

  if (mode === 'last4Months') {
    return { start: startOfMonth(subMonths(today, 3)), end: today };
  }

  if (mode === 'selectedMonth') {
    return { start: startOfMonth(selectedMonth), end: clampToToday(endOfMonth(selectedMonth), today) };
  }

  if (mode === 'custom') {
    return {
      start: clampToToday(customStartDate || today, today),
      end: clampToToday(customEndDate || customStartDate || today, today),
    };
  }

  return { start: startOfMonth(today), end: today };
};

export default function Insights() {
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [rangeMode, setRangeMode] = useState<RangeMode>('currentMonth');
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [customStartDate, setCustomStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | null>(new Date());
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  
  const selectedRange = useMemo(
    () => getPresetRange(rangeMode, selectedMonth, customStartDate, customEndDate),
    [customEndDate, customStartDate, rangeMode, selectedMonth]
  );

  const rangeLabel = `${format(selectedRange.start, 'dd MMM yyyy')} - ${format(selectedRange.end, 'dd MMM yyyy')}`;

  const filteredTransactions = useMemo(() => {
    const start = selectedRange.start <= selectedRange.end ? selectedRange.start : selectedRange.end;
    const end = selectedRange.start <= selectedRange.end ? selectedRange.end : selectedRange.start;
    return transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
  }, [selectedRange, transactions]);

  const categoryDataMemo = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const catMap = expenses.reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    return Object.entries(catMap)
      .map(([name, value]: any) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransactions]);

  useEffect(() => {
    setCategoryData(categoryDataMemo);
  }, [categoryDataMemo]);

  useEffect(() => {
    setInsights(null);
  }, [rangeMode, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => {
    if (isAfter(selectedMonth, currentMonthStart)) {
      setSelectedMonth(currentMonthStart);
    }

    if (customStartDate && isAfter(customStartDate, today)) {
      setCustomStartDate(today);
    }

    if (customEndDate && isAfter(customEndDate, today)) {
      setCustomEndDate(today);
    }
  });

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
      const start = selectedRange.start <= selectedRange.end ? selectedRange.start : selectedRange.end;
      const end = selectedRange.start <= selectedRange.end ? selectedRange.end : selectedRange.start;
      const transactionsInRange = data.filter((transaction: any) =>
        isWithinInterval(parseISO(transaction.date), { start, end })
      );

      if (!transactionsInRange.length) {
        setInsights(null);
        toast.info('No transactions found in the selected date range.');
        return;
      }

      const aiInsights = await getFinancialInsights(transactionsInRange);
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
          <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Powered by Gemini, with local AI fallback.</p>
        </div>
        <Button variant="outline" onClick={generateInsights} disabled={insightsLoading || transactionsLoading} className="gap-2">
          <RiRefreshLine className={cn("text-base", insightsLoading && "animate-spin")} aria-hidden="true" />
          {insights ? 'Regenerate AI Insights' : 'Generate AI Insights'}
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Insight Date Range</CardTitle>
          <CardDescription>{rangeLabel} • {filteredTransactions.length} transactions selected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Range</Label>
              <Select value={rangeMode} onValueChange={(value) => setRangeMode(value as RangeMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currentMonth">Current Month</SelectItem>
                  <SelectItem value="last30Days">Last 30 Days</SelectItem>
                  <SelectItem value="last4Months">Last 4 Months</SelectItem>
                  <SelectItem value="selectedMonth">Pick Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rangeMode === 'selectedMonth' && (
              <div className="space-y-2">
                <Label>Month</Label>
                <DatePicker
                  selected={selectedMonth}
                  onChange={(date) => date && setSelectedMonth(startOfMonth(clampToToday(date, today)))}
                  showMonthYearPicker
                  maxDate={currentMonthStart}
                  dateFormat="MMMM yyyy"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            )}

            {rangeMode === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker
                    selected={customStartDate}
                    onChange={(date) => setCustomStartDate(date)}
                    selectsStart
                    startDate={customStartDate}
                    endDate={customEndDate}
                    maxDate={customEndDate && !isAfter(customEndDate, today) ? customEndDate : today}
                    dateFormat="dd MMM yyyy"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker
                    selected={customEndDate}
                    onChange={(date) => setCustomEndDate(date)}
                    selectsEnd
                    startDate={customStartDate}
                    endDate={customEndDate}
                    minDate={customStartDate || undefined}
                    maxDate={today}
                    dateFormat="dd MMM yyyy"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main AI Insights */}
        <Card className="lg:col-span-2 border-none bg-gradient-to-br from-[#EEF6FF]/80 to-white text-[#1F2937] shadow-sm dark:from-[#10213A] dark:to-[#111827] dark:text-[#F8FAFC]">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#4F9CF9]">
              <RiSparkling2Line className="text-lg" aria-hidden="true" />
              <CardTitle className="text-xl text-[#1F2937] dark:text-[#F8FAFC]">AI Analysis</CardTitle>
            </div>
            <CardDescription className="text-[#6B7280] dark:text-[#CBD5E1]">
              Based on transactions from {rangeLabel}
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
              <div className="space-y-6">
                {insights.summary && (
                  <div className="rounded-lg border border-[#DCEBFF] bg-white/70 p-4 dark:border-[#334155] dark:bg-[#0F172A]/70">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1F2937] dark:text-[#F8FAFC]">
                      <RiSparkling2Line className="text-lg text-[#4F9CF9]" aria-hidden="true" />
                      AI Financial Analysis
                    </h3>
                    <p className="mt-2 leading-relaxed text-[#334155] dark:text-[#E2E8F0]">{insights.summary}</p>
                  </div>
                )}

                <div className="grid gap-4">
                  {insightSections.map(({ key, title }) => {
                    const items = insights[key];
                    if (!Array.isArray(items) || items.length === 0) return null;

                    return (
                      <section key={key} className="rounded-lg border border-[#DCEBFF] bg-white/70 p-4 dark:border-[#334155] dark:bg-[#0F172A]/70">
                        <h4 className="text-sm font-bold uppercase text-[#4F9CF9]">{title}</h4>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#334155] dark:text-[#E2E8F0]">
                          {items.map((item, index) => (
                            <li key={`${key}-${index}`} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#34C759]" aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="font-medium text-[#1F2937] dark:text-[#F8FAFC]">AI insights have not been generated yet.</p>
                <p className="mt-2 text-sm text-[#6B7280] dark:text-[#CBD5E1]">Click Generate AI Insights when you want to use AI tokens.</p>
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
                <div className="h-full flex items-center justify-center text-[#6B7280] dark:text-[#CBD5E1]">Loading data...</div>
              ) : categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#6B7280] dark:text-[#CBD5E1]">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis tickFormatter={(v) => `₹${v}`} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4F9CF9" radius={[4,4,0,0]} />
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
