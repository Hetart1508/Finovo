import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { investmentsApi } from '@/src/api/investmentsApi';
import { investmentSummaryQuery, investmentsQuery } from '@/src/server-state/investmentsQueries';
import { invalidateInvestments } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import {
  calculateLumpsumFutureValue,
  calculateEstimatedCapitalGain,
  calculateSipFutureValue,
  generateSipGrowthData,
  getSipDurationMonths,
} from '@/src/lib/investmentCalculations';
import {
  RiAddCircleLine,
  RiCalendarCheckLine,
  RiDeleteBin6Line,
  RiFundsLine,
  RiPencilLine,
} from 'react-icons/ri';
import type { Investment, InvestmentSummary, InvestmentType } from '@/src/features/investments/investments.types';
import { currency, defaultEndDate, getInvestmentType, getInvestmentTypeLabel, today } from '@/src/features/investments/investments.utils';
import { InvestmentForm } from '@/src/features/investments/components/InvestmentForm';
import { InvestmentSummaryCards } from '@/src/features/investments/components/InvestmentSummaryCards';
import { SipCalculatorCard } from '@/src/features/investments/components/SipCalculatorCard';
import { SipGrowthChartCard } from '@/src/features/investments/components/SipGrowthChartCard';

export default function Investments() {
  const queryClient = useQueryClient();
  const investmentsResult = useQuery(investmentsQuery());
  const summaryResult = useQuery(investmentSummaryQuery());
  const investments = (investmentsResult.data ?? []) as Investment[];
  const summary = summaryResult.data as InvestmentSummary | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedInvestmentType, setSelectedInvestmentType] = useState<InvestmentType>('sip');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [formExpectedCagr, setFormExpectedCagr] = useState('12');
  const [formStartDate, setFormStartDate] = useState(today);
  const [formEndDate, setFormEndDate] = useState(defaultEndDate);
  const [calculatorMonthlySip, setCalculatorMonthlySip] = useState('5000');
  const [calculatorCagr, setCalculatorCagr] = useState('12');
  const [calculatorStartDate, setCalculatorStartDate] = useState(today);
  const [calculatorEndDate, setCalculatorEndDate] = useState(defaultEndDate);

  const calculatorResult = useMemo(() => {
    const monthlySip = Number(calculatorMonthlySip);
    const cagr = Number(calculatorCagr);
    const months = getSipDurationMonths(calculatorStartDate, calculatorEndDate);
    const totalInvested = Number.isFinite(monthlySip) ? monthlySip * months : 0;
    const futureValue = calculateSipFutureValue(monthlySip, cagr, months);
    return {
      months,
      totalInvested,
      futureValue,
      capitalGain: calculateEstimatedCapitalGain(futureValue, totalInvested),
      growthData: generateSipGrowthData(monthlySip, cagr, calculatorStartDate, calculatorEndDate),
    };
  }, [calculatorCagr, calculatorEndDate, calculatorMonthlySip, calculatorStartDate]);

  const formTotalInvested = useMemo(() => {
    const amount = Number(investmentAmount);
    if (selectedInvestmentType === 'lumpsum') return Number.isFinite(amount) ? amount : 0;
    const months = getSipDurationMonths(formStartDate, formEndDate);
    return Number.isFinite(amount) ? amount * months : 0;
  }, [formEndDate, formStartDate, investmentAmount, selectedInvestmentType]);

  const formCurrentValue = useMemo(() => {
    const amount = Number(investmentAmount);
    const cagr = Number(formExpectedCagr);
    if (formStartDate > today) return 0;

    const elapsedSipMonths = getSipDurationMonths(formStartDate, today);
    const elapsedLumpsumMonths = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(formStartDate)) / 365 * 12);
    const calculatedValue = selectedInvestmentType === 'lumpsum'
      ? calculateLumpsumFutureValue(amount, cagr, elapsedLumpsumMonths)
      : calculateSipFutureValue(amount, cagr, elapsedSipMonths);

    return Number.isFinite(calculatedValue) ? Number(calculatedValue.toFixed(2)) : 0;
  }, [formExpectedCagr, formStartDate, investmentAmount, selectedInvestmentType]);

  const refreshInvestments = () => invalidateInvestments(queryClient);

  const saveInvestment = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      investmentsApi.save(id, payload),
    onSuccess: refreshInvestments,
  });

  const deleteInvestment = useMutation({
    mutationFn: (id: number) => investmentsApi.delete(id),
    onSuccess: refreshInvestments,
  });

  useEffect(() => {
    if (investmentsResult.error) {
      toast.error(getApiMessage(investmentsResult.error, 'Failed to load investments.'), { toastId: 'investments-query-error' });
    }
  }, [investmentsResult.error]);

  useEffect(() => {
    if (summaryResult.error) {
      toast.error(getApiMessage(summaryResult.error, 'Failed to load investment summary.'), { toastId: 'investment-summary-error' });
    }
  }, [summaryResult.error]);

  useEffect(() => {
    if (!dialogOpen || !editingInvestment) return;
    setSelectedInvestmentType(getInvestmentType(editingInvestment));
    setInvestmentAmount(editingInvestment?.monthly_sip_amount ? String(editingInvestment.monthly_sip_amount) : '');
    setFormExpectedCagr(editingInvestment?.expected_cagr !== undefined ? String(editingInvestment.expected_cagr) : '12');
    setFormStartDate(editingInvestment?.start_date || today);
    setFormEndDate(editingInvestment?.end_date || defaultEndDate);
  }, [dialogOpen, editingInvestment?.id]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingInvestment(null);
  };

  const openCreateDialog = () => {
    setEditingInvestment(null);
    setSelectedInvestmentType('sip');
    setInvestmentAmount('');
    setFormExpectedCagr('12');
    setFormStartDate(today);
    setFormEndDate(defaultEndDate);
    setDialogOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const startDate = String(data.start_date || '');
    const endDate = String(data.end_date || '');

    if (endDate < startDate) {
      toast.error('End date must be on or after start date.');
      return;
    }

    const investmentType = data.investment_type === 'lumpsum' ? 'lumpsum' : 'sip';
    const amount = Number(data.monthly_sip_amount);
    const payload = {
      investment_type: investmentType,
      sip_name: String(data.sip_name || '').trim(),
      fund_name: String(data.fund_name || '').trim(),
      monthly_sip_amount: amount,
      total_invested_amount: investmentType === 'lumpsum' ? amount : formTotalInvested,
      current_value: formCurrentValue,
      expected_cagr: Number(data.expected_cagr),
      start_date: startDate,
      end_date: endDate,
      notes: String(data.notes || '').trim(),
    };

    try {
      const response = await saveInvestment.mutateAsync({ id: editingInvestment?.id, payload });
      toast.success(getApiSuccessMessage(
        response.data,
        editingInvestment ? 'Investment updated successfully.' : 'Investment added successfully.'
      ));
      closeDialog();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save investment.'));
    }
  };

  const handleDelete = async (investment: Investment) => {
    if (!window.confirm(`Delete “${investment.sip_name}”? This action cannot be undone.`)) return;

    try {
      const response = await deleteInvestment.mutateAsync(investment.id);
      toast.success(getApiSuccessMessage(response.data, 'Investment deleted successfully.'));
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to delete investment.'));
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Investment planner</p>
          <h1 className="mt-2 text-3xl font-black text-[#1F2937]">Mutual Funds & Investments</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280] dark:text-[#CBD5E1]">
            Track SIP commitments, lumpsum capital, current portfolio value, and expected growth.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingInvestment(null);
        }}>
          <DialogTrigger>
            <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={openCreateDialog}>
              <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
              Add Investment
            </Button>
          </DialogTrigger>
          <DialogContent className="grid h-[calc(100dvh-0.75rem)] max-w-[calc(100%-0.75rem)] grid-rows-[auto_1fr] gap-2 overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-3xl sm:gap-4 sm:overflow-y-auto sm:p-4">
            <DialogHeader className="gap-0 pr-8 sm:gap-2">
              <DialogTitle className="text-sm sm:text-base">{editingInvestment ? 'Edit Investment' : 'Add SIP / Lumpsum Investment'}</DialogTitle>
            </DialogHeader>
            <InvestmentForm
              editingInvestment={editingInvestment}
              selectedInvestmentType={selectedInvestmentType}
              investmentAmount={investmentAmount}
              formTotalInvested={formTotalInvested}
              formCurrentValue={formCurrentValue}
              formExpectedCagr={formExpectedCagr}
              formStartDate={formStartDate}
              formEndDate={formEndDate}
              isSaving={saveInvestment.isPending}
              onInvestmentTypeChange={setSelectedInvestmentType}
              onInvestmentAmountChange={setInvestmentAmount}
              onExpectedCagrChange={setFormExpectedCagr}
              onStartDateChange={setFormStartDate}
              onEndDateChange={setFormEndDate}
              onSubmit={handleSave}
              onCancel={closeDialog}
            />
          </DialogContent>
        </Dialog>
      </div>

      <InvestmentSummaryCards summary={summary} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
        <SipCalculatorCard
          monthlySip={calculatorMonthlySip}
          cagr={calculatorCagr}
          startDate={calculatorStartDate}
          endDate={calculatorEndDate}
          result={calculatorResult}
          onMonthlySipChange={setCalculatorMonthlySip}
          onCagrChange={setCalculatorCagr}
          onStartDateChange={setCalculatorStartDate}
          onEndDateChange={setCalculatorEndDate}
        />
        <SipGrowthChartCard growthData={calculatorResult.growthData} />
      </div>

      <Card className="surface-panel rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Fund-wise Forecast</CardTitle>
          <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Projected value and estimated gains for each tracked fund.</p>
        </CardHeader>
        <CardContent>
          {investmentsResult.isPending ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">Loading fund forecasts…</p>
          ) : investments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#DCE3EC] bg-[#FAFBFC] px-6 py-12 text-center dark:border-[#334155] dark:bg-[#111827]">
              <RiFundsLine className="mx-auto text-4xl text-[#4F9CF9]" aria-hidden="true" />
              <p className="mt-3 font-semibold">Your fund forecast will appear here</p>
              <p className="mt-1 text-sm text-[#6B7280] dark:text-[#CBD5E1]">Add your first SIP or mutual fund to compare projected growth.</p>
              <Button className="mt-4 bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={openCreateDialog}>Add Investment</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {investments.map((investment) => {
                const investmentType = getInvestmentType(investment);
                return (
                <div key={investment.id} className="rounded-lg border border-[#E5E7EB] bg-white p-5 dark:border-[#334155] dark:bg-[#111827]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{investment.sip_name}</p>
                      <p className="mt-1 truncate text-xs text-[#6B7280] dark:text-[#CBD5E1]">{investment.fund_name}</p>
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
                  <p className="mt-4 text-center text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                    {investment.months} months • {investmentType === 'lumpsum' ? currency.format(Number(investment.total_invested_amount)) : `${currency.format(Number(investment.monthly_sip_amount))}/month`}
                  </p>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel overflow-hidden rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Your Investments</CardTitle>
            <p className="mt-1 text-sm text-[#6B7280] dark:text-[#CBD5E1]">{investments.length} fund{investments.length === 1 ? '' : 's'} tracked</p>
          </div>
          <Badge variant="secondary">{summary?.sip_count || 0} SIPs • {summary?.lumpsum_count || 0} Lumpsums</Badge>
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
                {investmentsResult.isPending ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">Loading investments…</TableCell></TableRow>
                ) : investments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-[#6B7280]">No investments added yet.</TableCell></TableRow>
                ) : investments.map((investment) => {
                  const investmentType = getInvestmentType(investment);
                  return (
                  <TableRow key={investment.id}>
                    <TableCell className="max-w-[16rem] whitespace-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1F2937] dark:text-[#F8FAFC]">{investment.sip_name}</p>
                        <Badge variant="secondary">{getInvestmentTypeLabel(investmentType)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">{investment.fund_name}</p>
                      {investment.notes ? <p className="mt-1 truncate text-xs text-[#6B7280]" title={investment.notes}>{investment.notes}</p> : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {investmentType === 'lumpsum' ? currency.format(Number(investment.total_invested_amount)) : `${currency.format(Number(investment.monthly_sip_amount))}/mo`}
                    </TableCell>
                    <TableCell className="text-right">{currency.format(Number(investment.total_invested_amount))}</TableCell>
                    <TableCell className="text-right font-semibold text-[#34C759]">{currency.format(Number(investment.current_value))}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="border-[#DCEEFF] text-[#4F9CF9]">{Number(investment.expected_cagr)}%</Badge></TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#CBD5E1]">
                      {format(parseISO(investment.start_date), 'dd MMM yyyy')} – {format(parseISO(investment.end_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" className="text-[#6B7280] hover:text-[#4F9CF9]" onClick={() => { setEditingInvestment(investment); setDialogOpen(true); }} aria-label={`Edit ${investment.sip_name}`}>
                          <RiPencilLine className="text-base" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-[#6B7280] hover:text-[#FF6B6B]" onClick={() => handleDelete(investment)} disabled={deleteInvestment.isPending} aria-label={`Delete ${investment.sip_name}`}>
                          <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {investmentsResult.isPending ? (
              <p className="py-10 text-center text-sm text-[#6B7280]">Loading investments…</p>
            ) : investments.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#6B7280]">No investments added yet.</p>
            ) : investments.map((investment) => {
              const investmentType = getInvestmentType(investment);
              return (
              <div key={investment.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4 dark:border-[#334155] dark:bg-[#111827]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{investment.sip_name}</p>
                    <p className="mt-1 truncate text-xs text-[#6B7280] dark:text-[#CBD5E1]">{investment.fund_name}</p>
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
                  <div className="col-span-2"><p className="text-xs text-[#6B7280]">Period</p><p className="mt-1">{format(parseISO(investment.start_date), 'dd MMM yyyy')} – {format(parseISO(investment.end_date), 'dd MMM yyyy')}</p></div>
                </div>
                {investment.notes ? <p className="mt-3 text-xs text-[#6B7280] dark:text-[#CBD5E1]">{investment.notes}</p> : null}
                <div className="mt-4 flex justify-end gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#334155]">
                  <Button variant="outline" size="sm" onClick={() => { setEditingInvestment(investment); setDialogOpen(true); }}><RiPencilLine className="mr-2" />Edit</Button>
                  <Button variant="outline" size="sm" className="text-[#FF6B6B]" onClick={() => handleDelete(investment)} disabled={deleteInvestment.isPending}><RiDeleteBin6Line className="mr-2" />Delete</Button>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
