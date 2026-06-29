import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatRupees } from '@/src/utils/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { cn } from '@/lib/utils';
import { RiDeleteBin6Line, RiPencilLine } from 'react-icons/ri';
import type { RecurringEvent } from '../recurring.types';
import { getAmountClassName, getScheduleLabel, getTypeClassName } from '../recurring.utils';

type RecurringPaymentsTableProps = {
  events: RecurringEvent[];
  loading: boolean;
  onEdit: (event: RecurringEvent) => void;
  onDelete: (id: number) => void;
};

export function RecurringPaymentsTable({ events, loading, onEdit, onDelete }: RecurringPaymentsTableProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recurring Payments</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[#E5E7EB] hover:bg-transparent dark:border-[#334155]">
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[88px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">Loading recurring payments...</TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">No recurring payments added yet.</TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id} className="border-[#E5E7EB] dark:border-[#334155]">
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{event.category}</Badge></TableCell>
                  <TableCell className="text-[#6B7280] dark:text-[#CBD5E1]">{getScheduleLabel(event)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('capitalize', getTypeClassName(event.type))}>
                      {event.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {event.payment_mode === 'auto' || event.autopay_enabled ? 'Auto' : 'Manual'}
                      </Badge>
                      {event.payment_account ? (
                        <p className="max-w-[9rem] truncate text-xs text-[#6B7280] dark:text-[#CBD5E1]">{event.payment_account}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={cn('text-right font-bold', getAmountClassName(event.type))}>
                    {formatRupees(event.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="text-[#6B7280] hover:text-[#4F9CF9]" onClick={() => onEdit(event)} aria-label="Edit recurring payment">
                        <RiPencilLine className="text-base" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-[#6B7280] hover:text-[#FF6B6B]" onClick={() => onDelete(event.id)} aria-label="Delete recurring payment">
                        <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
