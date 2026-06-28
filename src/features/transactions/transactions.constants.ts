import type { SortKey } from './transactions.types';

export const ITEMS_PER_PAGE = 10;

export const sortLabels: Record<SortKey, string> = {
  type: 'Type',
  date: 'Date',
  description: 'Description',
  category: 'Category',
  payment_mode: 'Mode',
  amount: 'Amount',
};

export const transactionCategories = ['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other', 'Salary'];

export const paymentModes = ['UPI', 'Card', 'Cash', 'Net Banking', 'Bank Transfer', 'Bank Statement', 'Wallet'];
