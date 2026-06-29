import { useEffect, useState } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { getFinancialInsights } from '@/src/lib/ai';
import { upcomingRecurringQuery } from '@/src/server-state/recurringQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import type { Transaction } from '@/src/features/transactions/transactions.types';
import type { FinancialInsightResult } from '../insights.types';
import { normalizeDateRange } from '../insights.utils';

type UseGenerateInsightsArgs = {
  transactionsResult: UseQueryResult<Transaction[], Error>;
  selectedRange: { start: Date; end: Date };
  resetKey: unknown[];
};

export function useGenerateInsights({ transactionsResult, selectedRange, resetKey }: UseGenerateInsightsArgs) {
  const [insights, setInsights] = useState<FinancialInsightResult | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setInsights(null);
  }, resetKey);

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const { data = [] } = await transactionsResult.refetch();
      const range = normalizeDateRange(selectedRange);
      const transactionsInRange = data.filter((transaction) =>
        isWithinInterval(parseISO(transaction.date), range)
      );

      if (!transactionsInRange.length) {
        setInsights(null);
        toast.info('No transactions found in the selected date range.');
        return;
      }

      const recurringEvents = await queryClient.fetchQuery(upcomingRecurringQuery());
      const aiInsights = await getFinancialInsights(transactionsInRange, recurringEvents);
      setInsights(aiInsights);
      toast.success('AI suggestions generated!');
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiMessage(error, 'Failed to generate AI insights.'));
    } finally {
      setInsightsLoading(false);
    }
  };

  return {
    insights,
    insightsLoading,
    generateInsights,
  };
}
