export type SortKey = 'type' | 'date' | 'description' | 'category' | 'payment_mode' | 'amount';
export type SortDirection = 'asc' | 'desc';

export type Transaction = {
  id: number;
  type: 'income' | 'expense';
  date: string;
  description?: string;
  merchant_name?: string;
  payee_vpa?: string;
  category?: string;
  payment_mode?: string;
  amount: number;
  bill_url?: string;
};
