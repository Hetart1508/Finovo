export type DashboardTransaction = {
  id: number;
  type: 'income' | 'expense';
  date: string;
  description?: string;
  category: string;
  payment_mode: string;
  amount: number;
};

export type DailyDataPoint = {
  name: string;
  amount: number;
};

export type CategoryDataPoint = {
  name: string;
  value: number;
};
