import { type CSSProperties, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { toast } from 'react-toastify';
import api from '@/src/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { transactionsQuery } from '@/src/lib/serverState';
import { addMonths, format, getDaysInMonth, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiSettings3Line,
} from 'react-icons/ri';

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
  const transactionsResult = useQuery(transactionsQuery());
  const transactions = transactionsResult.data ?? [];
  const [threshold, setThreshold] = useState(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.daily_threshold || 1000;
  });
  const updateThreshold = useMutation({
    mutationFn: (nextThreshold: number) => api.patch('/user/threshold', { threshold: nextThreshold }),
  });

  useEffect(() => {
    if (transactionsResult.error) {
      toast.error(getApiMessage(transactionsResult.error, "Failed to fetch calendar transactions."), { toastId: 'calendar-query-error' });
    }
  }, [transactionsResult.error]);
  const handleUpdateThreshold = async () => {
    try {
      const response = await updateThreshold.mutateAsync(threshold);
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
          <p className="text-[#6B7280]">Track your daily spending patterns and stay within limits.</p>
        </div>
        
        <Popover>
          <PopoverTrigger>
            <Button variant="outline" className="gap-2">
              <RiSettings3Line className="text-base" aria-hidden="true" />
              Threshold: ₹{threshold}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Daily Spending Limit (₹)</Label>
                <p className="text-xs text-[#6B7280]">Dates exceeding this will be highlighted in red.</p>
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
            <div className="overflow-visible rounded-lg border border-[#E5E7EB] bg-white">
              <div className="flex items-center justify-between rounded-t-lg bg-[#FF6B6B] px-4 py-3 text-white sm:px-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
                  aria-label="Previous month"
                >
                  <RiArrowLeftSLine className="text-lg" aria-hidden="true" />
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
                  <p className="mt-2 text-sm font-semibold text-white/85">
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
                  <RiArrowRightSLine className="text-lg" aria-hidden="true" />
                </Button>
              </div>

              <div className="p-3 sm:p-5">
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {weekdays.map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        "flex h-8 items-center justify-center text-[10px] font-bold uppercase tracking-wide sm:text-xs",
                        index === 0 || index === 6 ? "text-[#FF6B6B]" : "text-[#6B7280]"
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
                    const columnIndex = index % 7;
                    const rowIndex = Math.floor(index / 7);
                    const totalRows = totalSlots / 7;
                    const shouldOpenUp = rowIndex >= totalRows - 2;

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setDate(day)}
                        style={balanceColorStyle}
                        className={cn(
                          "group relative flex aspect-square w-full items-center justify-center rounded-md border border-transparent text-base font-extrabold transition hover:z-50 focus-visible:z-50 sm:text-lg lg:text-xl",
                          !hasBalanceColor && (isWeekend ? "text-[#FF6B6B]" : "text-[#1F2937]"),
                          isToday && !isSelected && !hasBalanceColor && "border-[#E5E7EB]",
                          isOverLimit && !isSelected && dailySummary.net < 0 && "ring-2 ring-[#FF6B6B]",
                          isSelected && "bg-[#FF6B6B] text-white shadow-md shadow-[#FF6B6B]/20",
                          !hasBalanceColor && "hover:border-[#FF6B6B] hover:bg-[#FFF1F1] hover:text-[#FF6B6B]",
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
                                  ? "bg-[#34C759]"
                                  : "bg-[#FF6B6B]"
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "pointer-events-none absolute z-50 w-44 rounded-md border border-[#E5E7EB] bg-white p-3 text-left text-xs font-medium text-[#1F2937] opacity-0 shadow-xl shadow-[#1F2937]/15 transition group-hover:opacity-100 group-focus-visible:opacity-100",
                            columnIndex === 0 && "left-0",
                            columnIndex === 6 && "right-0",
                            columnIndex > 0 && columnIndex < 6 && "left-1/2 -translate-x-1/2",
                            shouldOpenUp ? "bottom-full mb-2" : "top-full mt-2"
                          )}
                        >
                          <span className="block text-sm font-bold text-[#1F2937]">{format(day, 'dd MMM yyyy')}</span>
                          <span className="mt-2 flex items-center justify-between">
                            <span className="text-[#6B7280]">Income</span>
                            <span className="font-bold text-[#34C759]">₹{dailySummary.income.toLocaleString()}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between">
                            <span className="text-[#6B7280]">Expense</span>
                            <span className="font-bold text-[#FF6B6B]">₹{dailySummary.expense.toLocaleString()}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between border-t border-[#E5E7EB] pt-1">
                            <span className="text-[#6B7280]">Balance</span>
                            <span
                              className={cn(
                                "font-bold",
                                dailySummary.net > 0 && "text-[#34C759]",
                                dailySummary.net < 0 && "text-[#FF6B6B]",
                                dailySummary.net === 0 && "text-[#1F2937]"
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
            <CardHeader className="text-center">
              <CardTitle className="text-lg">
                {date ? format(date, 'dd MMMM yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="space-y-4 rounded-xl bg-[#FAFBFC] p-4 dark:bg-[#FAFBFC]">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="text-sm text-[#6B7280]">Net Balance</p>
                    <h3
                      className={cn(
                        "mt-1 text-2xl font-bold",
                        selectedDaySummary.net > 0 && "text-[#34C759]",
                        selectedDaySummary.net < 0 && "text-[#FF6B6B]"
                      )}
                    >
                      {selectedDaySummary.net >= 0 ? '+' : '-'}₹{Math.abs(selectedDaySummary.net).toLocaleString()}
                    </h3>
                  </div>
                  {selectedDayTotal > threshold && (
                    <Badge variant="destructive" className="gap-1">
                      <RiErrorWarningLine className="text-xs" aria-hidden="true" />
                      Over Limit
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 dark:bg-[#4F9CF9]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Income</p>
                    <p className="mt-1 text-base font-bold text-[#34C759]">₹{selectedDaySummary.income.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 dark:bg-[#4F9CF9]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Expense</p>
                    <p className="mt-1 text-base font-bold text-[#FF6B6B]">₹{selectedDaySummary.expense.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#6B7280]">Transactions</p>
                {selectedDayTransactions.length > 0 ? (
                  selectedDayTransactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-[#E5E7EB] dark:border-[#E5E7EB] last:border-0">
                      <div>
                        <p className="text-sm font-medium">{t.description || t.category}</p>
                        <p className="text-xs text-[#6B7280]">{t.category} • {t.payment_mode}</p>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        t.type === 'income' ? "text-[#34C759]" : "text-[#1F2937] text-[#FF6B6B]"
                      )}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280] italic py-4">No transactions on this day.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
