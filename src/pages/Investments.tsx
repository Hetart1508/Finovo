import { useEffect, useMemo, useState } from 'react';
import { addYears, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import api from '@/src/lib/api';
import { investmentSummaryQuery, investmentsQuery, queryKeys } from '@/src/lib/serverState';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import {
  calculateLumpsumFutureValue,
  calculateEstimatedCapitalGain,
  calculateSipFutureValue,
  generateSipGrowthData,
  getSipDurationMonths,
} from '@/src/lib/investmentCalculations';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  RiAddCircleLine,
  RiBarChartBoxLine,
  RiCalendarCheckLine,
  RiDeleteBin6Line,
  RiFundsLine,
  RiLineChartLine,
  RiPencilLine,
  RiWallet3Line,
} from 'react-icons/ri';

type Investment = {
  id: number;
  investment_type?: InvestmentType;
  sip_name: string;
  fund_name: string;
  monthly_sip_amount: number;
  total_invested_amount: number;
  current_value: number;
  expected_cagr: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  months: number;
  future_value: number;
  estimated_capital_gain: number;
};

type InvestmentType = 'sip' | 'lumpsum';

type InvestmentSummary = {
  investment_count: number;
  sip_count: number;
  lumpsum_count: number;
  total_monthly_sip: number;
  total_lumpsum_amount: number;
  total_invested_amount: number;
  current_value: number;
  current_capital_gain: number;
  projected_future_value: number;
  estimated_capital_gain: number;
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const today = format(new Date(), 'yyyy-MM-dd');
const defaultEndDate = format(addYears(new Date(), 10), 'yyyy-MM-dd');

const getInvestmentType = (investment?: Pick<Investment, 'investment_type'> | null): InvestmentType =>
  investment?.investment_type === 'lumpsum' ? 'lumpsum' : 'sip';

const getInvestmentTypeLabel = (type: InvestmentType) => type === 'lumpsum' ? 'Lumpsum' : 'SIP';

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

  const refreshInvestments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.investments }),
      queryClient.invalidateQueries({ queryKey: queryKeys.investmentSummary }),
    ]);
  };

  const saveInvestment = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? api.put(`/investments/${id}`, payload) : api.post('/investments', payload),
    onSuccess: refreshInvestments,
  });

  const deleteInvestment = useMutation({
    mutationFn: (id: number) => api.delete(`/investments/${id}`),
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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
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

  const compactFieldClass = "space-y-1 sm:space-y-2";
  const compactInputClass = "h-8 px-2 text-sm sm:h-10 sm:px-3";
  const compactDateClass = "[&_input]:h-8 [&_input]:px-2 [&_input]:pr-8 [&_input]:text-sm sm:[&_input]:h-10 sm:[&_input]:px-3 sm:[&_input]:pr-10";
  const compactLabelClass = "text-xs leading-tight sm:text-sm";

  const form = (
    <form key={editingInvestment?.id ?? 'new'} onSubmit={handleSave} className="flex min-h-0 flex-col gap-2 py-0 sm:gap-5 sm:py-2">
      <div className={compactFieldClass}>
        <Label htmlFor="investment-type" className={compactLabelClass}>Investment Type</Label>
        <Select
          name="investment_type"
          value={selectedInvestmentType}
          onValueChange={(value) => setSelectedInvestmentType(value as InvestmentType)}
        >
          <SelectTrigger id="investment-type" className={`h-8 w-full px-2 text-sm sm:h-10 sm:px-3`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="bottom" align="start" alignItemWithTrigger={false}>
            <SelectItem value="sip">SIP</SelectItem>
            <SelectItem value="lumpsum">Lumpsum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className={compactFieldClass}>
          <Label htmlFor="investment-sip-name" className={compactLabelClass}>Investment Name</Label>
          <Input id="investment-sip-name" name="sip_name" defaultValue={editingInvestment?.sip_name || ''} placeholder={selectedInvestmentType === 'lumpsum' ? 'Long-term corpus' : 'Retirement SIP'} maxLength={255} required className={compactInputClass} />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-fund-name" className={compactLabelClass}>Fund Name</Label>
          <Input id="investment-fund-name" name="fund_name" defaultValue={editingInvestment?.fund_name || ''} placeholder="Equity Growth Fund" maxLength={255} required className={compactInputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        <div className={compactFieldClass}>
          <Label htmlFor="investment-monthly-sip" className={compactLabelClass}>{selectedInvestmentType === 'lumpsum' ? 'Lumpsum Amount (₹)' : 'Monthly SIP Amount (₹)'}</Label>
          <Input
            id="investment-monthly-sip"
            name="monthly_sip_amount"
            type="number"
            min="0.01"
            step="0.01"
            value={investmentAmount}
            onChange={(event) => setInvestmentAmount(event.target.value)}
            className={compactInputClass}
            required
          />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-total" className={compactLabelClass}>{selectedInvestmentType === 'sip' ? 'Total Invested Amount (₹)' : 'Invested Amount (₹)'}</Label>
          <Input
            id="investment-total"
            name="total_invested_amount"
            type="number"
            min="0"
            step="0.01"
            value={Number.isFinite(formTotalInvested) ? formTotalInvested : ''}
            readOnly
            className={`${compactInputClass} bg-[#FAFBFC] dark:bg-[#111827]`}
            required
          />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-current" className={compactLabelClass}>Calculated Current Value (₹)</Label>
          <Input
            id="investment-current"
            name="current_value"
            type="number"
            min="0"
            step="0.01"
            value={formCurrentValue}
            readOnly
            className={`${compactInputClass} bg-[#FAFBFC] dark:bg-[#111827]`}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={compactFieldClass}>
          <Label htmlFor="investment-cagr" className={compactLabelClass}>Expected CAGR %</Label>
          <Input
            id="investment-cagr"
            name="expected_cagr"
            type="number"
            min="0"
            max="999.9999"
            step="0.0001"
            value={formExpectedCagr}
            onChange={(event) => setFormExpectedCagr(event.target.value)}
            className={compactInputClass}
            required
          />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-start" className={compactLabelClass}>Start Date</Label>
          <AppDatePicker id="investment-start" name="start_date" value={formStartDate} onChange={setFormStartDate} required className={compactDateClass} />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-end" className={compactLabelClass}>End Date</Label>
          <AppDatePicker id="investment-end" name="end_date" value={formEndDate} onChange={setFormEndDate} min={formStartDate} required className={compactDateClass} />
        </div>
      </div>

      <div className={compactFieldClass}>
        <Label htmlFor="investment-notes" className={compactLabelClass}>Notes</Label>
        <textarea
          id="investment-notes"
          name="notes"
          rows={2}
          defaultValue={editingInvestment?.notes || ''}
          placeholder="Goal, strategy, folio notes…"
          className="h-14 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-auto sm:px-3 sm:py-2"
        />
      </div>

      <DialogFooter className="-mx-3 -mb-3 mt-auto !grid grid-cols-2 gap-2 p-3 sm:-mx-4 sm:-mb-4 sm:!flex sm:p-4">
        <Button type="button" variant="outline" className="h-9" onClick={closeDialog}>Cancel</Button>
        <Button type="submit" className="h-9 bg-[#4F9CF9] hover:bg-[#3F8BE5]" disabled={saveInvestment.isPending}>
          {saveInvestment.isPending ? 'Saving…' : editingInvestment ? 'Save Changes' : 'Add Investment'}
        </Button>
      </DialogFooter>
    </form>
  );

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
            {form}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9]">
              <RiFundsLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Total Investments</p>
            <h3 className="mt-1 text-2xl font-bold">{summary?.investment_count || 0}</h3>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF7E8] text-[#FFB84D]">
              <RiWallet3Line className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Monthly SIP Total</p>
            <h3 className="mt-1 text-2xl font-bold">{currency.format(summary?.total_monthly_sip || 0)}</h3>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9]">
              <RiBarChartBoxLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Total Invested</p>
            <h3 className="mt-1 text-2xl font-bold">{currency.format(summary?.total_invested_amount || 0)}</h3>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAFBF0] text-[#34C759]">
              <RiLineChartLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Current Portfolio Value</p>
            <h3 className="mt-1 text-2xl font-bold">{currency.format(summary?.current_value || 0)}</h3>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9]">
              <RiCalendarCheckLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Estimated Future Value</p>
            <h3 className="mt-1 text-2xl font-bold">{currency.format(summary?.projected_future_value || 0)}</h3>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAFBF0] text-[#34C759]">
              <RiLineChartLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Estimated Capital Gain</p>
            <h3 className={`mt-1 text-2xl font-bold ${(summary?.estimated_capital_gain || 0) < 0 ? 'text-[#FF6B6B]' : 'text-[#34C759]'}`}>
              {currency.format(summary?.estimated_capital_gain || 0)}
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">SIP Calculator</CardTitle>
            <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Estimate future value using monthly compounding and expected CAGR.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calculator-monthly-sip">Monthly SIP Amount (₹)</Label>
              <Input id="calculator-monthly-sip" type="number" min="0" step="100" value={calculatorMonthlySip} onChange={(event) => setCalculatorMonthlySip(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="calculator-cagr">Expected CAGR %</Label>
                <Input id="calculator-cagr" type="number" min="0" step="0.1" value={calculatorCagr} onChange={(event) => setCalculatorCagr(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calculator-invested">Total Invested (₹)</Label>
                <Input id="calculator-invested" value={calculatorResult.totalInvested} readOnly className="bg-[#FAFBFC] dark:bg-[#111827]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="calculator-start">Start Date</Label>
                <AppDatePicker id="calculator-start" value={calculatorStartDate} onChange={setCalculatorStartDate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calculator-end">End Date</Label>
                <AppDatePicker id="calculator-end" min={calculatorStartDate} value={calculatorEndDate} onChange={setCalculatorEndDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-[#EEF6FF] p-3 text-center dark:bg-[#1E293B]">
                <p className="text-xs font-semibold uppercase text-[#6B7280]">Future Value</p>
                <p className="mt-1 text-lg font-bold text-[#4F9CF9]">{currency.format(calculatorResult.futureValue)}</p>
              </div>
              <div className="rounded-lg bg-[#EAFBF0] p-3 text-center dark:bg-[#1E293B]">
                <p className="text-xs font-semibold uppercase text-[#6B7280]">Capital Gain</p>
                <p className={`mt-1 text-lg font-bold ${calculatorResult.capitalGain < 0 ? 'text-[#FF6B6B]' : 'text-[#34C759]'}`}>{currency.format(calculatorResult.capitalGain)}</p>
              </div>
            </div>
            <p className="text-center text-xs text-[#6B7280] dark:text-[#CBD5E1]">
              {calculatorResult.months} months • figures are estimates, not guaranteed returns
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Projected SIP Growth</CardTitle>
            <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Month-wise up to 3 years, then year-wise for longer plans.</p>
          </CardHeader>
          <CardContent className="h-[360px]">
            {calculatorResult.growthData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calculatorResult.growthData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip
                    formatter={(value: any, name: string) => [currency.format(Number(value)), name === 'estimatedValue' ? 'Estimated Value' : 'Contributed']}
                    labelFormatter={(label) => `Duration: ${label}`}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 12px 30px rgba(31,41,55,0.12)' }}
                  />
                  <Legend formatter={(value) => value === 'estimatedValue' ? 'Estimated Value' : 'Contributed Amount'} />
                  <Line type="monotone" dataKey="estimatedValue" stroke="#4F9CF9" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="contributedAmount" stroke="#FFB84D" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-[#DCE3EC] bg-[#FAFBFC] px-6 text-center dark:border-[#334155] dark:bg-[#111827]">
                <RiLineChartLine className="text-4xl text-[#4F9CF9]" aria-hidden="true" />
                <p className="mt-3 font-semibold">Enter a valid SIP plan to see its growth</p>
                <p className="mt-1 max-w-sm text-sm text-[#6B7280] dark:text-[#CBD5E1]">The end date must be after the start date and the monthly amount must be greater than zero.</p>
              </div>
            )}
          </CardContent>
        </Card>
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
