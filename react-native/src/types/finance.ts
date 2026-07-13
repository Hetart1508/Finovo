export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: number;
  wallet_id?: number;
  created_by_name?: string | null;
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

export type Wallet = {
  id: number;
  name: string;
  type: 'personal' | 'family';
  owner_user_id: number;
  monthly_expense_target: number | null;
  role: 'owner' | 'member';
  member_count: number;
};
