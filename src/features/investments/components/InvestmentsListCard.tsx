import { format, parseISO } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StateMessage } from '@/src/components/shared/StateMessage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { RiDeleteBin6Line, RiPencilLine } from 'react-icons/ri';
import type { Investment, InvestmentSummary } from '../investments.types';
import { currency, getInvestmentType, getInvestmentTypeLabel } from '../investments.utils';

type InvestmentsListCardProps = {
  investments: Investment[];
  summary: InvestmentSummary | undefined;
  isLoading: boolean;
  isDeleting: boolean;
  onEditInvestment: (investment: Investment) => void;
  onDeleteInvestment: (investment: Investment) => void;
};

export function InvestmentsListCard({
  investments,
  summary,
  isLoading,
  isDeleting,
  onEditInvestment,
  onDeleteInvestment,
}: InvestmentsListCardProps) {
  return (
    <Card className="surface-panel overflow-hidden rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-semibold">Your Investments</CardTitle>
          <p className="mt-1 text-sm text-[#6B7280]">{investments.length} fund{investments.length === 1 ? '' : 's'} tracked</p>
        </div>
        <Badge variant="secondary">{summary?.sip_count || 0} SIPs - {summary?.lumpsum_count || 0} Lumpsums</Badge>
      </CardHeader>
      <CardContent>
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investment / Fund</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Invested</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-center">CAGR</TableHead>
                <TableHead>Investment Period</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}><StateMessage className="py-10">Loading investments...</StateMessage></TableCell></TableRow>
              ) : investments.length === 0 ? (
                <TableRow><TableCell colSpan={7}><StateMessage className="py-10">No investments added yet.</StateMessage></TableCell></TableRow>
              ) : investments.map((investment) => (
                <InvestmentTableRow
                  key={investment.id}
                  investment={investment}
                  isDeleting={isDeleting}
                  onEditInvestment={onEditInvestment}
                  onDeleteInvestment={onDeleteInvestment}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 lg:hidden">
          {isLoading ? (
            <StateMessage className="py-10">Loading investments...</StateMessage>
          ) : investments.length === 0 ? (
            <StateMessage className="py-10">No investments added yet.</StateMessage>
          ) : investments.map((investment) => (
            <InvestmentMobileCard
              key={investment.id}
              investment={investment}
              isDeleting={isDeleting}
              onEditInvestment={onEditInvestment}
              onDeleteInvestment={onDeleteInvestment}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InvestmentTableRow({
  investment,
  isDeleting,
  onEditInvestment,
  onDeleteInvestment,
}: Omit<InvestmentsListCardProps, 'investments' | 'summary' | 'isLoading'> & { investment: Investment }) {
  const investmentType = getInvestmentType(investment);

  return (
    <TableRow>
      <TableCell className="max-w-[16rem] whitespace-normal">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#1F2937]">{investment.sip_name}</p>
          <Badge variant="secondary">{getInvestmentTypeLabel(investmentType)}</Badge>
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">{investment.fund_name}</p>
        {investment.notes ? <p className="mt-1 truncate text-xs text-[#6B7280]" title={investment.notes}>{investment.notes}</p> : null}
      </TableCell>
      <TableCell className="text-right font-semibold">
        {investmentType === 'lumpsum' ? currency.format(Number(investment.total_invested_amount)) : `${currency.format(Number(investment.monthly_sip_amount))}/mo`}
      </TableCell>
      <TableCell className="text-right">{currency.format(Number(investment.total_invested_amount))}</TableCell>
      <TableCell className="text-right font-semibold text-[#34C759]">{currency.format(Number(investment.current_value))}</TableCell>
      <TableCell className="text-center"><Badge variant="outline" className="border-[#DCEEFF] text-[#4F9CF9]">{Number(investment.expected_cagr)}%</Badge></TableCell>
      <TableCell className="text-[#6B7280]">
        {format(parseISO(investment.start_date), 'dd MMM yyyy')} - {format(parseISO(investment.end_date), 'dd MMM yyyy')}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" className="text-[#6B7280] hover:text-[#4F9CF9]" onClick={() => onEditInvestment(investment)} aria-label={`Edit ${investment.sip_name}`}>
            <RiPencilLine className="text-base" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-[#6B7280] hover:text-[#FF6B6B]" onClick={() => onDeleteInvestment(investment)} disabled={isDeleting} aria-label={`Delete ${investment.sip_name}`}>
            <RiDeleteBin6Line className="text-base" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function InvestmentMobileCard({
  investment,
  isDeleting,
  onEditInvestment,
  onDeleteInvestment,
}: Omit<InvestmentsListCardProps, 'investments' | 'summary' | 'isLoading'> & { investment: Investment }) {
  const investmentType = getInvestmentType(investment);

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
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
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-[#6B7280]">{investmentType === 'lumpsum' ? 'Lumpsum Amount' : 'Monthly SIP'}</p>
          <p className="mt-1 font-semibold">{investmentType === 'lumpsum' ? currency.format(Number(investment.total_invested_amount)) : currency.format(Number(investment.monthly_sip_amount))}</p>
        </div>
        <div><p className="text-xs text-[#6B7280]">Current Value</p><p className="mt-1 font-semibold text-[#34C759]">{currency.format(Number(investment.current_value))}</p></div>
        <div className="col-span-2"><p className="text-xs text-[#6B7280]">Period</p><p className="mt-1">{format(parseISO(investment.start_date), 'dd MMM yyyy')} - {format(parseISO(investment.end_date), 'dd MMM yyyy')}</p></div>
      </div>
      {investment.notes ? <p className="mt-3 text-xs text-[#6B7280]">{investment.notes}</p> : null}
      <div className="mt-4 flex justify-end gap-2 border-t border-[#E5E7EB] pt-3">
        <Button variant="outline" size="sm" onClick={() => onEditInvestment(investment)}><RiPencilLine className="mr-2" />Edit</Button>
        <Button variant="outline" size="sm" className="text-[#FF6B6B]" onClick={() => onDeleteInvestment(investment)} disabled={isDeleting}><RiDeleteBin6Line className="mr-2" />Delete</Button>
      </div>
    </div>
  );
}
