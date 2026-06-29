import { Card, CardContent } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { formatRupees } from '@/src/utils/formatters';
import { RiArrowLeftDownLine, RiArrowRightUpLine, RiWallet3Line } from 'react-icons/ri';
import type { AnalysisRange } from '../dashboard.constants';
import { rangeLabels } from '../dashboard.constants';

type DashboardMetricCardsProps = {
  activeRange: AnalysisRange;
  totalIncome: number;
  totalExpense: number;
  balance: number;
};

export function DashboardMetricCards({ activeRange, totalIncome, totalExpense, balance }: DashboardMetricCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="metric-card">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-income">
              <RiArrowRightUpLine className="text-lg" aria-hidden="true" />
            </div>
            <Badge variant="outline" className="border-[#EAFBF0] text-[#34C759]">{rangeLabels[activeRange]}</Badge>
          </div>
          <p className="text-sm text-[#6B7280] font-medium">Total Income</p>
          <h3 className="text-2xl font-bold mt-1">{formatRupees(totalIncome)}</h3>
        </CardContent>
      </Card>

      <Card className="metric-card">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-expense">
              <RiArrowLeftDownLine className="text-lg" aria-hidden="true" />
            </div>
            <Badge variant="outline" className="border-[#FFF1F1] text-[#FF6B6B]">{rangeLabels[activeRange]}</Badge>
          </div>
          <p className="text-sm text-[#6B7280] font-medium">Total Expenses</p>
          <h3 className="text-2xl font-bold mt-1">{formatRupees(totalExpense)}</h3>
        </CardContent>
      </Card>

      <Card className="compact-metric-card border-none bg-[#4F9CF9] text-white shadow-[0_18px_45px_rgba(79,156,249,0.24)]">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
              <RiWallet3Line className="text-lg" aria-hidden="true" />
            </div>
            <Badge variant="outline" className="text-white border-white/30">Current</Badge>
          </div>
          <p className="text-sm text-white/80 font-medium">Net Balance</p>
          <h3 className="text-2xl font-bold mt-1">{formatRupees(balance)}</h3>
        </CardContent>
      </Card>
    </div>
  );
}
