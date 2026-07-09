import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { RiFundsLine } from 'react-icons/ri';
import type { Investment } from '../investments.types';
import { currency, getInvestmentType, getInvestmentTypeLabel } from '../investments.utils';

type InvestmentForecastCardsProps = {
  investments: Investment[];
  isLoading: boolean;
  onAddInvestment: () => void;
};

export function InvestmentForecastCards({ investments, isLoading, onAddInvestment }: InvestmentForecastCardsProps) {
  return (
    <Card className="surface-panel rounded-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Fund-wise Forecast</CardTitle>
        <p className="text-sm text-[#6B7280]">Projected value and estimated gains for each tracked fund.</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-[#6B7280]">Loading fund forecasts...</p>
        ) : investments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#DCE3EC] bg-[#FAFBFC] px-6 py-12 text-center">
            <RiFundsLine className="mx-auto text-4xl text-[#4F9CF9]" aria-hidden="true" />
            <p className="mt-3 font-semibold">Your fund forecast will appear here</p>
            <p className="mt-1 text-sm text-[#6B7280]">Add your first SIP or mutual fund to compare projected growth.</p>
            <Button className="mt-4 bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={onAddInvestment}>Add Investment</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {investments.map((investment) => {
              const investmentType = getInvestmentType(investment);
              return (
                <div key={investment.id} className="rounded-lg border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{investment.sip_name}</p>
                      <p className="mt-1 truncate text-xs text-[#6B7280]">{investment.fund_name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant="secondary">{getInvestmentTypeLabel(investmentType)}</Badge>
                      <Badge variant="outline" className="border-[#DCEEFF] text-[#4F9CF9]">{Number(investment.expected_cagr)}%</Badge>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[#6B7280]">Future Value</p>
                      <p className="mt-1 font-bold text-[#4F9CF9]">{currency.format(Number(investment.future_value))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280]">Estimated Gain</p>
                      <p className={`mt-1 font-bold ${Number(investment.estimated_capital_gain) < 0 ? 'text-[#FF6B6B]' : 'text-[#34C759]'}`}>{currency.format(Number(investment.estimated_capital_gain))}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-xs text-[#6B7280]">
                    {investment.months} months - {investmentType === 'lumpsum' ? currency.format(Number(investment.total_invested_amount)) : `${currency.format(Number(investment.monthly_sip_amount))}/month`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
