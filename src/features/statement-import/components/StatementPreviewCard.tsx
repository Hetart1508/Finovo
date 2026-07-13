import { format, parseISO } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { formatSignedRupees } from '@/src/utils/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { cn } from '@/lib/utils';
import {
  RiArrowLeftDownLine,
  RiArrowRightUpLine,
  RiCheckboxCircleLine,
  RiDeleteBin6Line,
} from 'react-icons/ri';
import type { StatementTransaction } from '../statementImport.types';
import { getDisplayDescription } from '../statementImport.utils';

type StatementPreviewCardProps = {
  transactions: StatementTransaction[];
  alreadyImported: boolean;
  previewLoading: boolean;
  previewStatus: string;
  approveLoading: boolean;
  approvedCount: number;
  onApproveAll: () => void;
  onToggleType: (index: number) => void;
  onMerchantNameChange: (vpa: string, companyName: string) => void;
  onRemoveRow: (index: number) => void;
};

export function StatementPreviewCard({
  transactions,
  alreadyImported,
  previewLoading,
  previewStatus,
  approveLoading,
  approvedCount,
  onApproveAll,
  onToggleType,
  onMerchantNameChange,
  onRemoveRow,
}: StatementPreviewCardProps) {
  return (
    <Card className="min-w-0 w-full border-none shadow-sm">
      <CardHeader className="min-w-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-lg">Preview Transactions</CardTitle>
          <CardDescription>Review extracted income and outgoing rows. Nothing is saved until you approve.</CardDescription>
        </div>
        <Button
          className="gap-2 bg-[#34C759] hover:bg-[#2EB851]"
          onClick={onApproveAll}
          disabled={!transactions.length || alreadyImported || previewLoading || approveLoading}
        >
          <RiCheckboxCircleLine className="text-base" aria-hidden="true" />
          {approveLoading ? 'Saving...' : `Approve All${transactions.length ? ` (${transactions.length})` : ''}`}
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 p-0">
        <div className="w-full min-w-0 max-w-full">
        <Table
          className="min-w-[850px]"
          containerClassName="max-w-full touch-auto overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent border-[#E5E7EB]">
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && previewLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">
                  {previewStatus || 'Extracting statement transactions...'}
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">
                  {approvedCount ? `Saved ${approvedCount} transactions. Select another statement to import more.` : 'Select a statement file to preview transactions.'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {transactions.map((transaction, index) => (
                  <TableRow key={`${transaction.date}-${transaction.amount}-${index}`} className="border-[#E5E7EB]">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onToggleType(index)}
                        title={`Change to ${transaction.type === 'income' ? 'expense' : 'income'}`}
                        aria-label={`Currently ${transaction.type}; change to ${transaction.type === 'income' ? 'expense' : 'income'}`}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110',
                          transaction.type === 'income' ? 'bg-[#EAFBF0] text-[#34C759]' : 'bg-[#FFF1F1] text-[#FF6B6B]'
                        )}
                      >
                        {transaction.type === 'income'
                          ? <RiArrowRightUpLine className="text-base" aria-hidden="true" />
                          : <RiArrowLeftDownLine className="text-base" aria-hidden="true" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {format(parseISO(transaction.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="min-w-[260px] font-medium">
                      <p>{getDisplayDescription(transaction)}</p>
                      {transaction.type === 'expense' && transaction.vpa ? (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded bg-[#EEF6FF] px-2 py-1 text-xs text-[#2878D0]">{transaction.vpa}</code>
                            <Badge variant="outline" className={transaction.alias_status === 'matched' ? 'border-[#EAFBF0] text-[#34C759]' : 'border-[#FFF7E8] text-[#B87516]'}>
                              {transaction.alias_status === 'matched' ? 'Saved match' : 'Add name (optional)'}
                            </Badge>
                          </div>
                          <Label htmlFor={`merchant-name-${index}`} className="text-xs font-semibold">
                            Merchant/company name (optional)
                          </Label>
                          <Input
                            id={`merchant-name-${index}`}
                            value={transaction.merchant_name || ''}
                            maxLength={255}
                            placeholder="Enter merchant name"
                            onChange={(event) => onMerchantNameChange(transaction.vpa!, event.target.value)}
                            aria-label={`Company name for ${transaction.vpa}`}
                            className="h-9"
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">{transaction.payment_mode}</TableCell>
                    <TableCell className={cn(
                      'text-right font-bold',
                      transaction.type === 'income' ? 'text-[#34C759]' : 'text-[#1F2937] text-[#FF6B6B]'
                    )}>
                      {formatSignedRupees(transaction.amount, transaction.type === 'income')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#6B7280] hover:text-[#FF6B6B]"
                        onClick={() => onRemoveRow(index)}
                      >
                        <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {previewLoading ? (
                  <TableRow className="border-[#E5E7EB] hover:bg-transparent">
                    <TableCell colSpan={7} className="py-4 text-center text-sm text-[#6B7280]">
                      {previewStatus || 'Extracting more statement transactions...'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
