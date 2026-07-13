import { useEffect, useState, type FormEvent } from 'react';
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
import { RiAddCircleLine, RiFilter3Line, RiRefreshLine, RiSearchLine, RiSparkling2Line } from 'react-icons/ri';
import { TransactionForm, type TransactionFormInitialValues } from './TransactionForm';

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
  const [addMode, setAddMode] = useState<'ai' | 'manual'>('ai');
  const [aiDescription, setAiDescription] = useState('');
  const [extractedTransaction, setExtractedTransaction] = useState<TransactionFormInitialValues | null>(null);
  const [formVersion, setFormVersion] = useState(0);

  const resetAddDialog = () => {
    setAddMode('ai');
    setAiDescription('');
    setExtractedTransaction(null);
    onTransactionDateChange(maxDate);
    setFormVersion((version) => version + 1);
  };

  const handleAddDialogOpenChange = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) resetAddDialog();
  };

  useEffect(() => {
    if (!addDialogRequestKey) return;
    setAddDialogOpen(true);
    onAddDialogRequestHandled?.();
  }, [addDialogRequestKey, onAddDialogRequestHandled]);

  const handleExtract = async () => {
    const transaction = await onExtractTransaction(aiDescription);
    if (!transaction) return;

    // Keep the user's original sentence as the stable transaction identity. AI
    // descriptions may be paraphrased differently across otherwise identical runs.
    setExtractedTransaction({ ...transaction, description: aiDescription.trim() });
    if (transaction.date) onTransactionDateChange(transaction.date);
    setFormVersion((version) => version + 1);
  };

  const handleAddTransactionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const saved = await onAddTransaction(event);
    if (saved) {
      handleAddDialogOpenChange(false);
    }
  };

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

        <Dialog open={addDialogOpen} onOpenChange={handleAddDialogOpenChange}>
          <DialogTrigger>
            <Button className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5]">
              <RiAddCircleLine className="shrink-0 text-base" aria-hidden="true" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto p-3 sm:max-w-md">
            <DialogHeader className="pr-8">
              <DialogTitle>Add New Transaction</DialogTitle>
              <p className="text-xs font-medium text-[#6B7280]">Saving to {selectedWalletName}</p>
            </DialogHeader>
            <div className="flex rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={addMode === 'ai' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setAddMode('ai')}
              >
                <RiSparkling2Line className="mr-2 text-base" aria-hidden="true" />
                AI Add
              </Button>
              <Button
                type="button"
                variant={addMode === 'manual' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => {
                  setAddMode('manual');
                  setExtractedTransaction(null);
                  onTransactionDateChange(maxDate);
                  setFormVersion((version) => version + 1);
                }}
              >
                <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
                Manual
              </Button>
            </div>

            {addMode === 'ai' ? (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label htmlFor="ai-transaction-description" className="text-sm font-medium">
                    Describe Transaction
                  </label>
                  <textarea
                    id="ai-transaction-description"
                    className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={aiDescription}
                    onChange={(event) => setAiDescription(event.target.value)}
                    maxLength={1000}
                    placeholder="Paid 450 for lunch at Starbucks today using UPI"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleExtract}
                  disabled={extractingTransaction || aiDescription.trim().length < 6}
                >
                  <RiRefreshLine className={`mr-2 text-base ${extractingTransaction ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {extractingTransaction ? 'Extracting...' : 'Extract Details'}
                </Button>

                {extractedTransaction ? (
                  <div className="rounded-lg border border-[#D8EAFE] bg-[#F7FBFF] px-3 py-2 text-sm text-[#2878D0]">
                    Review the extracted details before saving.
                  </div>
                ) : null}
              </div>
            ) : null}

            {addMode === 'manual' || extractedTransaction ? (
              <TransactionForm
                mode="add"
                formKey={`${addMode}-${formVersion}`}
                initialValues={addMode === 'ai' ? extractedTransaction ?? undefined : undefined}
                dateValue={transactionDate}
                maxDate={maxDate}
                onDateChange={onTransactionDateChange}
                onSubmit={handleAddTransactionSubmit}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
