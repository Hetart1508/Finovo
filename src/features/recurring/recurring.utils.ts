import { format, parseISO } from 'date-fns';
import type { RecurringEvent } from './recurring.types';

export const getScheduleLabel = (event: RecurringEvent) => {
  const frequency = event.frequency || 'monthly';
  const interval = Number(event.interval_count) || 1;
  const unit = frequency === 'yearly' ? 'year' : 'month';
  const intervalText = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  return `${intervalText} on day ${event.day_of_month}`;
};

export const getDueLabel = (event: RecurringEvent) => {
  if (typeof event.days_until_due !== 'number') return getScheduleLabel(event);
  if (event.days_until_due === 0) return 'Due today';
  if (event.days_until_due === 1) return 'Due tomorrow';
  return `Due in ${event.days_until_due} days`;
};

export const getDateFromDayOfMonth = (dayOfMonth: number) => {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, lastDayOfMonth));
};

export const getDateFromEvent = (event: RecurringEvent) => (
  event.start_date ? parseISO(event.start_date) : getDateFromDayOfMonth(event.day_of_month)
);

export const getDateStringFromEvent = (event: RecurringEvent) => format(getDateFromEvent(event), 'yyyy-MM-dd');

export const getTypeClassName = (type: string) => {
  if (type === 'income') return 'border-[#EAFBF0] text-[#34C759]';
  if (type === 'investment') return 'border-[#EEF6FF] text-[#4F9CF9]';
  if (type === 'service') return 'border-[#FFF7E8] text-[#FFB84D]';
  return 'border-[#FFF1F1] text-[#FF6B6B]';
};

export const getAmountClassName = (type: string) => (
  type === 'income' ? 'text-[#34C759]' : type === 'investment' ? 'text-[#4F9CF9]' : 'text-[#FF6B6B]'
);
