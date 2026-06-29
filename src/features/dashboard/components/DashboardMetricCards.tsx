import { Badge } from '@/src/components/ui/badge';
import { StatCard } from '@/src/components/shared/StatCard';
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
      <StatCard
        icon={<RiArrowRightUpLine className="text-lg" aria-hidden="true" />}
        iconClassName="h-8 w-8 icon-income"
        action={<Badge variant="outline" className="border-[#EAFBF0] text-[#34C759]">{rangeLabels[activeRange]}</Badge>}
        label="Total Income"
        value={formatRupees(totalIncome)}
      />

      <StatCard
        icon={<RiArrowLeftDownLine className="text-lg" aria-hidden="true" />}
        iconClassName="h-8 w-8 icon-expense"
        action={<Badge variant="outline" className="border-[#FFF1F1] text-[#FF6B6B]">{rangeLabels[activeRange]}</Badge>}
        label="Total Expenses"
        value={formatRupees(totalExpense)}
      />

      <StatCard
        className="compact-metric-card border-none bg-[#4F9CF9] text-white shadow-[0_18px_45px_rgba(79,156,249,0.24)]"
        icon={<RiWallet3Line className="text-lg" aria-hidden="true" />}
        iconClassName="h-8 w-8 bg-white/20 text-white"
        action={<Badge variant="outline" className="border-white/30 text-white">Current</Badge>}
        label="Net Balance"
        labelClassName="text-white/80"
        value={formatRupees(balance)}
      />
    </div>
  );
}
