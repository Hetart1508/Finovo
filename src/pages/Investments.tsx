import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { investmentSummaryQuery, investmentsQuery } from '@/src/server-state/investmentsQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import {
  RiAddCircleLine,
} from 'react-icons/ri';
import type { Investment, InvestmentSummary } from '@/src/features/investments/investments.types';
import { InvestmentForecastCards } from '@/src/features/investments/components/InvestmentForecastCards';
import { InvestmentForm } from '@/src/features/investments/components/InvestmentForm';
import { InvestmentSummaryCards } from '@/src/features/investments/components/InvestmentSummaryCards';
import { InvestmentsListCard } from '@/src/features/investments/components/InvestmentsListCard';
import { SipCalculatorCard } from '@/src/features/investments/components/SipCalculatorCard';
import { SipGrowthChartCard } from '@/src/features/investments/components/SipGrowthChartCard';
import { useInvestmentFormState } from '@/src/features/investments/hooks/useInvestmentFormState';
import { useInvestmentMutations } from '@/src/features/investments/hooks/useInvestmentMutations';
import { useSipCalculator } from '@/src/features/investments/hooks/useSipCalculator';

export default function Investments() {
  const investmentsResult = useQuery(investmentsQuery());
  const summaryResult = useQuery(investmentSummaryQuery());
  const investments = (investmentsResult.data ?? []) as Investment[];
  const summary = summaryResult.data as InvestmentSummary | undefined;
  const calculator = useSipCalculator();
  const investmentForm = useInvestmentFormState();
  const investmentMutations = useInvestmentMutations({
    editingInvestment: investmentForm.editingInvestment,
    formTotalInvested: investmentForm.formTotalInvested,
    formCurrentValue: investmentForm.formCurrentValue,
    onSaved: investmentForm.closeDialog,
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

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 pb-8 sm:space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Investment planner</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-[#1F2937] sm:text-3xl">Mutual Funds & Investments</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
            Track SIP commitments, lumpsum capital, current portfolio value, and expected growth.
          </p>
        </div>

        <Dialog open={investmentForm.dialogOpen} onOpenChange={(open) => {
          investmentForm.setDialogOpen(open);
          if (!open) investmentForm.closeDialog();
        }}>
          <DialogTrigger>
            <Button className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5] md:w-auto" onClick={investmentForm.openCreateDialog}>
              <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
              Add Investment
            </Button>
          </DialogTrigger>
          <DialogContent className="grid h-[calc(100dvh-0.75rem)] max-w-[calc(100%-0.75rem)] grid-rows-[auto_1fr] gap-2 overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-3xl sm:gap-4 sm:overflow-y-auto sm:p-4">
            <DialogHeader className="gap-0 pr-8 sm:gap-2">
              <DialogTitle className="text-sm sm:text-base">{investmentForm.editingInvestment ? 'Edit Investment' : 'Add SIP / Lumpsum Investment'}</DialogTitle>
            </DialogHeader>
            <InvestmentForm
              editingInvestment={investmentForm.editingInvestment}
              selectedInvestmentType={investmentForm.selectedInvestmentType}
              investmentAmount={investmentForm.investmentAmount}
              formTotalInvested={investmentForm.formTotalInvested}
              formCurrentValue={investmentForm.formCurrentValue}
              formExpectedCagr={investmentForm.formExpectedCagr}
              formStartDate={investmentForm.formStartDate}
              formEndDate={investmentForm.formEndDate}
              isSaving={investmentMutations.isSaving}
              onInvestmentTypeChange={investmentForm.setSelectedInvestmentType}
              onInvestmentAmountChange={investmentForm.setInvestmentAmount}
              onExpectedCagrChange={investmentForm.setFormExpectedCagr}
              onStartDateChange={investmentForm.setFormStartDate}
              onEndDateChange={investmentForm.setFormEndDate}
              onSubmit={investmentMutations.handleSave}
              onCancel={investmentForm.closeDialog}
            />
          </DialogContent>
        </Dialog>
      </div>

      <InvestmentSummaryCards summary={summary} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
        <SipCalculatorCard
          monthlySip={calculator.monthlySip}
          cagr={calculator.cagr}
          startDate={calculator.startDate}
          endDate={calculator.endDate}
          result={calculator.result}
          onMonthlySipChange={calculator.setMonthlySip}
          onCagrChange={calculator.setCagr}
          onStartDateChange={calculator.setStartDate}
          onEndDateChange={calculator.setEndDate}
        />
        <SipGrowthChartCard growthData={calculator.result.growthData} />
      </div>

      <InvestmentForecastCards
        investments={investments}
        isLoading={investmentsResult.isPending}
        onAddInvestment={investmentForm.openCreateDialog}
      />

      <InvestmentsListCard
        investments={investments}
        summary={summary}
        isLoading={investmentsResult.isPending}
        isDeleting={investmentMutations.isDeleting}
        onEditInvestment={investmentForm.openEditDialog}
        onDeleteInvestment={investmentMutations.handleDelete}
      />
    </div>
  );
}
