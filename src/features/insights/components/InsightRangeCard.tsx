import DatePicker from 'react-datepicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select';
import type { RangeMode } from '../insights.constants';

const rangeModeLabels: Record<RangeMode, string> = {
  currentMonth: 'Current Month',
  last30Days: 'Last 30 Days',
  last4Months: 'Last 4 Months',
  selectedMonth: 'Selected Month',
  custom: 'Custom Range',
};

type InsightRangeCardProps = {
  rangeLabel: string;
  transactionCount: number;
  rangeMode: RangeMode;
  selectedMonth: Date;
  customStartDate: Date | null;
  customEndDate: Date | null;
  today: Date;
  currentMonthStart: Date;
  onRangeModeChange: (mode: RangeMode) => void;
  onSelectedMonthChange: (date: Date) => void;
  onCustomStartChange: (date: Date | null) => void;
  onCustomEndChange: (date: Date | null) => void;
};

export function InsightRangeCard({
  rangeLabel,
  transactionCount,
  rangeMode,
  selectedMonth,
  customStartDate,
  customEndDate,
  today,
  currentMonthStart,
  onRangeModeChange,
  onSelectedMonthChange,
  onCustomStartChange,
  onCustomEndChange,
}: InsightRangeCardProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Insight Date Range</CardTitle>
        <CardDescription>{rangeLabel} • {transactionCount} transactions selected</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Range</Label>
            <Select value={rangeMode} onValueChange={(value) => onRangeModeChange(value as RangeMode)}>
              <SelectTrigger>
                <span className="min-w-0 flex-1 truncate text-left">{rangeModeLabels[rangeMode]}</span>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(rangeModeLabels) as [RangeMode, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rangeMode === 'selectedMonth' && (
            <div className="space-y-2">
              <Label>Month</Label>
              <DatePicker
                selected={selectedMonth}
                onChange={(date) => date && onSelectedMonthChange(date)}
                showMonthYearPicker
                maxDate={currentMonthStart}
                dateFormat="MMMM yyyy"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          )}

          {rangeMode === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  selected={customStartDate}
                  onChange={onCustomStartChange}
                  selectsStart
                  startDate={customStartDate}
                  endDate={customEndDate}
                  maxDate={customEndDate && customEndDate <= today ? customEndDate : today}
                  dateFormat="dd MMM yyyy"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker
                  selected={customEndDate}
                  onChange={onCustomEndChange}
                  selectsEnd
                  startDate={customStartDate}
                  endDate={customEndDate}
                  minDate={customStartDate || undefined}
                  maxDate={today}
                  dateFormat="dd MMM yyyy"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
