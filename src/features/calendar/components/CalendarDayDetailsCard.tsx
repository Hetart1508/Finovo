import { format } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import { formatRupees, formatSignedRupees } from '@/src/utils/formatters';
import { RiErrorWarningLine } from 'react-icons/ri';
import type { DailySummary } from '../calendar.types';

type CalendarDayDetailsCardProps = {
  selectedDate: Date | undefined;
  transactions: Transaction[];
  selectedDayTotal: number;
  selectedDaySummary: DailySummary;
  threshold: number;
};

export function CalendarDayDetailsCard({
  selectedDate,
  transactions,
  selectedDayTotal,
  selectedDaySummary,
  threshold,
}: CalendarDayDetailsCardProps) {
  return (
    <Card className="min-w-0 border-none shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">
          {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div className="space-y-4 rounded-xl bg-[#FAFBFC] p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-sm text-[#6B7280]">Net Balance</p>
              <h3
                className={cn(
                  'mt-1 text-2xl font-bold',
                  selectedDaySummary.net > 0 && 'text-[#34C759]',
                  selectedDaySummary.net < 0 && 'text-[#FF6B6B]'
                )}
              >
                {formatSignedRupees(selectedDaySummary.net, selectedDaySummary.net >= 0)}
              </h3>
            </div>
            {selectedDayTotal > threshold && (
              <Badge variant="destructive" className="gap-1">
                <RiErrorWarningLine className="text-xs" aria-hidden="true" />
                Over Limit
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Income</p>
              <p className="mt-1 text-base font-bold text-[#34C759]">{formatRupees(selectedDaySummary.income)}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Expense</p>
              <p className="mt-1 text-base font-bold text-[#FF6B6B]">{formatRupees(selectedDaySummary.expense)}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#6B7280]">Transactions</p>
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-[#E5E7EB] py-3 text-left last:border-0"
              >
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere] text-sm font-medium leading-5">
                    {transaction.description || transaction.category}
                  </p>
                  <p className="mt-1 [overflow-wrap:anywhere] text-xs leading-4 text-[#6B7280]">
                    {transaction.category} • {transaction.payment_mode}
                  </p>
                </div>
                <p className={cn(
                  'whitespace-nowrap text-right text-sm font-bold leading-5',
                  transaction.type === 'income' ? 'text-[#34C759]' : 'text-[#1F2937] text-[#FF6B6B]'
                )}>
                  {formatSignedRupees(transaction.amount, transaction.type === 'income')}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#6B7280] italic py-4">No transactions on this day.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
