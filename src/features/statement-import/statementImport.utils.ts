import type { StatementTransaction } from './statementImport.types';

export const getTodayDateString = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

export const isFutureTransactionDate = (date: string) => date > getTodayDateString();

export const getDisplayDescription = (transaction: StatementTransaction) => {
  const description = transaction.original_description || transaction.description || '';
  if (!transaction.vpa) return description || '-';
  const escapedVpa = transaction.vpa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutVpa = description.replace(new RegExp(escapedVpa, 'i'), '').replace(/[\s/|:;-]+$/g, '').trim();
  return !withoutVpa || /^upi(?:\s+(?:gpay|paytm|phonepe))?$/i.test(withoutVpa)
    ? 'UPI payment'
    : withoutVpa;
};

export const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
