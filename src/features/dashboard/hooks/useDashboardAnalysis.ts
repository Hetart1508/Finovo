import { useMemo, useState } from 'react';
import { format, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
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

  const dailyData = Object.entries(
    analysisTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce<Record<string, number>>((acc, transaction) => {
        const day = format(parseISO(transaction.date), 'dd MMM');
        acc[day] = (acc[day] || 0) + transaction.amount;
        return acc;
      }, {})
  ).map(([name, amount]) => ({ name, amount })).reverse();

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
    recentAnalysisTransactions,
    applyPreset,
    applyCustomStartDate,
    applyCustomEndDate,
  };
}
