import type { RefObject } from 'react';
import { Button } from '@/src/components/ui/button';

type GoogleAuthSectionProps = {
  googleClientId?: string;
  googleButtonRef: RefObject<HTMLDivElement | null>;
};

export function GoogleAuthSection({ googleClientId, googleButtonRef }: GoogleAuthSectionProps) {
  return (
    <div className="space-y-3">
      {googleClientId ? (
        <div className="flex min-h-10 w-full justify-center overflow-hidden" ref={googleButtonRef} />
      ) : (
        <Button className="h-10 w-full" type="button" variant="outline" disabled>
          Google sign-in not configured
        </Button>
      )}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[#94A3B8]">
        <span className="h-px flex-1 bg-[#E5E7EB]" />
        <span>or</span>
        <span className="h-px flex-1 bg-[#E5E7EB]" />
      </div>
    </div>
  );
}
