import { type CSSProperties, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-toastify';
import api from '@/src/lib/api';
import { addMonths, format, getDaysInMonth, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';

const getBalanceColorStyle = (netBalance: number, maxAbsBalance: number, isSelected: boolean): CSSProperties | undefined => {
  if (isSelected || netBalance === 0 || maxAbsBalance === 0) return undefined;

  const intensity = Math.min(Math.abs(netBalance) / maxAbsBalance, 1);
  const easedIntensity = Math.pow(intensity, 0.8);
  const hue = netBalance > 0 ? 151 : 350;
  const saturation = netBalance > 0 ? 66 : 76;
  const lightness = 96 - easedIntensity * 48;
  const borderLightness = Math.max(lightness - 15, 34);
  const textColor = easedIntensity > 0.55 ? "#ffffff" : netBalance > 0 ? "#064e3b" : "#7f1d1d";

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    borderColor: `hsl(${hue} ${saturation}% ${borderLightness}%)`,
    boxShadow: easedIntensity > 0.6 ? `0 8px 18px hsl(${hue} ${saturation}% ${borderLightness}% / 0.22)` : undefined,
    color: textColor,
  };
};

export default function CalendarView() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [transactions, setTransactions] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(1000);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tRes = await api.get('/transactions');
        setTransactions(tRes.data);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setThreshold(user.daily_threshold || 1000);
      } catch (error: any) {
        console.error(error);
        toast.error(getApiMessage(error, "Failed to fetch calendar transactions."));
      }
    };
    fetchData();
  }, []);
  const handleUpdateThreshold = async () => {
    try {
      const response = await api.patch('/user/threshold', { threshold });
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...user, daily_threshold: threshold }));
      toast.success(getApiSuccessMessage(response.data, "Daily threshold updated successfully"));
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to update threshold."));
    }
  };

  const getDailyTotal = (d: Date) => {
    return transactions
      .filter(t => t.type === 'expense' && isSameDay(parseISO(t.date), d))
      .reduce((acc, t) => acc + t.amount, 0);
  };

  const getDailySummary = (d: Date) => {
    return transactions
      .filter(t => isSameDay(parseISO(t.date), d))
      .reduce(
        (acc, transaction) => {
          if (transaction.type === 'income') acc.income += transaction.amount;
          if (transaction.type === 'expense') acc.expense += transaction.amount;
          acc.net = acc.income - acc.expense;
          return acc;
        },
        { income: 0, expense: 0, net: 0 }
      );
  };

  const selectedDayTransactions = transactions.filter(t => date && isSameDay(parseISO(t.date), date));
  const selectedDayTotal = date ? getDailyTotal(date) : 0;
  const selectedDaySummary = date ? getDailySummary(date) : { income: 0, expense: 0, net: 0 };
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: format(new Date(visibleMonth.getFullYear(), month, 1), 'MMMM'),
    label: format(new Date(visibleMonth.getFullYear(), month, 1), 'MMMM'),
    month,
  }));
  const selectedYear = visibleMonth.getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => selectedYear - 10 + index);
  const firstDay = startOfMonth(visibleMonth);
  const daysInMonth = getDaysInMonth(visibleMonth);
  const totalSlots = Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7;
  const calendarDays = Array.from({ length: totalSlots }, (_, index) => {
    const dayNumber = index - firstDay.getDay() + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber);
  });
  const maxAbsVisibleBalance = Math.max(
    ...calendarDays
      .filter((day): day is Date => day !== null)
      .map((day) => Math.abs(getDailySummary(day).net)),
    0
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Calendar</h1>
          <p className="text-slate-500">Track your daily spending patterns and stay within limits.</p>
        </div>
        
        <Popover>
          <PopoverTrigger>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Threshold: ₹{threshold}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Daily Spending Limit (₹)</Label>
                <p className="text-xs text-slate-500">Dates exceeding this will be highlighted in red.</p>
                <Input 
                  type="number" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseInt(e.target.value))} 
                />
              </div>
              <Button className="w-full" onClick={handleUpdateThreshold}>Save Threshold</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-visible">
          <CardContent className="p-0">
            <div className="overflow-visible rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between rounded-t-lg bg-red-600 px-4 py-3 text-white sm:px-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-center">
                  <p className="text-xl font-extrabold tracking-tight">Calendar</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Select
                      value={format(visibleMonth, 'MMMM')}
                      onValueChange={(monthName) => {
                        const nextMonth = monthOptions.find((month) => month.value === monthName)?.month ?? visibleMonth.getMonth();
                        setVisibleMonth(new Date(visibleMonth.getFullYear(), nextMonth, 1));
                      }}
                    >
                      <SelectTrigger className="h-8 w-32 border-white/30 bg-white/15 text-white shadow-none hover:bg-white/20 [&_svg]:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={String(visibleMonth.getFullYear())}
                      onValueChange={(year) => {
                        setVisibleMonth(new Date(Number(year), visibleMonth.getMonth(), 1));
                      }}
                    >
                      <SelectTrigger className="h-8 w-24 border-white/30 bg-white/15 text-white shadow-none hover:bg-white/20 [&_svg]:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-red-100">
                    Showing {format(visibleMonth, 'MMMM yyyy')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-3 sm:p-5">
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {weekdays.map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        "flex h-8 items-center justify-center text-[10px] font-bold uppercase tracking-wide sm:text-xs",
                        index === 0 || index === 6 ? "text-red-600" : "text-slate-500"
                      )}
                    >
                      {day.slice(0, 3)}
                    </div>
                  ))}

                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dailyTotal = getDailyTotal(day);
                    const dailySummary = getDailySummary(day);
                    const isSelected = date ? isSameDay(day, date) : false;
                    const isToday = isSameDay(day, new Date());
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isOverLimit = dailyTotal > threshold;
                    const hasTransactions = dailySummary.income > 0 || dailySummary.expense > 0;
                    const balanceColorStyle = getBalanceColorStyle(dailySummary.net, maxAbsVisibleBalance, isSelected);
                    const hasBalanceColor = Boolean(balanceColorStyle);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setDate(day)}
                        style={balanceColorStyle}
                        className={cn(
                          "group relative flex aspect-square w-full items-center justify-center rounded-md border border-transparent text-base font-extrabold transition sm:text-lg lg:text-xl",
                          !hasBalanceColor && (isWeekend ? "text-red-600" : "text-slate-950"),
                          isToday && !isSelected && !hasBalanceColor && "border-slate-300",
                          isOverLimit && !isSelected && dailySummary.net < 0 && "ring-2 ring-rose-500",
                          isSelected && "bg-red-600 text-white shadow-md shadow-red-600/20",
                          !hasBalanceColor && "hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                          hasBalanceColor && "hover:brightness-95"
                        )}
                        aria-label={`${format(day, 'dd MMMM yyyy')}: income ₹${dailySummary.income}, expense ₹${dailySummary.expense}, balance ₹${dailySummary.net}`}
                      >
                        {format(day, 'd')}
                        {hasTransactions && (
                          <span
                            className={cn(
                              "absolute bottom-2 h-1.5 w-1.5 rounded-full",
                              isSelected
                                ? "bg-white"
                                : dailySummary.net >= 0
                                  ? "bg-emerald-700"
                                  : "bg-rose-700"
                            )}
                          />
                        )}
                        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-medium text-slate-700 opacity-0 shadow-lg shadow-slate-900/10 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          <span className="block text-sm font-bold text-slate-950">{format(day, 'dd MMM yyyy')}</span>
                          <span className="mt-2 flex items-center justify-between">
                            <span className="text-slate-500">Income</span>
                            <span className="font-bold text-emerald-600">₹{dailySummary.income.toLocaleString()}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between">
                            <span className="text-slate-500">Expense</span>
                            <span className="font-bold text-rose-600">₹{dailySummary.expense.toLocaleString()}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between border-t border-slate-100 pt-1">
                            <span className="text-slate-500">Balance</span>
                            <span
                              className={cn(
                                "font-bold",
                                dailySummary.net > 0 && "text-emerald-600",
                                dailySummary.net < 0 && "text-rose-600",
                                dailySummary.net === 0 && "text-slate-700"
                              )}
                            >
                              {dailySummary.net >= 0 ? '+' : '-'}₹{Math.abs(dailySummary.net).toLocaleString()}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                {date ? format(date, 'dd MMMM yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Net Balance</p>
                    <h3
                      className={cn(
                        "mt-1 text-2xl font-bold",
                        selectedDaySummary.net > 0 && "text-emerald-600",
                        selectedDaySummary.net < 0 && "text-rose-600"
                      )}
                    >
                      {selectedDaySummary.net >= 0 ? '+' : '-'}₹{Math.abs(selectedDaySummary.net).toLocaleString()}
                    </h3>
                  </div>
                  {selectedDayTotal > threshold && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Over Limit
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Income</p>
                    <p className="mt-1 text-base font-bold text-emerald-600">₹{selectedDaySummary.income.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expense</p>
                    <p className="mt-1 text-base font-bold text-rose-600">₹{selectedDaySummary.expense.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Transactions</p>
                {selectedDayTransactions.length > 0 ? (
                  selectedDayTransactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{t.description || t.category}</p>
                        <p className="text-xs text-slate-500">{t.category} • {t.payment_mode}</p>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        t.type === 'income' ? "text-emerald-600" : "text-slate-900 dark:text-white"
                      )}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic py-4">No transactions on this day.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
