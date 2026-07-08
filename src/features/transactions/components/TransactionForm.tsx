import { useEffect, useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Button } from '@/src/components/ui/button';
import { DialogFooter } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { RiSave3Line } from 'react-icons/ri';
import { paymentModes, TRANSACTION_CATEGORY_PLACEHOLDER, transactionCategories } from '../transactions.constants';
import type { Transaction } from '../transactions.types';

export type TransactionFormInitialValues = Partial<Pick<Transaction, 'type' | 'amount' | 'category' | 'date' | 'payment_mode' | 'description'>>;

type TransactionFormProps = {
  mode: 'add' | 'edit';
  transaction?: Transaction;
  initialValues?: TransactionFormInitialValues;
  formKey?: string;
  dateValue?: string;
  maxDate: string;
  onDateChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TransactionForm({
  mode,
  transaction,
  initialValues,
  formKey,
  dateValue,
  maxDate,
  onDateChange,
  onSubmit,
}: TransactionFormProps) {
  const isEdit = mode === 'edit';
  const idPrefix = isEdit ? 'edit-' : '';
  const values = transaction ?? initialValues;
  const defaultDate = values?.date ? format(parseISO(values.date), 'yyyy-MM-dd') : undefined;
  const initialType = values?.type ?? 'expense';
  const initialCategory = initialType === 'income' ? 'Salary' : values?.category ?? TRANSACTION_CATEGORY_PLACEHOLDER;
  const [transactionType, setTransactionType] = useState<string>(initialType);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    setTransactionType(initialType);
    setCategory(initialCategory);
  }, [initialType, initialCategory, transaction?.id, formKey]);

  const handleTypeChange = (value: string) => {
    setTransactionType(value);
    if (value === 'income') {
      setCategory('Salary');
    }
  };

  return (
    <form key={transaction?.id ?? formKey ?? 'new'} onSubmit={onSubmit} className="space-y-3 py-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}type`}>Type</Label>
          <Select name="type" value={transactionType} onValueChange={handleTypeChange}>
            <SelectTrigger id={`${idPrefix}type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}amount`}>Amount (₹)</Label>
          <Input id={`${idPrefix}amount`} name="amount" type="number" step="0.01" min="0.01" defaultValue={values?.amount} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}category`}>Category</Label>
        <Select name="category" value={category} onValueChange={setCategory}>
          <SelectTrigger id={`${idPrefix}category`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TRANSACTION_CATEGORY_PLACEHOLDER} disabled>Select</SelectItem>
            {transactionCategories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}date`}>Date</Label>
        {isEdit ? (
          <AppDatePicker id={`${idPrefix}date`} name="date" max={maxDate} defaultValue={defaultDate} required />
        ) : (
          <AppDatePicker id="date" name="date" value={dateValue} onChange={onDateChange} max={maxDate} required />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}payment-mode`}>Payment Mode</Label>
        <Select name="payment_mode" defaultValue={values?.payment_mode ?? 'UPI'}>
          <SelectTrigger id={`${idPrefix}payment-mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {paymentModes.map((modeOption) => (
              <SelectItem key={modeOption} value={modeOption}>{modeOption}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}description`}>Description</Label>
        <Input id={`${idPrefix}description`} name="description" defaultValue={values?.description || ''} placeholder={isEdit ? undefined : 'Lunch at Starbucks'} />
      </div>

      {isEdit ? (
        <div className="space-y-1.5">
          <Label htmlFor="edit-bill-url">Bill URL</Label>
          <Input id="edit-bill-url" name="bill_url" defaultValue={transaction?.bill_url || ''} placeholder="https://..." />
        </div>
      ) : null}

      <DialogFooter className="-mx-3 -mb-3 p-3 sm:justify-stretch">
        <Button type="submit" className="w-full">
          {isEdit ? <RiSave3Line className="mr-2 text-base" aria-hidden="true" /> : null}
          {isEdit ? 'Save Changes' : 'Save Transaction'}
        </Button>
      </DialogFooter>
    </form>
  );
}
