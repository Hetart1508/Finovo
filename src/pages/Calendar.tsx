import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useQuery } from '@tanstack/react-query';
import { transactionsQuery } from '@/src/server-state/transactionsQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import { CalendarDayDetailsCard } from '@/src/features/calendar/components/CalendarDayDetailsCard';
import { CalendarHeader } from '@/src/features/calendar/components/CalendarHeader';
import { CalendarMonthCard } from '@/src/features/calendar/components/CalendarMonthCard';
import { useCalendarView } from '@/src/features/calendar/hooks/useCalendarView';
import type { Transaction } from '@/src/features/transactions/transactions.types';

export default function CalendarView() {
  const transactionsResult = useQuery(transactionsQuery());
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const calendar = useCalendarView(transactions);

  useEffect(() => {
    if (transactionsResult.error) {
      toast.error(getApiMessage(transactionsResult.error, 'Failed to fetch calendar transactions.'), { toastId: 'calendar-query-error' });
    }
  }, [transactionsResult.error]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <CalendarHeader
        threshold={calendar.threshold}
        onThresholdChange={calendar.setThreshold}
        onSaveThreshold={calendar.handleUpdateThreshold}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <CalendarMonthCard
          selectedDate={calendar.date}
          visibleMonth={calendar.visibleMonth}
          threshold={calendar.threshold}
          transactions={transactions}
          monthOptions={calendar.monthOptions}
          yearOptions={calendar.yearOptions}
          calendarDays={calendar.calendarDays}
          totalSlots={calendar.totalSlots}
          maxAbsVisibleBalance={calendar.maxAbsVisibleBalance}
          onSelectDate={calendar.setDate}
          onPreviousMonth={calendar.previousMonth}
          onNextMonth={calendar.nextMonth}
          onMonthChange={calendar.selectMonth}
          onYearChange={calendar.selectYear}
        />

        <div className="space-y-6">
          <CalendarDayDetailsCard
            selectedDate={calendar.date}
            transactions={calendar.selectedDayTransactions}
            selectedDayTotal={calendar.selectedDayTotal}
            selectedDaySummary={calendar.selectedDaySummary}
            threshold={calendar.threshold}
          />
        </div>
      </div>
    </div>
  );
}
