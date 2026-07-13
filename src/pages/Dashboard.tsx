import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { dashboardTransactionsQuery } from '@/src/server-state/transactionsQueries';
import { recurringQuery } from '@/src/server-state/recurringQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import { DashboardActivityGrid } from '@/src/features/dashboard/components/DashboardActivityGrid';
import { DashboardChartsSkeleton } from '@/src/features/dashboard/components/DashboardChartsSkeleton';
import { DashboardHero } from '@/src/features/dashboard/components/DashboardHero';
import { DashboardMetricCards } from '@/src/features/dashboard/components/DashboardMetricCards';
import { dashboardChartColors } from '@/src/features/dashboard/dashboard.constants';
import type { DashboardTransaction } from '@/src/features/dashboard/dashboard.types';
import { useDashboardAnalysis } from '@/src/features/dashboard/hooks/useDashboardAnalysis';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import type { RecurringEvent } from '@/src/features/recurring/recurring.types';

const DashboardCharts = lazy(() => import('./DashboardCharts'));

export default function Dashboard() {
  const { selectedWalletId } = useWallets();
  const transactionsResult = useQuery(dashboardTransactionsQuery(selectedWalletId));
  const recurringResult = useQuery(recurringQuery());
  const transactions = (transactionsResult.data ?? []) as DashboardTransaction[];
  const recurring = (recurringResult.data ?? []) as RecurringEvent[];
  const analysis = useDashboardAnalysis(transactions);

  useEffect(() => {
    const error = transactionsResult.error || recurringResult.error;
    if (error) toast.error(getApiMessage(error, 'Failed to fetch dashboard data.'), { toastId: 'dashboard-query-error' });
  }, [recurringResult.error, transactionsResult.error]);

  return (
    <div className="kt-enter mx-auto w-full max-w-7xl space-y-5 sm:space-y-6 lg:space-y-8">
      <DashboardHero
        activeRange={analysis.activeRange}
        selectedPreset={analysis.selectedPreset}
        rangeDescription={analysis.rangeDescription}
        hasInvalidCustomRange={analysis.hasInvalidCustomRange}
        customStartDate={analysis.customStartDate}
        customEndDate={analysis.customEndDate}
        todayDateString={analysis.todayDateString}
        transactionCount={analysis.analysisTransactions.length}
        onPresetChange={analysis.applyPreset}
        onCustomStartChange={analysis.applyCustomStartDate}
        onCustomEndChange={analysis.applyCustomEndDate}
      />

      <DashboardMetricCards
        activeRange={analysis.activeRange}
        totalIncome={analysis.totalIncome}
        totalExpense={analysis.totalExpense}
        balance={analysis.balance}
      />

      <Suspense fallback={<DashboardChartsSkeleton />}>
        <DashboardCharts
          categoryData={analysis.categoryData}
          colors={dashboardChartColors}
          dailyData={analysis.dailyData}
          trendGranularity={analysis.trendGranularity}
        />
      </Suspense>

      <DashboardActivityGrid
        transactions={analysis.recentAnalysisTransactions}
        recurring={recurring}
      />
    </div>
  );
}
