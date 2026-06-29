import { StatCard } from '@/src/components/shared/StatCard';
import { formatRupees } from '@/src/utils/formatters';
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
      <StatCard
        icon={<RiRepeatLine className="text-lg" aria-hidden="true" />}
        iconClassName="bg-[#EEF6FF] text-[#4F9CF9]"
        label="Monthly Cash Outflow"
        value={formatRupees(Math.round(monthlyCashOutflow))}
      />

      <StatCard
        icon={<RiCalendarCheckLine className="text-lg" aria-hidden="true" />}
        iconClassName="bg-[#FFF7E8] text-[#FFB84D]"
        label="Next Payment"
        value={nextDueEvent ? nextDueEvent.name : 'None'}
        valueClassName="truncate"
        helper={nextDueEvent ? getDueLabel(nextDueEvent) : undefined}
      />

      <StatCard
        icon={<RiRefreshLine className="text-lg" aria-hidden="true" />}
        iconClassName="bg-[#EAFBF0] text-[#34C759]"
        label="Auto Payments"
        value={autoPaymentCount}
      />
    </div>
  );
}
