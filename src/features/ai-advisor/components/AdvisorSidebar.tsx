import type { UseMutationResult } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import type { AdvisorSession } from '@/src/api/aiAdvisorApi';
import { cn } from '@/lib/utils';
import { RiAddLine, RiChat3Line, RiCloseLine, RiDeleteBinLine } from 'react-icons/ri';

type AdvisorSidebarProps = {
  sessions: AdvisorSession[];
  sessionId: string;
  messageCount: number;
  summaryCards: (string | number)[][];
  clearMutation: UseMutationResult<unknown, Error, void, unknown>;
  newChatMutation: UseMutationResult<AdvisorSession, Error, void, unknown>;
  deleteChatMutation: UseMutationResult<unknown, Error, string, unknown>;
  onHide: () => void;
  onSelectSession: (sessionId: string) => void;
};

const dismissKeyboard = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

export function AdvisorSidebar({
  sessions,
  sessionId,
  messageCount,
  summaryCards,
  clearMutation,
  newChatMutation,
  deleteChatMutation,
  onHide,
  onSelectSession,
}: AdvisorSidebarProps) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-[#1F2937]/30 backdrop-blur-[1px] md:hidden"
        aria-label="Hide recent chats"
        onClick={onHide}
      />
      <Card className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] min-h-0 rounded-none border-0 shadow-2xl md:static md:z-auto md:w-auto md:rounded-lg md:border md:shadow-sm">
        <CardHeader className="shrink-0 border-b px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm md:flex md:items-center md:gap-2">
              <RiChat3Line className="hidden text-[#4F9CF9] md:block" aria-hidden="true" />
              Chats
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Hide recent chats"
                title="Hide recent chats"
                onClick={onHide}
              >
                <RiCloseLine aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="New advisor chat"
                title="New chat"
                onClick={() => {
                  dismissKeyboard();
                  if (!newChatMutation.isPending) newChatMutation.mutate();
                }}
                disabled={newChatMutation.isPending}
              >
                <RiAddLine aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-2 pb-3 md:hidden">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-2">
                <p className="truncate text-[0.7rem] text-[#6B7280]">{label}</p>
                <p className="truncate text-sm font-semibold text-[#1F2937]">{value}</p>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="mb-3 h-9 w-full justify-start gap-2 md:hidden"
            onClick={() => clearMutation.mutate()}
            disabled={!messageCount || clearMutation.isPending}
          >
            <RiDeleteBinLine aria-hidden="true" />
            Clear current chat
          </Button>
          <div className="space-y-1">
            {sessions.length ? sessions.map((session) => {
              const isActive = session.session_id === sessionId;
              return (
                <div key={session.session_id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(
                      'min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition',
                      isActive ? 'bg-[#EEF6FF] text-[#1F2937]' : 'text-[#6B7280] hover:bg-[#FAFBFC] hover:text-[#1F2937]'
                    )}
                    onClick={() => {
                      dismissKeyboard();
                      onSelectSession(session.session_id);
                    }}
                    title={session.title}
                  >
                    {session.title}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete advisor chat"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    onClick={() => {
                      dismissKeyboard();
                      deleteChatMutation.mutate(session.session_id);
                    }}
                    disabled={deleteChatMutation.isPending}
                  >
                    <RiDeleteBinLine aria-hidden="true" />
                  </Button>
                </div>
              );
            }) : (
              <p className="px-2 py-3 text-sm text-[#6B7280]">No recent chats yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
