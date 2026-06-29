import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { RiSettings3Line } from 'react-icons/ri';

type CalendarHeaderProps = {
  threshold: number;
  onThresholdChange: (value: number) => void;
  onSaveThreshold: () => void;
};

export function CalendarHeader({ threshold, onThresholdChange, onSaveThreshold }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expense Calendar</h1>
        <p className="text-[#6B7280]">Track your daily spending patterns and stay within limits.</p>
      </div>

      <Popover>
        <PopoverTrigger>
          <Button variant="outline" className="gap-2">
            <RiSettings3Line className="text-base" aria-hidden="true" />
            Threshold: ₹{threshold}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Daily Spending Limit (₹)</Label>
              <p className="text-xs text-[#6B7280]">Dates exceeding this will be highlighted in red.</p>
              <Input
                type="number"
                value={threshold}
                onChange={(event) => onThresholdChange(parseInt(event.target.value))}
              />
            </div>
            <Button className="w-full" onClick={onSaveThreshold}>Save Threshold</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
