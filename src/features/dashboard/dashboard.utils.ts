import { endOfMonth, endOfWeek, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import type { AnalysisRange } from './dashboard.constants';

export const getDateRange = (preset: AnalysisRange, customStart: string, customEnd: string) => {
  const today = new Date();
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  if (preset === 'All') return null;

  if (preset === 'Custom') {
    if (!customStart || !customEnd) return null;
    const start = parseISO(customStart);
    const end = parseISO(customEnd);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'Last-Month') {
    const previousMonth = subMonths(today, 1);
    return { start: startOfMonth(previousMonth), end: endOfMonth(previousMonth) };
  }

  if (preset === 'This-Week') {
    return { start: startOfWeek(today, { weekStartsOn: 1 }), end: todayEnd };
  }

  if (preset === 'Last-Week') {
    const previousWeek = subWeeks(today, 1);
    return {
      start: startOfWeek(previousWeek, { weekStartsOn: 1 }),
      end: endOfWeek(previousWeek, { weekStartsOn: 1 }),
    };
  }

  if (preset === 'Last-3-Months') {
    return { start: subMonths(today, 3), end: todayEnd };
  }

  if (preset === 'Last-6-Months') {
    return { start: subMonths(today, 6), end: todayEnd };
  }

  return { start: startOfMonth(today), end: todayEnd };
};
