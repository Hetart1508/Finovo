import type { CSSProperties } from 'react';
import { getDaysInMonth, isSameDay, parseISO, startOfMonth } from 'date-fns';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import { storageKeys } from '@/src/lib/storageKeys';
import type { DailySummary } from './calendar.types';

export const getBalanceColorStyle = (
  netBalance: number,
  maxAbsBalance: number,
  isSelected: boolean
): CSSProperties | undefined => {
  if (isSelected || netBalance === 0 || maxAbsBalance === 0) return undefined;

  const intensity = Math.min(Math.abs(netBalance) / maxAbsBalance, 1);
  const easedIntensity = Math.pow(intensity, 0.8);
  const isPositive = netBalance > 0;
  const backgroundOpacity = 0.1 + easedIntensity * 0.24;
  const borderOpacity = 0.1 + easedIntensity * 0.16;
  const rgb = isPositive ? '52, 199, 89' : '255, 107, 107';

  return {
    backgroundColor: `rgba(${rgb}, ${backgroundOpacity})`,
    borderColor: `rgba(${rgb}, ${borderOpacity})`,
    boxShadow: easedIntensity > 0.6 ? `0 6px 14px rgba(${rgb}, 0.08)` : undefined,
    color: isPositive ? '#218A44' : '#D94B4B',
  };
};

export const getDailySummary = (transactions: Transaction[], day: Date): DailySummary => (
  transactions
    .filter((transaction) => isSameDay(parseISO(transaction.date), day))
    .reduce(
      (summary, transaction) => {
        if (transaction.type === 'income') summary.income += transaction.amount;
        if (transaction.type === 'expense') summary.expense += transaction.amount;
        summary.net = summary.income - summary.expense;
        return summary;
      },
      { income: 0, expense: 0, net: 0 }
    )
);

export const getDailyTotal = (transactions: Transaction[], day: Date) => (
  transactions
    .filter((transaction) => transaction.type === 'expense' && isSameDay(parseISO(transaction.date), day))
    .reduce((total, transaction) => total + transaction.amount, 0)
);

export const buildCalendarDays = (visibleMonth: Date) => {
  const firstDay = startOfMonth(visibleMonth);
  const daysInMonth = getDaysInMonth(visibleMonth);
  const totalSlots = Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7;
  const calendarDays = Array.from({ length: totalSlots }, (_, index) => {
    const dayNumber = index - firstDay.getDay() + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber);
  });

  return { calendarDays, totalSlots };
};

export const getStoredDailyThreshold = () => {
  const user = JSON.parse(localStorage.getItem(storageKeys.user) || '{}');
  return user.daily_threshold || 1000;
};
