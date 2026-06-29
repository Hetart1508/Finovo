import type { FormEvent, RefObject } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import type { AdvisorMessage, AdvisorSession } from '@/src/api/aiAdvisorApi';
import { cn } from '@/lib/utils';
import { RiAddLine, RiSendPlane2Line, RiSideBarLine, RiSparkling2Line } from 'react-icons/ri';

type AdvisorChatPanelProps = {
  message: string;
  messages: AdvisorMessage[];
  introMessage: AdvisorMessage;
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  sendMutation: UseMutationResult<unknown, Error, string, unknown>;
  newChatMutation: UseMutationResult<AdvisorSession, Error, void, unknown>;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent) => void;
  onShowRecentChats: () => void;
};

export function AdvisorChatPanel({
  message,
  messages,
  introMessage,
  isLoading,
  messagesEndRef,
  sendMutation,
  newChatMutation,
  onMessageChange,
  onSubmit,
  onShowRecentChats,
}: AdvisorChatPanelProps) {
  return (
    <Card className="flex min-h-0 flex-1 rounded-none border-0 bg-transparent py-0 shadow-none md:rounded-lg md:border md:bg-card md:py-4 md:shadow-sm">
      <CardHeader className="shrink-0 border-b bg-white/95 px-2 py-2 md:bg-transparent md:px-4 md:py-3">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-1 md:flex md:justify-between md:gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="md:hidden"
              aria-label="Show recent chats"
              title="Show recent chats"
              onClick={onShowRecentChats}
            >
              <RiSideBarLine aria-hidden="true" />
            </Button>
            <CardTitle className="hidden items-center gap-2 md:flex">
              <RiSparkling2Line className="text-[#4F9CF9]" aria-hidden="true" />
              Advisor Chat
            </CardTitle>
          </div>
          <div className="min-w-0 text-center md:hidden">
            <p className="truncate text-sm font-semibold text-[#1F2937]">Wealth Advisor</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="justify-self-end md:hidden"
            aria-label="New advisor chat"
            title="New chat"
            onClick={() => {
              if (!newChatMutation.isPending) newChatMutation.mutate();
            }}
            disabled={newChatMutation.isPending}
          >
            <RiAddLine aria-hidden="true" />
          </Button>
        </div>
        <CardDescription className="hidden md:block">Ask freely, answer follow-ups, and get a focused plan.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-0 pt-2 md:gap-3 md:px-4 md:pt-3">
        <div className="flex-1 space-y-4 overflow-y-auto px-2 py-2 md:space-y-3 md:rounded-lg md:border md:border-[#E5E7EB] md:bg-[#FAFBFC] md:p-3">
          {[introMessage, ...messages].map((item) => {
            const isUser = item.role === 'user';
            return (
              <div key={`${item.id}-${item.role}`} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[min(42rem,88%)] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-6 md:rounded-lg md:px-3',
                    isUser
                      ? 'bg-[#4F9CF9] text-white'
                      : 'bg-transparent text-[#1F2937] md:border md:border-[#E5E7EB] md:bg-white'
                  )}
                >
                  {item.content}
                </div>
              </div>
            );
          })}
          {sendMutation.isPending ? (
            <div className="max-w-sm rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#6B7280]">
              Thinking through your portfolio...
            </div>
          ) : null}
          {isLoading ? (
            <div className="text-sm text-[#6B7280]">Loading advisor context...</div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <form className="flex shrink-0 items-end gap-2 border-t bg-white/95 px-2 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0" onSubmit={onSubmit}>
          <textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Type any investment question..."
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-20 md:rounded-lg md:py-2"
            maxLength={2000}
          />
          <Button type="submit" size="icon-lg" className="rounded-full md:h-10 md:w-auto md:gap-2 md:rounded-lg md:px-4" disabled={!message.trim() || sendMutation.isPending}>
            <RiSendPlane2Line aria-hidden="true" />
            <span className="hidden md:inline">Send</span>
          </Button>
        </form>
        <p className="hidden shrink-0 text-xs text-[#6B7280] md:block">Planning guidance only. Please verify before making investment decisions.</p>
      </CardContent>
    </Card>
  );
}
