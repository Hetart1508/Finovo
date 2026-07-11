import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRupees, formatSignedRupees } from '@/src/utils/formatters';
import { RiArrowLeftDownLine, RiArrowRightUpLine, RiCalendarCheckLine, RiErrorWarningLine } from 'react-icons/ri';
import type { RecurringEvent } from '@/src/features/recurring/recurring.types';
import type { DashboardTransaction } from '../dashboard.types';

type DashboardActivityGridProps = {
  transactions: DashboardTransaction[];
  recurring: RecurringEvent[];
};

export function DashboardActivityGrid({ transactions, recurring }: DashboardActivityGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-3">
      <Card className="surface-panel rounded-lg lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" className="text-[#4F9CF9]" render={<Link to="/transactions" />}>View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#FAFBFC] sm:p-3">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    transaction.type === 'income' ? 'icon-income' : 'icon-expense'
                  )}>
                    {transaction.type === 'income'
                      ? <RiArrowRightUpLine className="text-lg" aria-hidden="true" />
                      : <RiArrowLeftDownLine className="text-lg" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-medium">{transaction.description || transaction.category}</p>
                    <p className="break-words text-xs leading-5 text-[#6B7280]">{format(parseISO(transaction.date), 'dd MMM yyyy')} • {transaction.payment_mode}</p>
                  </div>
                </div>
                <p className={cn(
                  'whitespace-nowrap text-sm font-bold sm:text-base',
                  transaction.type === 'income' ? 'text-[#34C759]' : 'text-[#FF6B6B]'
                )}>
                  {formatSignedRupees(transaction.amount, transaction.type === 'income')}
                </p>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-center text-[#6B7280] py-8">No transactions found for this range.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="surface-panel rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Upcoming Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recurring.map((event) => (
              <div key={event.id} className="flex items-start gap-4 p-3 border border-[#E5E7EB] rounded-xl">
                <div className="p-2 icon-upcoming rounded-lg">
                  <RiCalendarCheckLine aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.name}</p>
                  <p className="text-xs text-[#6B7280]">Due on {event.day_of_month}th • {formatRupees(event.amount)}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase">{event.type}</Badge>
              </div>
            ))}
            {recurring.length === 0 && (
              <div className="text-center py-8">
                <RiErrorWarningLine className="mx-auto mb-2 text-3xl text-[#FFB84D]" aria-hidden="true" />
                <p className="text-sm text-[#6B7280]">No recurring payments set.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
