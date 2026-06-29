import type { CSSProperties } from 'react';
import { getDaysInMonth, isSameDay, parseISO, startOfMonth } from 'date-fns';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import type { DailySummary } from './calendar.types';

export const getBalanceColorStyle = (
  netBalance: number,
  maxAbsBalance: number,
  isSelected: boolean
): CSSProperties | undefined => {
  if (isSelected || netBalance === 0 || maxAbsBalance === 0) return undefined;

  const intensity = Math.min(Math.abs(netBalance) / maxAbsBalance, 1);
  const easedIntensity = Math.pow(intensity, 0.8);
  const hue = netBalance > 0 ? 151 : 350;
  const saturation = netBalance > 0 ? 66 : 76;
  const lightness = 96 - easedIntensity * 48;
  const borderLightness = Math.max(lightness - 15, 34);
  const textColor = easedIntensity > 0.55 ? '#ffffff' : netBalance > 0 ? '#064e3b' : '#7f1d1d';

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    borderColor: `hsl(${hue} ${saturation}% ${borderLightness}%)`,
    boxShadow: easedIntensity > 0.6 ? `0 8px 18px hsl(${hue} ${saturation}% ${borderLightness}% / 0.22)` : undefined,
    color: textColor,
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
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.daily_threshold || 1000;
};
