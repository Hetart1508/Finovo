import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format, isWithinInterval, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { AnalysisRange } from '../dashboard.constants';
import { getDateRange } from '../dashboard.utils';
import type { DashboardTransaction } from '../dashboard.types';

export function useDashboardAnalysis(transactions: DashboardTransaction[]) {
  const [selectedPreset, setSelectedPreset] = useState<AnalysisRange>('This-Month');
  const [activeRange, setActiveRange] = useState<AnalysisRange>('This-Month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const todayDateString = format(new Date(), 'yyyy-MM-dd');

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
    return transactions.filter((transaction) => isWithinInterval(parseISO(transaction.date), selectedRange));
  }, [hasInvalidCustomRange, selectedRange, transactions]);

  const rangeDescription = selectedRange
    ? `${format(selectedRange.start, 'dd MMM yyyy')} - ${format(selectedRange.end, 'dd MMM yyyy')}`
    : 'All transactions';

  const totalIncome = analysisTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const totalExpense = analysisTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const categoryData = Object.entries(
    analysisTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce<Record<string, number>>((acc, transaction) => {
        acc[transaction.category] = (acc[transaction.category] || 0) + transaction.amount;
        return acc;
      }, {})
  ).map(([name, value]) => ({ name, value }));

  const expenseTransactions = analysisTransactions.filter((transaction) => transaction.type === 'expense');
  const transactionDates = analysisTransactions.map((transaction) => parseISO(transaction.date));
  const effectiveRange = selectedRange ?? (transactionDates.length
    ? {
        start: new Date(Math.min(...transactionDates.map((date) => date.getTime()))),
        end: new Date(Math.max(...transactionDates.map((date) => date.getTime()))),
      }
    : null);
  const rangeDays = hasInvalidCustomRange || !effectiveRange
    ? 0
    : differenceInCalendarDays(effectiveRange.end, effectiveRange.start) + 1;
  const trendGranularity = rangeDays >= 90 ? 'monthly' : rangeDays >= 21 ? 'weekly' : 'daily';

  const dailyData = Array.from(expenseTransactions.reduce((buckets, transaction) => {
    const transactionDate = parseISO(transaction.date);
    const bucketDate = trendGranularity === 'monthly'
      ? startOfMonth(transactionDate)
      : trendGranularity === 'weekly'
        ? startOfWeek(transactionDate, { weekStartsOn: 1 })
        : transactionDate;
    const bucketKey = format(bucketDate, 'yyyy-MM-dd');
    const label = trendGranularity === 'monthly'
      ? format(bucketDate, 'MMM yyyy')
      : trendGranularity === 'weekly'
        ? `Week of ${format(bucketDate, 'dd MMM')}`
        : format(bucketDate, 'dd MMM');
    const existing = buckets.get(bucketKey);
    buckets.set(bucketKey, {
      name: label,
      amount: (existing?.amount || 0) + transaction.amount,
      timestamp: bucketDate.getTime(),
    });
    return buckets;
  }, new Map<string, { name: string; amount: number; timestamp: number }>()).values())
    .sort((first, second) => first.timestamp - second.timestamp)
    .map(({ name, amount }) => ({ name, amount }));

  const recentAnalysisTransactions = [...analysisTransactions]
    .sort((first, second) => parseISO(second.date).getTime() - parseISO(first.date).getTime())
    .slice(0, 5);

  const applyPreset = (preset: AnalysisRange) => {
    const presetRange = getDateRange(preset, customStartDate, customEndDate);
    setSelectedPreset(preset);
    setActiveRange(preset);
    if (preset !== 'Custom') {
      setCustomStartDate(presetRange ? format(presetRange.start, 'yyyy-MM-dd') : '');
      setCustomEndDate(presetRange ? format(presetRange.end, 'yyyy-MM-dd') : '');
    }
  };

  const applyCustomStartDate = (value: string) => {
    setCustomStartDate(value);
    setSelectedPreset('Custom');
    setActiveRange('Custom');
  };

  const applyCustomEndDate = (value: string) => {
    setCustomEndDate(value);
    setSelectedPreset('Custom');
    setActiveRange('Custom');
  };

  return {
    selectedPreset,
    activeRange,
    customStartDate,
    customEndDate,
    todayDateString,
    hasInvalidCustomRange,
    analysisTransactions,
    rangeDescription,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryData,
    dailyData,
    trendGranularity,
    recentAnalysisTransactions,
    applyPreset,
    applyCustomStartDate,
    applyCustomEndDate,
  };
}
