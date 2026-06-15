import { useEffect, useState } from 'react';
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

  const selectedDayTransactions = transactions.filter(t => date && isSameDay(parseISO(t.date), date));
  const selectedDayTotal = date ? getDailyTotal(date) : 0;
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: String(month),
    label: format(new Date(visibleMonth.getFullYear(), month, 1), 'MMMM'),
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
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between bg-red-600 px-4 py-3 text-white sm:px-6">
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
                      value={String(visibleMonth.getMonth())}
                      onValueChange={(month) => {
                        setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(month), 1));
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
                    const isSelected = date ? isSameDay(day, date) : false;
                    const isToday = isSameDay(day, new Date());
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isOverLimit = dailyTotal > threshold;
                    const hasSpending = dailyTotal > 0;

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setDate(day)}
                        className={cn(
                          "relative flex aspect-square w-full items-center justify-center rounded-md border border-transparent text-base font-extrabold transition sm:text-lg lg:text-xl",
                          isWeekend ? "text-red-600" : "text-slate-950",
                          isToday && !isSelected && "border-slate-300",
                          hasSpending && !isSelected && "bg-indigo-50",
                          isOverLimit && !isSelected && "bg-red-50 ring-2 ring-red-300",
                          isSelected && "bg-red-600 text-white shadow-md shadow-red-600/20",
                          "hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        )}
                        aria-label={format(day, 'dd MMMM yyyy')}
                      >
                        {format(day, 'd')}
                        {hasSpending && (
                          <span
                            className={cn(
                              "absolute bottom-2 h-1.5 w-1.5 rounded-full",
                              isSelected ? "bg-white" : isOverLimit ? "bg-red-600" : "bg-indigo-500"
                            )}
                          />
                        )}
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
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <p className="text-sm text-slate-500">Total Spending</p>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-2xl font-bold">₹{selectedDayTotal.toLocaleString()}</h3>
                  {selectedDayTotal > threshold && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Over Limit
                    </Badge>
                  )}
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
