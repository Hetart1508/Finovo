import type { FormEvent } from 'react';
import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Button } from '@/src/components/ui/button';
import { DialogFooter } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import type { Investment, InvestmentType } from '../investments.types';

type InvestmentFormProps = {
  editingInvestment: Investment | null;
  selectedInvestmentType: InvestmentType;
  investmentAmount: string;
  formTotalInvested: number;
  formCurrentValue: number;
  formExpectedCagr: string;
  formStartDate: string;
  formEndDate: string;
  isSaving: boolean;
  onInvestmentTypeChange: (value: InvestmentType) => void;
  onInvestmentAmountChange: (value: string) => void;
  onExpectedCagrChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const compactFieldClass = 'space-y-1 sm:space-y-2';
const compactInputClass = 'h-8 px-2 text-sm sm:h-10 sm:px-3';
const compactDateClass = '[&_input]:h-8 [&_input]:px-2 [&_input]:pr-8 [&_input]:text-sm sm:[&_input]:h-10 sm:[&_input]:px-3 sm:[&_input]:pr-10';
const compactLabelClass = 'text-xs leading-tight sm:text-sm';

export function InvestmentForm({
  editingInvestment,
  selectedInvestmentType,
  investmentAmount,
  formTotalInvested,
  formCurrentValue,
  formExpectedCagr,
  formStartDate,
  formEndDate,
  isSaving,
  onInvestmentTypeChange,
  onInvestmentAmountChange,
  onExpectedCagrChange,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
  onCancel,
}: InvestmentFormProps) {
  return (
    <form key={editingInvestment?.id ?? 'new'} onSubmit={onSubmit} className="flex min-h-0 flex-col gap-2 py-0 sm:gap-5 sm:py-2">
      <div className={compactFieldClass}>
        <Label htmlFor="investment-type" className={compactLabelClass}>Investment Type</Label>
        <Select name="investment_type" value={selectedInvestmentType} onValueChange={(value) => onInvestmentTypeChange(value as InvestmentType)}>
          <SelectTrigger id="investment-type" className="h-8 w-full px-2 text-sm sm:h-10 sm:px-3">
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
          <Input id="investment-monthly-sip" name="monthly_sip_amount" type="number" min="0.01" step="0.01" value={investmentAmount} onChange={(event) => onInvestmentAmountChange(event.target.value)} className={compactInputClass} required />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-total" className={compactLabelClass}>{selectedInvestmentType === 'sip' ? 'Total Invested Amount (₹)' : 'Invested Amount (₹)'}</Label>
          <Input id="investment-total" name="total_invested_amount" type="number" min="0" step="0.01" value={Number.isFinite(formTotalInvested) ? formTotalInvested : ''} readOnly className={`${compactInputClass} bg-[#FAFBFC]`} required />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-current" className={compactLabelClass}>Calculated Current Value (₹)</Label>
          <Input id="investment-current" name="current_value" type="number" min="0" step="0.01" value={formCurrentValue} readOnly className={`${compactInputClass} bg-[#FAFBFC]`} required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={compactFieldClass}>
          <Label htmlFor="investment-cagr" className={compactLabelClass}>Expected CAGR %</Label>
          <Input id="investment-cagr" name="expected_cagr" type="number" min="0" max="999.9999" step="0.0001" value={formExpectedCagr} onChange={(event) => onExpectedCagrChange(event.target.value)} className={compactInputClass} required />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-start" className={compactLabelClass}>Start Date</Label>
          <AppDatePicker id="investment-start" name="start_date" value={formStartDate} onChange={onStartDateChange} required className={compactDateClass} />
        </div>
        <div className={compactFieldClass}>
          <Label htmlFor="investment-end" className={compactLabelClass}>End Date</Label>
          <AppDatePicker id="investment-end" name="end_date" value={formEndDate} onChange={onEndDateChange} min={formStartDate} required className={compactDateClass} />
        </div>
      </div>

      <div className={compactFieldClass}>
        <Label htmlFor="investment-notes" className={compactLabelClass}>Notes</Label>
        <textarea
          id="investment-notes"
          name="notes"
          rows={2}
          defaultValue={editingInvestment?.notes || ''}
          placeholder="Goal, strategy, folio notes..."
          className="h-14 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-auto sm:px-3 sm:py-2"
        />
      </div>

      <DialogFooter className="-mx-3 -mb-3 mt-auto !grid grid-cols-2 gap-2 p-3 sm:-mx-4 sm:-mb-4 sm:!flex sm:p-4">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="h-9 bg-[#4F9CF9] hover:bg-[#3F8BE5]" disabled={isSaving}>
          {isSaving ? 'Saving...' : editingInvestment ? 'Save Changes' : 'Add Investment'}
        </Button>
      </DialogFooter>
    </form>
  );
}
