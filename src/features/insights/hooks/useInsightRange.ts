import { useEffect, useMemo, useState } from 'react';
import { format, isAfter, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import type { RangeMode } from '../insights.constants';
import { clampToToday, getPresetRange, normalizeDateRange } from '../insights.utils';

export function useInsightRange(transactions: Transaction[]) {
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
    const range = normalizeDateRange(selectedRange);
    return transactions.filter((transaction) => isWithinInterval(parseISO(transaction.date), range));
  }, [selectedRange, transactions]);

  const categoryData = useMemo(() => {
    const categoryTotals = filteredTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce<Record<string, number>>((acc, transaction) => {
        acc[transaction.category || 'Other'] = (acc[transaction.category || 'Other'] || 0) + transaction.amount;
        return acc;
      }, {});
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransactions]);

  useEffect(() => {
    if (isAfter(selectedMonth, currentMonthStart)) setSelectedMonth(currentMonthStart);
    if (customStartDate && isAfter(customStartDate, today)) setCustomStartDate(today);
    if (customEndDate && isAfter(customEndDate, today)) setCustomEndDate(today);
  });

  const selectMonth = (date: Date) => setSelectedMonth(startOfMonth(clampToToday(date, today)));

  return {
    rangeMode,
    setRangeMode,
    selectedMonth,
    selectMonth,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    today,
    currentMonthStart,
    selectedRange,
    rangeLabel,
    filteredTransactions,
    categoryData,
  };
}
