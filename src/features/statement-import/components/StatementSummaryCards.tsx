import { Card, CardContent } from '@/src/components/ui/card';
import { RiFileTextLine } from 'react-icons/ri';
import type { StatementTotals } from '../statementImport.types';

type StatementSummaryCardsProps = {
  statementFile: File | null;
  model: string;
  totals: StatementTotals;
};

export function StatementSummaryCards({ statementFile, model, totals }: StatementSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="border-none shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm text-[#6B7280]">Statement</p>
          <div className="mt-2 flex items-center gap-3">
            <RiFileTextLine className="text-lg text-[#4F9CF9]" aria-hidden="true" />
            <p className="min-w-0 truncate font-semibold">{statementFile ? statementFile.name : 'No file selected'}</p>
          </div>
          {model ? <p className="mt-2 text-xs text-[#6B7280]">Parsed with {model}</p> : null}
        </CardContent>
      </Card>

      <Card className="compact-metric-card border-none shadow-sm">
        <CardContent className="p-5 text-center">
          <p className="text-sm text-[#6B7280]">Income Found</p>
          <p className="mt-2 text-2xl font-black text-[#34C759]">₹{totals.income.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card className="compact-metric-card border-none shadow-sm">
        <CardContent className="p-5 text-center">
          <p className="text-sm text-[#6B7280]">Expense Found</p>
          <p className="mt-2 text-2xl font-black text-[#FF6B6B]">₹{totals.expense.toLocaleString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
