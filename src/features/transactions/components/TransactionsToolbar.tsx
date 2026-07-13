import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { RiAddCircleLine, RiFilter3Line, RiSearchLine } from 'react-icons/ri';
import type { TransactionFormInitialValues } from './TransactionForm';
import { AddTransactionDialog } from './AddTransactionDialog';

type TransactionsToolbarProps = {
  search: string;
  filter: string;
  transactionDate: string;
  maxDate: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onTransactionDateChange: (value: string) => void;
  onAddTransaction: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onExtractTransaction: (description: string) => Promise<TransactionFormInitialValues | null>;
  extractingTransaction: boolean;
  selectedWalletName: string;
  addDialogRequestKey?: number;
  onAddDialogRequestHandled?: () => void;
};

export function TransactionsToolbar({
  search,
  filter,
  transactionDate,
  maxDate,
  onSearchChange,
  onFilterChange,
  onTransactionDateChange,
  onAddTransaction,
  onExtractTransaction,
  extractingTransaction,
  selectedWalletName,
  addDialogRequestKey,
  onAddDialogRequestHandled,
}: TransactionsToolbarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    if (!addDialogRequestKey) return;
    setAddDialogOpen(true);
    onAddDialogRequestHandled?.();
  }, [addDialogRequestKey, onAddDialogRequestHandled]);

  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="relative w-full max-w-md flex-1">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#6B7280]" aria-hidden="true" />
        <Input
          placeholder="Search description, category, or mode..."
          className="pl-10"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="grid w-full grid-cols-1 items-center gap-3 sm:grid-cols-2 md:flex md:w-auto">
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-full md:w-[150px]">
            <RiFilter3Line className="mr-2 text-base" aria-hidden="true" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All-Types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>

        <AddTransactionDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          transactionDate={transactionDate}
          maxDate={maxDate}
          onTransactionDateChange={onTransactionDateChange}
          onAddTransaction={onAddTransaction}
          onExtractTransaction={onExtractTransaction}
          extractingTransaction={extractingTransaction}
          selectedWalletName={selectedWalletName}
          trigger={(
            <Button className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5]">
              <RiAddCircleLine className="shrink-0 text-base" aria-hidden="true" />
              Add Transaction
            </Button>
          )}
        />
      </div>
    </div>
  );
}
