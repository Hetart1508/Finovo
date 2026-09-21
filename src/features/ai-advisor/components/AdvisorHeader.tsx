import type { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/src/components/ui/button';
import { RiAddLine, RiDeleteBinLine, RiSideBarLine } from 'react-icons/ri';
import type { AdvisorSession } from '@/src/api/aiAdvisorApi';

type AdvisorHeaderProps = {
  messageCount: number;
  clearMutation: UseMutationResult<unknown, Error, void, unknown>;
  summaryCards: (string | number)[][];
  showRecentChats?: boolean;
  onToggleRecentChats?: () => void;
  onNewChat?: () => void;
  newChatPending?: boolean;
};

export function AdvisorHeader({
  messageCount,
  clearMutation,
  summaryCards,
  showRecentChats,
  onToggleRecentChats,
  onNewChat,
  newChatPending,
}: AdvisorHeaderProps) {
  return (
    <div className="hidden min-h-0 shrink-0 items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-3 py-1.5 shadow-2xs md:flex">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={onToggleRecentChats}
            title={showRecentChats ? 'Hide chat history' : 'Show chat history'}
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <RiSideBarLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={onNewChat}
            disabled={newChatPending}
            title="Start new chat"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <RiAddLine className="size-3.5" />
          </Button>
        </div>

        <span className="text-muted-foreground/30">|</span>

        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
          <span className="text-xs font-bold text-[#1F2937] dark:text-foreground">AI Wealth Advisor</span>
        </div>

        <span className="text-muted-foreground/30">|</span>

        <div className="flex min-w-0 items-center gap-4 text-xs">
          {summaryCards.slice(0, 3).map(([label, value]) => (
            <div key={label} className="flex items-center gap-1.5 truncate">
              <span className="text-[0.7rem] text-muted-foreground">{label}:</span>
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
        onClick={() => clearMutation.mutate()}
        disabled={!messageCount || clearMutation.isPending}
        title="Clear current conversation"
      >
        <RiDeleteBinLine className="size-3.5" aria-hidden="true" />
        <span>Clear Chat</span>
      </Button>
    </div>
  );
}

