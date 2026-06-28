import { format, parseISO } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/lib/utils';
import type { RecurringEvent } from '../recurring.types';
import { getAmountClassName, getDueLabel, getScheduleLabel, getTypeClassName } from '../recurring.utils';

type YearlyDueScheduleCardProps = {
  upcomingEvents: RecurringEvent[];
};

export function YearlyDueScheduleCard({ upcomingEvents }: YearlyDueScheduleCardProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Yearly Due Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280] dark:text-[#CBD5E1]">No payments due in the next year.</p>
          ) : (
            upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-[#E5E7EB] p-3 dark:border-[#334155]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                      {event.next_due_date ? format(parseISO(event.next_due_date), 'dd MMM yyyy') : `Day ${event.day_of_month}`} - {event.category}
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                      {getScheduleLabel(event)} - {event.payment_mode === 'auto' || event.autopay_enabled ? 'Auto' : 'Manual'}
                    </p>
                  </div>
                  <p className={cn('font-bold', getAmountClassName(event.type))}>₹{Number(event.amount).toLocaleString()}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">{getDueLabel(event)}</Badge>
                  <Badge variant="outline" className={cn('text-xs capitalize', getTypeClassName(event.type))}>{event.type}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
