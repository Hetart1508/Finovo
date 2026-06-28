import { Card, CardContent } from '@/src/components/ui/card';
import { RiCalendarCheckLine, RiRefreshLine, RiRepeatLine } from 'react-icons/ri';
import type { RecurringEvent } from '../recurring.types';
import { getDueLabel } from '../recurring.utils';

type RecurringMetricCardsProps = {
  monthlyCashOutflow: number;
  nextDueEvent: RecurringEvent | undefined;
  autoPaymentCount: number;
};

export function RecurringMetricCards({ monthlyCashOutflow, nextDueEvent, autoPaymentCount }: RecurringMetricCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="metric-card">
        <CardContent className="p-6 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9]">
            <RiRepeatLine className="text-lg" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[#6B7280]">Monthly Cash Outflow</p>
          <h3 className="mt-1 text-2xl font-bold">₹{Math.round(monthlyCashOutflow).toLocaleString()}</h3>
        </CardContent>
      </Card>

      <Card className="metric-card">
        <CardContent className="p-6 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF7E8] text-[#FFB84D]">
            <RiCalendarCheckLine className="text-lg" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[#6B7280]">Next Payment</p>
          <h3 className="mt-1 truncate text-2xl font-bold">{nextDueEvent ? nextDueEvent.name : 'None'}</h3>
          {nextDueEvent ? <p className="mt-1 text-xs text-[#6B7280]">{getDueLabel(nextDueEvent)}</p> : null}
        </CardContent>
      </Card>

      <Card className="metric-card">
        <CardContent className="p-6 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAFBF0] text-[#34C759]">
            <RiRefreshLine className="text-lg" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[#6B7280]">Auto Payments</p>
          <h3 className="mt-1 text-2xl font-bold">{autoPaymentCount}</h3>
        </CardContent>
      </Card>
    </div>
  );
}
