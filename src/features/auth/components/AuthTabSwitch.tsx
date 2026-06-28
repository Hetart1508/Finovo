import { cn } from '@/lib/utils';

type AuthTab = 'login' | 'register';

type AuthTabSwitchProps = {
  currentTab: AuthTab;
  onChange: (tab: AuthTab) => void;
};

export function AuthTabSwitch({ currentTab, onChange }: AuthTabSwitchProps) {
  return (
    <div className="grid h-11 w-full grid-cols-2 overflow-hidden rounded-lg bg-[#EEF6FF] p-1 dark:bg-[#1E293B]">
      {(['login', 'register'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            'h-9 rounded-md text-sm font-bold capitalize transition-colors',
            currentTab === tab
              ? 'bg-[#4F9CF9] text-white'
              : 'text-[#6B7280] hover:text-[#1F2937] dark:text-[#CBD5E1] dark:hover:text-white'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
