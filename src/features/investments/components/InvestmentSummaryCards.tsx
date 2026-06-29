import { StatCard } from '@/src/components/shared/StatCard';
import {
  RiBarChartBoxLine,
  RiCalendarCheckLine,
  RiFundsLine,
  RiLineChartLine,
  RiWallet3Line,
} from 'react-icons/ri';
import type { InvestmentSummary } from '../investments.types';
import { currency } from '../investments.utils';

type InvestmentSummaryCardsProps = {
  summary?: InvestmentSummary;
};

export function InvestmentSummaryCards({ summary }: InvestmentSummaryCardsProps) {
  const cards = [
    { label: 'Total Investments', value: summary?.investment_count || 0, icon: RiFundsLine, tone: 'bg-[#EEF6FF] text-[#4F9CF9]' },
    { label: 'Monthly SIP Total', value: currency.format(summary?.total_monthly_sip || 0), icon: RiWallet3Line, tone: 'bg-[#FFF7E8] text-[#FFB84D]' },
    { label: 'Total Invested', value: currency.format(summary?.total_invested_amount || 0), icon: RiBarChartBoxLine, tone: 'bg-[#EEF6FF] text-[#4F9CF9]' },
    { label: 'Current Portfolio Value', value: currency.format(summary?.current_value || 0), icon: RiLineChartLine, tone: 'bg-[#EAFBF0] text-[#34C759]' },
    { label: 'Estimated Future Value', value: currency.format(summary?.projected_future_value || 0), icon: RiCalendarCheckLine, tone: 'bg-[#EEF6FF] text-[#4F9CF9]' },
    {
      label: 'Estimated Capital Gain',
      value: currency.format(summary?.estimated_capital_gain || 0),
      icon: RiLineChartLine,
      tone: 'bg-[#EAFBF0] text-[#34C759]',
      valueClass: (summary?.estimated_capital_gain || 0) < 0 ? 'text-[#FF6B6B]' : 'text-[#34C759]',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map(({ icon: Icon, label, tone, value, valueClass }) => (
        <StatCard
          key={label}
          icon={<Icon className="text-lg" aria-hidden="true" />}
          iconClassName={tone}
          label={label}
          value={value}
          valueClassName={valueClass}
        />
      ))}
    </div>
  );
}
