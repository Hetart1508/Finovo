import { Button, buttonVariants } from '@/src/components/ui/button';
import { PageHeader } from '@/src/components/shared/PageHeader';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog';
import { cn } from '@/lib/utils';
import { RiSettings3Line } from 'react-icons/ri';

type CalendarHeaderProps = {
  threshold: number;
  onThresholdChange: (value: number) => void;
  onSaveThreshold: () => void;
};

export function CalendarHeader({ threshold, onThresholdChange, onSaveThreshold }: CalendarHeaderProps) {
  return (
    <PageHeader
      title="Expense Calendar"
      description="Track your daily spending patterns and stay within limits."
      className="[&>div:last-child]:justify-center"
      actions={(
        <Dialog>
          <DialogTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              '!w-fit gap-2 border-[#4F9CF9]/25 text-[#357CCB] hover:bg-[#EEF6FF] hover:text-[#357CCB]'
            )}
          >
            <RiSettings3Line className="text-base text-[#4F9CF9]" aria-hidden="true" />
            Threshold: ₹{threshold}
          </DialogTrigger>
          <DialogContent className="w-80 p-4">
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Threshold Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Daily Spending Limit (₹)</Label>
                <p className="text-xs text-[#6B7280]">Dates exceeding this will be highlighted in red.</p>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(event) => onThresholdChange(parseInt(event.target.value))}
                />
              </div>
              <Button className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={onSaveThreshold}>Save Threshold</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    />
  );
}
