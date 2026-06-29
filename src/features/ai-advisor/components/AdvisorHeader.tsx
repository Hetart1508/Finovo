import type { UseMutationResult } from '@tanstack/react-query';
import { Card, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { RiDeleteBinLine } from 'react-icons/ri';

type AdvisorHeaderProps = {
  messageCount: number;
  clearMutation: UseMutationResult<unknown, Error, void, unknown>;
  summaryCards: (string | number)[][];
};

export function AdvisorHeader({ messageCount, clearMutation, summaryCards }: AdvisorHeaderProps) {
  return (
    <>
      <div className="hidden min-h-0 flex-col gap-2 md:flex md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1F2937] sm:text-2xl">AI Wealth Advisor</h1>
          <p className="text-sm text-[#6B7280]">Goal planning based on your saved investments.</p>
        </div>
        <Button
          variant="outline"
          className="h-9 w-fit gap-2"
          onClick={() => clearMutation.mutate()}
          disabled={!messageCount || clearMutation.isPending}
        >
          <RiDeleteBinLine aria-hidden="true" />
          Clear Chat
        </Button>
      </div>

      <div className="hidden min-h-0 grid-cols-2 gap-2 md:grid md:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <Card key={label} className="rounded-lg py-1.5 shadow-sm sm:py-2">
            <CardHeader className="px-3 py-2 sm:py-3">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}
