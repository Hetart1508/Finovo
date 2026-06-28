import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Input } from '@/src/components/ui/input';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';

type PasswordInputProps = ComponentProps<typeof Input> & {
  inputId: string;
};

export function PasswordInputWithToggle({ inputId, className = '', ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        id={inputId}
        type={showPassword ? 'text' : 'password'}
        className={`pr-12 ${className}`}
      />
      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#EEF6FF] hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F9CF9]"
      >
        {showPassword ? <RiEyeOffLine className="text-base" aria-hidden="true" /> : <RiEyeLine className="text-base" aria-hidden="true" />}
      </button>
    </div>
  );
}
