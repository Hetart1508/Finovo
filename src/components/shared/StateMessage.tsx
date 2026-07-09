import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StateMessageProps = {
  children: ReactNode;
  className?: string;
};

export function StateMessage({ children, className }: StateMessageProps) {
  return (
    <p className={cn('py-8 text-center text-sm text-[#6B7280]', className)}>
      {children}
    </p>
  );
}
