import type { FormEvent } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { RiAddCircleLine, RiFilter3Line, RiSearchLine } from 'react-icons/ri';
import { TransactionForm } from './TransactionForm';

type TransactionsToolbarProps = {
  search: string;
  filter: string;
  transactionDate: string;
  maxDate: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onTransactionDateChange: (value: string) => void;
  onAddTransaction: (event: FormEvent<HTMLFormElement>) => void;
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
}: TransactionsToolbarProps) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="relative max-w-md flex-1">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#6B7280]" aria-hidden="true" />
        <Input
          placeholder="Search description, category, or mode..."
          className="pl-10"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[150px]">
            <RiFilter3Line className="mr-2 text-base" aria-hidden="true" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All-Types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>

        <Dialog>
          <DialogTrigger>
            <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]">
              <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              mode="add"
              dateValue={transactionDate}
              maxDate={maxDate}
              onDateChange={onTransactionDateChange}
              onSubmit={onAddTransaction}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
