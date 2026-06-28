import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Label } from '@/src/components/ui/label';
import { currency } from '../investments.utils';

type CalculatorResult = {
  months: number;
  totalInvested: number;
  futureValue: number;
  capitalGain: number;
};

type SipCalculatorCardProps = {
  monthlySip: string;
  cagr: string;
  startDate: string;
  endDate: string;
  result: CalculatorResult;
  onMonthlySipChange: (value: string) => void;
  onCagrChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

export function SipCalculatorCard({
  monthlySip,
  cagr,
  startDate,
  endDate,
  result,
  onMonthlySipChange,
  onCagrChange,
  onStartDateChange,
  onEndDateChange,
}: SipCalculatorCardProps) {
  return (
    <Card className="surface-panel rounded-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">SIP Calculator</CardTitle>
        <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Estimate future value using monthly compounding and expected CAGR.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="calculator-monthly-sip">Monthly SIP Amount (₹)</Label>
          <Input id="calculator-monthly-sip" type="number" min="0" step="100" value={monthlySip} onChange={(event) => onMonthlySipChange(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="calculator-cagr">Expected CAGR %</Label>
            <Input id="calculator-cagr" type="number" min="0" step="0.1" value={cagr} onChange={(event) => onCagrChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calculator-invested">Total Invested (₹)</Label>
            <Input id="calculator-invested" value={result.totalInvested} readOnly className="bg-[#FAFBFC] dark:bg-[#111827]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="calculator-start">Start Date</Label>
            <AppDatePicker id="calculator-start" value={startDate} onChange={onStartDateChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calculator-end">End Date</Label>
            <AppDatePicker id="calculator-end" min={startDate} value={endDate} onChange={onEndDateChange} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-[#EEF6FF] p-3 text-center dark:bg-[#1E293B]">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Future Value</p>
            <p className="mt-1 text-lg font-bold text-[#4F9CF9]">{currency.format(result.futureValue)}</p>
          </div>
          <div className="rounded-lg bg-[#EAFBF0] p-3 text-center dark:bg-[#1E293B]">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Capital Gain</p>
            <p className={`mt-1 text-lg font-bold ${result.capitalGain < 0 ? 'text-[#FF6B6B]' : 'text-[#34C759]'}`}>{currency.format(result.capitalGain)}</p>
          </div>
        </div>
        <p className="text-center text-xs text-[#6B7280] dark:text-[#CBD5E1]">
          {result.months} months • figures are estimates, not guaranteed returns
        </p>
      </CardContent>
    </Card>
  );
}
