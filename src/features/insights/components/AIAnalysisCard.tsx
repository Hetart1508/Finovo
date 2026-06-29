import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import { RiSparkling2Line } from 'react-icons/ri';
import { insightSections } from '../insights.constants';
import type { FinancialInsightResult } from '../insights.types';

type AIAnalysisCardProps = {
  insights: FinancialInsightResult | null;
  insightsLoading: boolean;
  rangeLabel: string;
};

export function AIAnalysisCard({ insights, insightsLoading, rangeLabel }: AIAnalysisCardProps) {
  return (
    <Card className="lg:col-span-2 border-none bg-gradient-to-br from-[#EEF6FF]/80 to-white text-[#1F2937] shadow-sm dark:from-[#10213A] dark:to-[#111827] dark:text-[#F8FAFC]">
      <CardHeader>
        <div className="flex items-center gap-2 text-[#4F9CF9]">
          <RiSparkling2Line className="text-lg" aria-hidden="true" />
          <CardTitle className="text-xl text-[#1F2937] dark:text-[#F8FAFC]">AI Analysis</CardTitle>
        </div>
        <CardDescription className="text-[#6B7280] dark:text-[#CBD5E1]">
          Based on transactions from {rangeLabel}
          {insights?.model ? ` using ${insights.model}.` : '.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insightsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-20 w-full mt-8" />
          </div>
        ) : insights ? (
          <div className="space-y-6">
            {insights.summary && (
              <div className="rounded-lg border border-[#DCEBFF] bg-white/70 p-4 dark:border-[#334155] dark:bg-[#0F172A]/70">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1F2937] dark:text-[#F8FAFC]">
                  <RiSparkling2Line className="text-lg text-[#4F9CF9]" aria-hidden="true" />
                  AI Financial Analysis
                </h3>
                <p className="mt-2 leading-relaxed text-[#334155] dark:text-[#E2E8F0]">{insights.summary}</p>
              </div>
            )}

            <div className="grid gap-4">
              {insightSections.map(({ key, title }) => {
                const items = insights[key];
                if (!Array.isArray(items) || items.length === 0) return null;

                return (
                  <section key={key} className="rounded-lg border border-[#DCEBFF] bg-white/70 p-4 dark:border-[#334155] dark:bg-[#0F172A]/70">
                    <h4 className="text-sm font-bold uppercase text-[#4F9CF9]">{title}</h4>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#334155] dark:text-[#E2E8F0]">
                      {items.map((item, index) => (
                        <li key={`${key}-${index}`} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#34C759]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="font-medium text-[#1F2937] dark:text-[#F8FAFC]">AI insights have not been generated yet.</p>
            <p className="mt-2 text-sm text-[#6B7280] dark:text-[#CBD5E1]">Click Generate AI Insights when you want to use AI tokens.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
