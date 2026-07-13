import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { RiAddCircleLine, RiRefreshLine, RiSparkling2Line } from 'react-icons/ri';
import { TransactionForm, type TransactionFormInitialValues } from './TransactionForm';

type AddTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  transactionDate: string;
  maxDate: string;
  onTransactionDateChange: (value: string) => void;
  onAddTransaction: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onExtractTransaction: (description: string) => Promise<TransactionFormInitialValues | null>;
  extractingTransaction: boolean;
  selectedWalletName: string;
};

export function AddTransactionDialog({
  open,
  onOpenChange,
  trigger,
  transactionDate,
  maxDate,
  onTransactionDateChange,
  onAddTransaction,
  onExtractTransaction,
  extractingTransaction,
  selectedWalletName,
}: AddTransactionDialogProps) {
  const [addMode, setAddMode] = useState<'ai' | 'manual'>('ai');
  const [aiDescription, setAiDescription] = useState('');
  const [extractedTransaction, setExtractedTransaction] = useState<TransactionFormInitialValues | null>(null);
  const [formVersion, setFormVersion] = useState(0);

  const reset = () => {
    setAddMode('ai');
    setAiDescription('');
    setExtractedTransaction(null);
    onTransactionDateChange(maxDate);
    setFormVersion((version) => version + 1);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const handleExtract = async () => {
    const transaction = await onExtractTransaction(aiDescription);
    if (!transaction) return;

    setExtractedTransaction({ ...transaction, description: aiDescription.trim() });
    if (transaction.date) onTransactionDateChange(transaction.date);
    setFormVersion((version) => version + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (await onAddTransaction(event)) handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto p-3 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Add New Transaction</DialogTitle>
          <p className="text-xs font-medium text-[#6B7280]">Saving to {selectedWalletName}</p>
        </DialogHeader>

        <div className="flex rounded-lg bg-muted p-1">
          <Button type="button" variant={addMode === 'ai' ? 'default' : 'ghost'} className="flex-1" onClick={() => setAddMode('ai')}>
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
              <label htmlFor="ai-transaction-description" className="text-sm font-medium">Describe Transaction</label>
              <textarea
                id="ai-transaction-description"
                className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={aiDescription}
                onChange={(event) => setAiDescription(event.target.value)}
                maxLength={1000}
                placeholder="Paid 450 for lunch at Starbucks today using UPI"
              />
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={handleExtract} disabled={extractingTransaction || aiDescription.trim().length < 6}>
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
            onSubmit={handleSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
