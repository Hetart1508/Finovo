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
        centered ? 'mx-auto max-w-3xl space-y-2 text-center' : 'flex flex-col justify-between gap-4 sm:flex-row sm:items-end',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-[#6B7280] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className={cn('flex [&>*]:w-full sm:[&>*]:w-auto', centered ? 'justify-center' : 'sm:shrink-0')}>{actions}</div> : null}
    </div>
  );
}
