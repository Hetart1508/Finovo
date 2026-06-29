import { useEffect } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { transactionsQuery } from '@/src/server-state/transactionsQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import { AIAnalysisCard } from '@/src/features/insights/components/AIAnalysisCard';
import { InsightRangeCard } from '@/src/features/insights/components/InsightRangeCard';
import { InsightsHeader } from '@/src/features/insights/components/InsightsHeader';
import { TopCategoriesCard } from '@/src/features/insights/components/TopCategoriesCard';
import { useGenerateInsights } from '@/src/features/insights/hooks/useGenerateInsights';
import { useInsightRange } from '@/src/features/insights/hooks/useInsightRange';
import type { Transaction } from '@/src/features/transactions/transactions.types';

export default function Insights() {
  const transactionsResult = useQuery(transactionsQuery());
  const transactionsLoading = transactionsResult.isPending || transactionsResult.isFetching;
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const range = useInsightRange(transactions);
  const { insights, insightsLoading, generateInsights } = useGenerateInsights({
    transactionsResult,
    selectedRange: range.selectedRange,
    resetKey: [range.rangeMode, range.selectedMonth, range.customStartDate, range.customEndDate],
  });

  useEffect(() => {
    if (transactionsResult.error) {
      toast.error(getApiMessage(transactionsResult.error, 'Failed to load transactions.'), { toastId: 'insights-query-error' });
    }
  }, [transactionsResult.error]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <InsightsHeader
        insights={insights}
        insightsLoading={insightsLoading}
        transactionsLoading={transactionsLoading}
        onGenerate={generateInsights}
      />

      <InsightRangeCard
        rangeLabel={range.rangeLabel}
        transactionCount={range.filteredTransactions.length}
        rangeMode={range.rangeMode}
        selectedMonth={range.selectedMonth}
        customStartDate={range.customStartDate}
        customEndDate={range.customEndDate}
        today={range.today}
        currentMonthStart={range.currentMonthStart}
        onRangeModeChange={range.setRangeMode}
        onSelectedMonthChange={range.selectMonth}
        onCustomStartChange={range.setCustomStartDate}
        onCustomEndChange={range.setCustomEndDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <AIAnalysisCard
          insights={insights}
          insightsLoading={insightsLoading}
          rangeLabel={range.rangeLabel}
        />

        <div className="space-y-8 lg:col-span-1">
          <TopCategoriesCard categoryData={range.categoryData} loading={transactionsLoading} />
        </div>
      </div>
    </div>
  );
}
