import { format, isSameDay } from 'date-fns';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';
import { getBalanceColorStyle, getDailySummary, getDailyTotal } from '../calendar.utils';

type MonthOption = {
  value: string;
  label: string;
  month: number;
};

type CalendarMonthCardProps = {
  selectedDate: Date | undefined;
  visibleMonth: Date;
  threshold: number;
  transactions: Transaction[];
  monthOptions: MonthOption[];
  yearOptions: number[];
  calendarDays: (Date | null)[];
  totalSlots: number;
  maxAbsVisibleBalance: number;
  onSelectDate: (date: Date) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (month: string) => void;
  onYearChange: (year: string) => void;
};

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CalendarMonthCard({
  selectedDate,
  visibleMonth,
  threshold,
  transactions,
  monthOptions,
  yearOptions,
  calendarDays,
  totalSlots,
  maxAbsVisibleBalance,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  onMonthChange,
  onYearChange,
}: CalendarMonthCardProps) {
  return (
    <Card className="lg:col-span-2 border-none shadow-sm overflow-visible">
      <CardContent className="p-0">
        <div className="overflow-visible rounded-lg border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between rounded-t-lg bg-[#FF6B6B] px-4 py-3 text-white sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
              onClick={onPreviousMonth}
              aria-label="Previous month"
            >
              <RiArrowLeftSLine className="text-lg" aria-hidden="true" />
            </Button>
            <div className="text-center">
              <p className="text-xl font-extrabold tracking-tight">Calendar</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Select value={format(visibleMonth, 'MMMM')} onValueChange={onMonthChange}>
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

                <Select value={String(visibleMonth.getFullYear())} onValueChange={onYearChange}>
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
              onClick={onNextMonth}
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
                    'flex h-8 items-center justify-center text-[10px] font-bold uppercase tracking-wide sm:text-xs',
                    index === 0 || index === 6 ? 'text-[#FF6B6B]' : 'text-[#6B7280]'
                  )}
                >
                  {day.slice(0, 3)}
                </div>
              ))}

              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="aspect-square" />;

                const dailyTotal = getDailyTotal(transactions, day);
                const dailySummary = getDailySummary(transactions, day);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
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
                    onClick={() => onSelectDate(day)}
                    style={balanceColorStyle}
                    className={cn(
                      'group relative flex aspect-square w-full items-center justify-center rounded-md border border-transparent text-base font-extrabold transition hover:z-50 focus-visible:z-50 sm:text-lg lg:text-xl',
                      !hasBalanceColor && (isWeekend ? 'text-[#FF6B6B]' : 'text-[#1F2937]'),
                      isToday && !isSelected && !hasBalanceColor && 'border-[#E5E7EB]',
                      isOverLimit && !isSelected && dailySummary.net < 0 && 'ring-2 ring-[#FF6B6B]',
                      isSelected && 'bg-[#FF6B6B] text-white shadow-md shadow-[#FF6B6B]/20',
                      !hasBalanceColor && 'hover:border-[#FF6B6B] hover:bg-[#FFF1F1] hover:text-[#FF6B6B]',
                      hasBalanceColor && 'hover:brightness-95'
                    )}
                    aria-label={`${format(day, 'dd MMMM yyyy')}: income ₹${dailySummary.income}, expense ₹${dailySummary.expense}, balance ₹${dailySummary.net}`}
                  >
                    {format(day, 'd')}
                    {hasTransactions && (
                      <span
                        className={cn(
                          'absolute bottom-2 h-1.5 w-1.5 rounded-full',
                          isSelected ? 'bg-white' : dailySummary.net >= 0 ? 'bg-[#34C759]' : 'bg-[#FF6B6B]'
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'pointer-events-none absolute z-50 w-44 rounded-md border border-[#E5E7EB] bg-white p-3 text-left text-xs font-medium text-[#1F2937] opacity-0 shadow-xl shadow-[#1F2937]/15 transition group-hover:opacity-100 group-focus-visible:opacity-100',
                        columnIndex === 0 && 'left-0',
                        columnIndex === 6 && 'right-0',
                        columnIndex > 0 && columnIndex < 6 && 'left-1/2 -translate-x-1/2',
                        shouldOpenUp ? 'bottom-full mb-2' : 'top-full mt-2'
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
                            'font-bold',
                            dailySummary.net > 0 && 'text-[#34C759]',
                            dailySummary.net < 0 && 'text-[#FF6B6B]',
                            dailySummary.net === 0 && 'text-[#1F2937]'
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
  );
}
