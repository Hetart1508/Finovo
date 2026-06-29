import { useMemo } from 'react';
import type { RecurringEvent } from '../recurring.types';

export function useRecurringMetrics(events: RecurringEvent[], upcomingEvents: RecurringEvent[]) {
  const monthlyCashOutflow = useMemo(
    () => events
      .filter((event) => event.type !== 'income')
      .reduce((sum, event) => {
        const interval = Number(event.interval_count) || 1;
        const monthlyEquivalent = event.frequency === 'yearly'
          ? Number(event.amount) / (interval * 12)
          : Number(event.amount) / interval;
        return sum + monthlyEquivalent;
      }, 0),
    [events]
  );

  const autoPaymentCount = useMemo(
    () => events.filter((event) => event.payment_mode === 'auto' || Boolean(event.autopay_enabled)).length,
    [events]
  );

  return {
    monthlyCashOutflow,
    autoPaymentCount,
    nextDueEvent: upcomingEvents[0],
  };
}
