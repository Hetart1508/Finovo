import { format, isAfter } from 'date-fns';

export type DateRange = {
  start: Date;
  end: Date;
};

export const getTodayDateString = () => format(new Date(), 'yyyy-MM-dd');

export const isFutureDateString = (date: string) => date > getTodayDateString();

export const clampToToday = (date: Date, today = new Date()) => (isAfter(date, today) ? today : date);

export const normalizeDateRange = (range: DateRange): DateRange => ({
  start: range.start <= range.end ? range.start : range.end,
  end: range.start <= range.end ? range.end : range.start,
});
