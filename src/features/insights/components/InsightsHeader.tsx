import { Button } from '@/src/components/ui/button';
import { PageHeader } from '@/src/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { RiRefreshLine } from 'react-icons/ri';
import type { FinancialInsightResult } from '../insights.types';

type InsightsHeaderProps = {
  insights: FinancialInsightResult | null;
  insightsLoading: boolean;
  transactionsLoading: boolean;
  onGenerate: () => void;
};

export function InsightsHeader({ insights, insightsLoading, transactionsLoading, onGenerate }: InsightsHeaderProps) {
  return (
    <PageHeader
      title="AI Financial Insights"
      description="Powered by Gemini, with local AI fallback."
      actions={(
        <Button variant="outline" onClick={onGenerate} disabled={insightsLoading || transactionsLoading} className="gap-2">
          <RiRefreshLine className={cn('text-base', insightsLoading && 'animate-spin')} aria-hidden="true" />
          {insights ? 'Regenerate AI Insights' : 'Generate AI Insights'}
        </Button>
      )}
    />
  );
}
