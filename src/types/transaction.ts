export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: number;
  type: TransactionType;
  date: string;
  description?: string;
  merchant_name?: string;
  payee_vpa?: string;
  category?: string;
  payment_mode?: string;
  amount: number;
  bill_url?: string;
};
