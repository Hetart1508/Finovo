import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns';
import { clampToToday, normalizeDateRange } from '@/src/utils/dateRanges';
import type { RangeMode } from './insights.constants';

export { clampToToday, normalizeDateRange };

export const getPresetRange = (
  mode: RangeMode,
  selectedMonth: Date,
  customStartDate: Date | null,
  customEndDate: Date | null
) => {
  const today = new Date();

  if (mode === 'last30Days') {
    return { start: subDays(today, 29), end: today };
  }

  if (mode === 'last4Months') {
    return { start: startOfMonth(subMonths(today, 3)), end: today };
  }

  if (mode === 'selectedMonth') {
    return { start: startOfMonth(selectedMonth), end: clampToToday(endOfMonth(selectedMonth), today) };
  }

  if (mode === 'custom') {
    return {
      start: clampToToday(customStartDate || today, today),
      end: clampToToday(customEndDate || customStartDate || today, today),
    };
  }

  return { start: startOfMonth(today), end: today };
};
