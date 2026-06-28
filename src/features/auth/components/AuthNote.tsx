import type { ComponentType } from 'react';

type AuthNoteProps = {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  title: string;
  description: string;
};

export function AuthNote({ icon: Icon, title, description }: AuthNoteProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#EAFBF0] bg-[#EAFBF0] p-3 text-sm sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#34C759]">
        <Icon className="text-base" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#1F2937]">{title}</p>
        <p className="mt-0.5 text-[#6B7280]">{description}</p>
      </div>
    </div>
  );
}
