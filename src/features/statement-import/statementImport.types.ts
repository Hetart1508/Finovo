export type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  payment_mode: string;
  vpa: string | null;
  merchant_name: string | null;
  original_description: string;
  alias_status: 'matched' | 'unknown' | 'not_applicable';
};

export type StatementTotals = {
  income: number;
  expense: number;
};
