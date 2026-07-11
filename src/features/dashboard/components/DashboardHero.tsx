import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import type { AnalysisRange } from '../dashboard.constants';
import { rangeLabels } from '../dashboard.constants';

type DashboardHeroProps = {
  activeRange: AnalysisRange;
  selectedPreset: AnalysisRange;
  rangeDescription: string;
  hasInvalidCustomRange: boolean;
  customStartDate: string;
  customEndDate: string;
  todayDateString: string;
  transactionCount: number;
  onPresetChange: (preset: AnalysisRange) => void;
  onCustomStartChange: (date: string) => void;
  onCustomEndChange: (date: string) => void;
};

export function DashboardHero({
  activeRange,
  selectedPreset,
  rangeDescription,
  hasInvalidCustomRange,
  customStartDate,
  customEndDate,
  todayDateString,
  transactionCount,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: DashboardHeroProps) {
  return (
    <div className="surface-panel metronic-surface rounded-lg p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Financial overview</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-[#1F2937] sm:text-3xl">{rangeLabels[activeRange]} money movement</h1>
          <p className="mt-2 text-sm text-[#6B7280]">{rangeDescription}</p>
          {hasInvalidCustomRange ? (
            <p className="mt-2 text-sm font-semibold text-[#FF6B6B]">Start date must be before or equal to end date.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-col gap-3 lg:flex-row">
            <Select value={selectedPreset} onValueChange={(value) => onPresetChange(value as AnalysisRange)}>
              <SelectTrigger className="h-10 w-full bg-white sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="This-Month">This-Month</SelectItem>
                <SelectItem value="Last-Month">Last-Month</SelectItem>
                <SelectItem value="This-Week">This-Week</SelectItem>
                <SelectItem value="Last-Week">Last-Week</SelectItem>
                <SelectItem value="Last-3-Months">Last-3-Months</SelectItem>
                <SelectItem value="Last-6-Months">Last-6-Months</SelectItem>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <AppDatePicker
                max={todayDateString}
                value={customStartDate}
                onChange={onCustomStartChange}
                placeholder="Start date"
              />
              <AppDatePicker
                max={todayDateString}
                min={customStartDate || undefined}
                value={customEndDate}
                onChange={onCustomEndChange}
                placeholder="End date"
              />
            </div>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-left md:text-right">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Transactions</p>
            <p className="text-2xl font-black text-[#1F2937]">{transactionCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
