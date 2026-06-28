export type RecurringEvent = {
  id: number;
  name: string;
  amount: number;
  day_of_month: number;
  category: string;
  type: string;
  frequency?: 'monthly' | 'yearly';
  interval_count?: number;
  start_date?: string | null;
  payment_mode?: 'manual' | 'auto';
  autopay_enabled?: boolean | number;
  payment_account?: string | null;
  next_due_date?: string;
  days_until_due?: number;
};
