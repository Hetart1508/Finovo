import type { ReactNode } from 'react';
import { Card, CardContent } from '@/src/components/ui/card';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  helper?: ReactNode;
  className?: string;
  contentClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  helperClassName?: string;
};

export function StatCard({
  label,
  value,
  icon,
  action,
  helper,
  className,
  contentClassName,
  iconClassName,
  labelClassName,
  valueClassName,
  helperClassName,
}: StatCardProps) {
  return (
    <Card className={cn('metric-card', className)}>
      <CardContent className={cn('p-6 text-center', contentClassName)}>
        {(icon || action) ? (
          <div className={cn('mb-4 flex items-center justify-between', !action && 'justify-center')}>
            {icon ? <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', iconClassName)}>{icon}</div> : <span />}
            {action}
          </div>
        ) : null}
        <p className={cn('text-sm font-medium text-[#6B7280]', labelClassName)}>{label}</p>
        <h3 className={cn('mt-1 text-2xl font-bold', valueClassName)}>{value}</h3>
        {helper ? <p className={cn('mt-1 text-xs text-[#6B7280]', helperClassName)}>{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
