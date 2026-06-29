import { Button } from '@/src/components/ui/button';
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
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Financial Insights</h1>
        <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Powered by Gemini, with local AI fallback.</p>
      </div>
      <Button variant="outline" onClick={onGenerate} disabled={insightsLoading || transactionsLoading} className="gap-2">
        <RiRefreshLine className={cn('text-base', insightsLoading && 'animate-spin')} aria-hidden="true" />
        {insights ? 'Regenerate AI Insights' : 'Generate AI Insights'}
      </Button>
    </div>
  );
}
