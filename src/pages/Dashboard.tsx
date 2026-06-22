import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { dashboardTransactionsQuery, recurringQuery } from '@/src/lib/serverState';
import { endOfMonth, endOfWeek, format, isWithinInterval, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-toastify';
import { getApiMessage } from '@/src/lib/toastMessages';
import {
  RiArrowLeftDownLine,
  RiArrowRightUpLine,
  RiCalendarCheckLine,
  RiErrorWarningLine,
  RiWallet3Line,
} from 'react-icons/ri';

const COLORS = ['#4F9CF9', '#34C759', '#FFB84D', '#FF6B6B', '#6B7280', '#EEF6FF', '#E5E7EB'];

type RangePreset = 'This-Month' | 'Last-Month' | 'This-Week' | 'Last-Week' | 'Last-3-Months' | 'Last-6-Months' | 'All';
type AnalysisRange = RangePreset | 'Custom';

const rangeLabels: Record<AnalysisRange, string> = {
  'This-Month': 'This-Month',
  'Last-Month': 'Last-Month',
  'This-Week': 'This-Week',
  'Last-Week': 'Last-Week',
  'Last-3-Months': 'Last-3-Months',
  'Last-6-Months': 'Last-6-Months',
  All: 'All',
  Custom: 'Custom',
};

const getDateRange = (preset: AnalysisRange, customStart: string, customEnd: string) => {
  const today = new Date();
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  if (preset === 'All') return null;

  if (preset === 'Custom') {
    if (!customStart || !customEnd) return null;
    const start = parseISO(customStart);
    const end = parseISO(customEnd);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'Last-Month') {
    const previousMonth = subMonths(today, 1);
    return { start: startOfMonth(previousMonth), end: endOfMonth(previousMonth) };
  }

  if (preset === 'This-Week') {
    return { start: startOfWeek(today, { weekStartsOn: 1 }), end: todayEnd };
  }

  if (preset === 'Last-Week') {
    const previousWeek = subWeeks(today, 1);
    return {
      start: startOfWeek(previousWeek, { weekStartsOn: 1 }),
      end: endOfWeek(previousWeek, { weekStartsOn: 1 }),
    };
  }

  if (preset === 'Last-3-Months') {
    return { start: subMonths(today, 3), end: todayEnd };
  }

  if (preset === 'Last-6-Months') {
    return { start: subMonths(today, 6), end: todayEnd };
  }

  return { start: startOfMonth(today), end: todayEnd };
};

export default function Dashboard() {
  const transactionsResult = useQuery(dashboardTransactionsQuery());
  const recurringResult = useQuery(recurringQuery());
  const transactions = transactionsResult.data ?? [];
  const recurring = recurringResult.data ?? [];
  const loading = transactionsResult.isPending || recurringResult.isPending;
  const [selectedPreset, setSelectedPreset] = useState<AnalysisRange>('This-Month');
  const [activeRange, setActiveRange] = useState<AnalysisRange>('This-Month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const todayDateString = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const error = transactionsResult.error || recurringResult.error;
    if (error) toast.error(getApiMessage(error, "Failed to fetch dashboard data."), { toastId: 'dashboard-query-error' });
  }, [recurringResult.error, transactionsResult.error]);

  const selectedRange = useMemo(
    () => getDateRange(activeRange, customStartDate, customEndDate),
    [activeRange, customEndDate, customStartDate]
  );

  const hasInvalidCustomRange =
    activeRange === 'Custom' &&
    Boolean(customStartDate && customEndDate) &&
    customStartDate > customEndDate;

  const analysisTransactions = useMemo(() => {
    if (hasInvalidCustomRange) return [];
    if (!selectedRange) return transactions;

    return transactions.filter(t =>
      isWithinInterval(parseISO(t.date), selectedRange)
    );
  }, [hasInvalidCustomRange, selectedRange, transactions]);

  const rangeDescription = selectedRange
    ? `${format(selectedRange.start, 'dd MMM yyyy')} - ${format(selectedRange.end, 'dd MMM yyyy')}`
    : 'All transactions';

  const totalIncome = analysisTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = analysisTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const categoryData = Object.entries(
    analysisTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {})
  ).map(([name, value]) => ({ name, value }));

  const dailyData = Object.entries(
    analysisTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any, t) => {
        const day = format(parseISO(t.date), 'dd MMM');
        acc[day] = (acc[day] || 0) + t.amount;
        return acc;
      }, {})
  ).map(([name, amount]) => ({ name, amount })).reverse();

  const recentAnalysisTransactions = [...analysisTransactions]
    .sort((first, second) => parseISO(second.date).getTime() - parseISO(first.date).getTime())
    .slice(0, 5);

  if (loading) return <div className="flex h-full items-center justify-center text-sm font-semibold text-[#6B7280]">Loading dashboard...</div>;

  return (
    <div className="kt-enter space-y-8">
      <div className="surface-panel metronic-surface rounded-lg p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Financial overview</p>
            <h1 className="mt-2 text-3xl font-black text-[#1F2937]">{rangeLabels[activeRange]} money movement</h1>
            <p className="mt-2 text-sm text-[#6B7280]">{rangeDescription}</p>
            {hasInvalidCustomRange ? (
              <p className="mt-2 text-sm font-semibold text-[#FF6B6B]">Start date must be before or equal to end date.</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <div className="flex flex-col gap-3 lg:flex-row">
              <Select
                value={selectedPreset}
                onValueChange={(value) => {
                  const preset = value as AnalysisRange;
                  const presetRange = getDateRange(preset, customStartDate, customEndDate);
                  setSelectedPreset(preset);
                  setActiveRange(preset);
                  if (preset !== 'Custom') {
                    setCustomStartDate(presetRange ? format(presetRange.start, 'yyyy-MM-dd') : '');
                    setCustomEndDate(presetRange ? format(presetRange.end, 'yyyy-MM-dd') : '');
                  }
                }}
              >
                <SelectTrigger className="h-10 w-full bg-white sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="This-Month">This-Month</SelectItem>
                  <SelectItem value="Last-Month">Last-Month</SelectItem>
                  <SelectItem value="This-Week">This-Week</SelectItem>
                  <SelectItem value="Last-Week">Last-Week</SelectItem>
                  <SelectItem value="Last-3-Months">Last-3-Months</SelectItem>
                  <SelectItem value="Last-6-Months">Last-6-Months</SelectItem>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <AppDatePicker
                  max={todayDateString}
                  value={customStartDate}
                  onChange={(value) => {
                    setCustomStartDate(value);
                    setSelectedPreset('Custom');
                    setActiveRange('Custom');
                  }}
                  placeholder="Start date"
                />
                <AppDatePicker
                  max={todayDateString}
                  min={customStartDate || undefined}
                  value={customEndDate}
                  onChange={(value) => {
                    setCustomEndDate(value);
                    setSelectedPreset('Custom');
                    setActiveRange('Custom');
                  }}
                  placeholder="End date"
                />
              </div>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase text-[#6B7280]">Transactions</p>
              <p className="text-2xl font-black text-[#1F2937]">{analysisTransactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-income">
                <RiArrowRightUpLine className="text-lg" aria-hidden="true" />
              </div>
              <Badge variant="outline" className="border-[#EAFBF0] text-[#34C759]">{rangeLabels[activeRange]}</Badge>
            </div>
            <p className="text-sm text-[#6B7280] font-medium">Total Income</p>
            <h3 className="text-2xl font-bold mt-1">₹{totalIncome.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-expense">
                <RiArrowLeftDownLine className="text-lg" aria-hidden="true" />
              </div>
              <Badge variant="outline" className="border-[#FFF1F1] text-[#FF6B6B]">{rangeLabels[activeRange]}</Badge>
            </div>
            <p className="text-sm text-[#6B7280] font-medium">Total Expenses</p>
            <h3 className="text-2xl font-bold mt-1">₹{totalExpense.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="compact-metric-card border-none bg-[#4F9CF9] text-white shadow-[0_18px_45px_rgba(79,156,249,0.24)]">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                <RiWallet3Line className="text-lg" aria-hidden="true" />
              </div>
              <Badge variant="outline" className="text-white border-white/30">Current</Badge>
            </div>
            <p className="text-sm text-white/80 font-medium">Net Balance</p>
            <h3 className="text-2xl font-bold mt-1">₹{balance.toLocaleString()}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spending Trend */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Spending Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => [`₹${v}`, 'Amount']}
                />
                <Line type="monotone" dataKey="amount" stroke="#4F9CF9" strokeWidth={3} dot={{ r: 4, fill: '#4F9CF9' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-2">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-[#6B7280]">{item.name}</span>
                  </div>
                  <span className="font-medium">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions */}
        <Card className="surface-panel rounded-lg lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-[#4F9CF9]" render={<Link to="/transactions" />}>View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAnalysisTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-[#FAFBFC] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      t.type === 'income' ? "icon-income" : "icon-expense"
                    )}>
                      {t.type === 'income' ? <RiArrowRightUpLine className="text-lg" aria-hidden="true" /> : <RiArrowLeftDownLine className="text-lg" aria-hidden="true" />}
                    </div>
                    <div>
                      <p className="font-medium">{t.description || t.category}</p>
                      <p className="text-xs text-[#6B7280]">{format(parseISO(t.date), 'dd MMM yyyy')} • {t.payment_mode}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "font-bold",
                    t.type === 'income' ? "text-[#34C759]" : "text-[#FF6B6B]"
                  )}>
                    {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                  </p>
                </div>
              ))}
              {recentAnalysisTransactions.length === 0 && <p className="text-center text-[#6B7280] py-8">No transactions found for this range.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recurring Reminders */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recurring.map((r) => (
                <div key={r.id} className="flex items-start gap-4 p-3 border border-[#E5E7EB] rounded-xl">
                  <div className="p-2 icon-upcoming rounded-lg">
                    <RiCalendarCheckLine aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-[#6B7280]">Due on {r.day_of_month}th • ₹{r.amount.toLocaleString()}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase">{r.type}</Badge>
                </div>
              ))}
              {recurring.length === 0 && (
                <div className="text-center py-8">
                  <RiErrorWarningLine className="mx-auto mb-2 text-3xl text-[#FFB84D]" aria-hidden="true" />
                  <p className="text-sm text-[#6B7280]">No recurring payments set.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
