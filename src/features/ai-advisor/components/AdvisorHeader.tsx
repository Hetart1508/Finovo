import type { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/src/components/ui/button';
import { RiDeleteBinLine } from 'react-icons/ri';

type AdvisorHeaderProps = {
  messageCount: number;
  clearMutation: UseMutationResult<unknown, Error, void, unknown>;
  summaryCards: (string | number)[][];
};

export function AdvisorHeader({ messageCount, clearMutation, summaryCards }: AdvisorHeaderProps) {
  return (
    <div className="hidden min-h-0 items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm md:flex">
      <div className="min-w-40 shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-[#1F2937]">AI Wealth Advisor</h1>
        <p className="text-xs text-[#6B7280]">Based on your investments</p>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-4 divide-x divide-border rounded-md border bg-[#FAFBFC]">
        {summaryCards.map(([label, value]) => (
          <div key={label} className="min-w-0 px-3 py-1.5">
            <p className="truncate text-[0.68rem] text-[#6B7280]">{label}</p>
            <p className="truncate text-sm font-bold text-[#1F2937]">{value}</p>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => clearMutation.mutate()}
        disabled={!messageCount || clearMutation.isPending}
      >
        <RiDeleteBinLine aria-hidden="true" />
        <span className="hidden xl:inline">Clear Chat</span>
      </Button>
    </div>
  );
}
