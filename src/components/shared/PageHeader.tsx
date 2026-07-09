import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
};

export function PageHeader({ title, description, actions, align = 'left', className }: PageHeaderProps) {
  const centered = align === 'center';

  return (
    <div
      className={cn(
        centered ? 'space-y-2 text-center' : 'flex flex-col justify-between gap-4 md:flex-row md:items-end',
        className
      )}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-[#6B7280]">{description}</p> : null}
      </div>
      {actions ? <div className={cn(centered && 'flex justify-center')}>{actions}</div> : null}
    </div>
  );
}
