import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { addMonths, format, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns';
import { toast } from 'react-toastify';
import { userApi } from '@/src/api/userApi';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { storageKeys } from '@/src/lib/storageKeys';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import { buildCalendarDays, getDailySummary, getDailyTotal, getStoredDailyThreshold } from '../calendar.utils';

export function useCalendarView(transactions: Transaction[]) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [threshold, setThreshold] = useState(getStoredDailyThreshold);
  const updateThreshold = useMutation({
    mutationFn: (nextThreshold: number) => userApi.updateThreshold(nextThreshold),
  });

  const selectedDayTransactions = useMemo(
    () => transactions.filter((transaction) => date && isSameDay(parseISO(transaction.date), date)),
    [date, transactions]
  );
  const selectedDayTotal = date ? getDailyTotal(transactions, date) : 0;
  const selectedDaySummary = date ? getDailySummary(transactions, date) : { income: 0, expense: 0, net: 0 };
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: format(new Date(visibleMonth.getFullYear(), month, 1), 'MMMM'),
    label: format(new Date(visibleMonth.getFullYear(), month, 1), 'MMMM'),
    month,
  }));
  const selectedYear = visibleMonth.getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => selectedYear - 10 + index);
  const { calendarDays, totalSlots } = buildCalendarDays(visibleMonth);
  const maxAbsVisibleBalance = Math.max(
    ...calendarDays
      .filter((day): day is Date => day !== null)
      .map((day) => Math.abs(getDailySummary(transactions, day).net)),
    0
  );

  const handleUpdateThreshold = async () => {
    try {
      const response = await updateThreshold.mutateAsync(threshold);
      const user = JSON.parse(localStorage.getItem(storageKeys.user) || '{}');
      localStorage.setItem(storageKeys.user, JSON.stringify({ ...user, daily_threshold: threshold }));
      toast.success(getApiSuccessMessage(response.data, 'Daily threshold updated successfully'));
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to update threshold.'));
    }
  };

  const selectMonth = (monthName: string) => {
    const nextMonth = monthOptions.find((month) => month.value === monthName)?.month ?? visibleMonth.getMonth();
    setVisibleMonth(new Date(visibleMonth.getFullYear(), nextMonth, 1));
  };

  const selectYear = (year: string) => {
    setVisibleMonth(new Date(Number(year), visibleMonth.getMonth(), 1));
  };

  return {
    date,
    setDate,
    visibleMonth,
    threshold,
    setThreshold,
    selectedDayTransactions,
    selectedDayTotal,
    selectedDaySummary,
    monthOptions,
    yearOptions,
    calendarDays,
    totalSlots,
    maxAbsVisibleBalance,
    handleUpdateThreshold,
    selectMonth,
    selectYear,
    previousMonth: () => setVisibleMonth(subMonths(visibleMonth, 1)),
    nextMonth: () => setVisibleMonth(addMonths(visibleMonth, 1)),
  };
}
