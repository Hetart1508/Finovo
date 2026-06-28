import { format, parseISO } from 'date-fns';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { RiExternalLinkLine } from 'react-icons/ri';
import type { Transaction } from '../transactions.types';
import { getBillUrl, isPdfBill } from '../transactions.utils';

type BillPreviewDialogProps = {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
};

export function BillPreviewDialog({ transaction, onOpenChange }: BillPreviewDialogProps) {
  const openBillInNewTab = (url: string) => {
    const openedWindow = window.open(getBillUrl(url), '_blank');
    if (openedWindow) {
      openedWindow.opener = null;
    }
  };

  return (
    <Dialog open={Boolean(transaction)} onOpenChange={onOpenChange}>
      {transaction?.bill_url ? (
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Invoice Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 dark:border-[#334155] dark:bg-[#111827]">
              <p className="truncate text-sm font-semibold text-[#1F2937] dark:text-[#CBD5E1]">
                {transaction.description || transaction.category}
              </p>
              <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                {format(parseISO(transaction.date), 'dd MMM yyyy')} - ₹{Number(transaction.amount).toLocaleString()}
              </p>
            </div>

            {isPdfBill(transaction.bill_url) ? (
              <div className="h-[70vh] overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-[#334155]">
                <iframe
                  src={getBillUrl(transaction.bill_url)}
                  title="Invoice bill PDF"
                  className="h-full w-full bg-white"
                />
              </div>
            ) : (
              <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-[#E5E7EB] bg-[#0F172A]/5 p-3 dark:border-[#334155]">
                <img
                  src={getBillUrl(transaction.bill_url)}
                  alt="Invoice bill"
                  className="max-h-[66vh] max-w-full rounded-md object-contain"
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => openBillInNewTab(transaction.bill_url!)}>
                <RiExternalLinkLine className="text-base" aria-hidden="true" />
                Open in new tab
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
