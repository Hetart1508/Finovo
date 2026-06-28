import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
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
} from 'react-icons/ri';
import type { Investment, InvestmentSummary, InvestmentType } from '@/src/features/investments/investments.types';
import { defaultEndDate, getInvestmentType, today } from '@/src/features/investments/investments.utils';
import { InvestmentForecastCards } from '@/src/features/investments/components/InvestmentForecastCards';
import { InvestmentForm } from '@/src/features/investments/components/InvestmentForm';
import { InvestmentSummaryCards } from '@/src/features/investments/components/InvestmentSummaryCards';
import { InvestmentsListCard } from '@/src/features/investments/components/InvestmentsListCard';
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

      <InvestmentForecastCards
        investments={investments}
        isLoading={investmentsResult.isPending}
        onAddInvestment={openCreateDialog}
      />

      <InvestmentsListCard
        investments={investments}
        summary={summary}
        isLoading={investmentsResult.isPending}
        isDeleting={deleteInvestment.isPending}
        onEditInvestment={(investment) => {
          setEditingInvestment(investment);
          setDialogOpen(true);
        }}
        onDeleteInvestment={handleDelete}
      />
    </div>
  );
}
