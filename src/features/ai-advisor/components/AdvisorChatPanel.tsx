import type { UseMutationResult } from '@tanstack/react-query';
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import type { AdvisorMessage, AdvisorSession } from '@/src/api/aiAdvisorApi';
import { cn } from '@/lib/utils';
import {
  RiAddLine,
  RiArrowDownLine,
  RiCheckLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSendPlane2Line,
  RiSideBarLine,
  RiSparkling2Line,
} from 'react-icons/ri';

const starterPrompts = [
  'Review my portfolio and highlight the biggest risk.',
  'How can I improve my monthly investment plan?',
  'Explain my asset allocation in simple terms.',
];

type AdvisorChatPanelProps = {
  messages: AdvisorMessage[];
  introMessage: AdvisorMessage;
  isLoading: boolean;
  loadError: boolean;
  sendMutation: UseMutationResult<unknown, Error, string, unknown>;
  newChatMutation: UseMutationResult<AdvisorSession, Error, void, unknown>;
  onRetryLoad: () => void;
  onShowRecentChats: () => void;
};

const convertMessage = (message: AdvisorMessage): ThreadMessageLike => ({
  id: `${message.session_id}-${message.id}`,
  role: message.role,
  content: [{ type: 'text', text: message.content }],
  createdAt: new Date(message.created_at),
  status: message.role === 'assistant' ? { type: 'complete', reason: 'stop' } : undefined,
});

function MessageTime() {
  const createdAt = useAuiState((state) => state.message.createdAt);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;

  return (
    <time className="mt-1 block text-[0.68rem] text-muted-foreground" dateTime={createdAt.toISOString()}>
      {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

function AssistantMessageActions() {
  const isCopied = useAuiState((state) => state.message.isCopied);

  return (
    <ActionBarPrimitive.Root className="mt-1 flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100">
      <ActionBarPrimitive.Copy
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={isCopied ? 'Response copied' : 'Copy response'}
        title={isCopied ? 'Copied' : 'Copy response'}
      >
        {isCopied ? <RiCheckLine aria-hidden="true" /> : <RiFileCopyLine aria-hidden="true" />}
        <span>{isCopied ? 'Copied' : 'Copy'}</span>
      </ActionBarPrimitive.Copy>
    </ActionBarPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex w-full justify-end px-1 py-2 md:px-3">
      <div className="max-w-[min(42rem,88%)] rounded-2xl rounded-br-md bg-[#4F9CF9] px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">
        <MessagePrimitive.Parts />
        <MessageTime />
      </div>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="space-y-3 break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold"
    />
  );
}

function AssistantMessage() {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isEmpty = useAuiState((state) => state.message.content.length === 0);

  if (isRunning && isEmpty) {
    return (
      <MessagePrimitive.Root className="flex w-full items-start gap-2 px-1 py-2 md:px-3" role="status" aria-live="polite">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#4F9CF9]">
          <RiSparkling2Line className="animate-pulse" aria-hidden="true" />
        </div>
        <div className="rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm">
          <span className="inline-flex items-center gap-1.5">
            Thinking through your portfolio
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-1 animate-bounce rounded-full bg-current" />
            </span>
          </span>
        </div>
      </MessagePrimitive.Root>
    );
  }

  return (
    <MessagePrimitive.Root className="group/message flex w-full items-start gap-2 px-1 py-2 md:px-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#4F9CF9]">
        <RiRobot2Line aria-hidden="true" />
      </div>
      <div className="min-w-0 max-w-[min(46rem,calc(100%-2.25rem))]">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-6 text-foreground shadow-sm">
          <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
          <MessageTime />
        </div>
        <AssistantMessageActions />
      </div>
    </MessagePrimitive.Root>
  );
}

function AdvisorThread({
  hasConversation,
  isLoading,
  loadError,
  sendError,
  onDismissSendError,
  onRetryLoad,
}: {
  hasConversation: boolean;
  isLoading: boolean;
  loadError: boolean;
  sendError: boolean;
  onDismissSendError: () => void;
  onRetryLoad: () => void;
}) {
  return (
    <ThreadPrimitive.Root className="relative flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport
        autoScroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FAFBFC] px-1 py-2 md:rounded-lg md:border md:border-border md:px-2"
      >
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />

        {!hasConversation && !isLoading && !loadError ? (
          <div className="mx-auto grid w-full max-w-2xl gap-2 px-2 pb-4 pt-2 sm:grid-cols-3">
            {starterPrompts.map((prompt) => (
              <ThreadPrimitive.Suggestion
                key={prompt}
                prompt={prompt}
                send
                className="rounded-xl border bg-white p-3 text-left text-xs leading-5 text-muted-foreground shadow-sm transition hover:border-[#4F9CF9]/40 hover:bg-[#EEF6FF] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {prompt}
              </ThreadPrimitive.Suggestion>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground" role="status">Loading your conversation…</p>
        ) : null}

        {loadError ? (
          <div className="mx-3 my-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span>We couldn’t load this conversation.</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetryLoad}>
              <RiRefreshLine aria-hidden="true" /> Retry
            </Button>
          </div>
        ) : null}

      </ThreadPrimitive.Viewport>

      <ThreadPrimitive.ScrollToBottom
        className="absolute bottom-[6.75rem] left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition hover:text-foreground"
        aria-label="Scroll to latest message"
        title="Scroll to latest message"
      >
        <RiArrowDownLine aria-hidden="true" />
      </ThreadPrimitive.ScrollToBottom>

      {sendError ? (
        <div className="mx-2 mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive md:mx-0">
          <p>Your question was saved, but the advisor couldn’t finish its response. You can continue when the service recovers.</p>
          <button type="button" className="shrink-0 font-semibold underline" onClick={onDismissSendError}>Dismiss</button>
        </div>
      ) : null}

      <ComposerPrimitive.Root className="shrink-0 border-t bg-white/95 p-2 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 shadow-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 md:rounded-xl">
          <ComposerPrimitive.Input
            autoFocus
            submitMode="enter"
            unstable_insertNewlineOnTouchEnter
            maxLength={2000}
            minRows={1}
            maxRows={6}
            placeholder="Ask about your investments or financial goals…"
            aria-label="Message the wealth advisor"
            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground"
          />
          <ComposerPrimitive.Send
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
            title="Send message (Enter)"
          >
            <RiSendPlane2Line aria-hidden="true" />
          </ComposerPrimitive.Send>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-[0.68rem] text-muted-foreground">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>Planning guidance only</span>
        </div>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

export function AdvisorChatPanel({
  messages,
  introMessage,
  isLoading,
  loadError,
  sendMutation,
  newChatMutation,
  onRetryLoad,
  onShowRecentChats,
}: AdvisorChatPanelProps) {
  const runtime = useExternalStoreRuntime({
    messages: [introMessage, ...messages],
    convertMessage,
    isLoading,
    isRunning: sendMutation.isPending,
    isSendDisabled: isLoading || loadError,
    onNew: async (message) => {
      const content = message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();

      if (!content) return;
      await sendMutation.mutateAsync(content);
    },
  });

  return (
    <Card className="flex min-h-0 flex-1 rounded-none border-0 bg-transparent py-0 shadow-none md:rounded-lg md:border md:bg-card md:py-4 md:shadow-sm">
      <CardHeader className="shrink-0 border-b bg-white/95 px-2 py-2 md:bg-transparent md:px-4 md:py-3">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-1 md:flex md:justify-between md:gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" size="icon-lg" className="md:hidden" aria-label="Show recent chats" title="Show recent chats" onClick={onShowRecentChats}>
              <RiSideBarLine aria-hidden="true" />
            </Button>
            <CardTitle className="hidden items-center gap-2 md:flex">
              <RiSparkling2Line className="text-[#4F9CF9]" aria-hidden="true" /> Advisor Chat
            </CardTitle>
          </div>
          <p className="min-w-0 truncate text-center text-sm font-semibold text-[#1F2937] md:hidden">Wealth Advisor</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="justify-self-end md:hidden"
            aria-label="New advisor chat"
            title="New chat"
            onClick={() => newChatMutation.mutate()}
            disabled={newChatMutation.isPending}
          >
            <RiAddLine aria-hidden="true" />
          </Button>
        </div>
        <CardDescription className="hidden md:block">Ask freely, answer follow-ups, and get a focused plan.</CardDescription>
      </CardHeader>
      <CardContent className={cn('flex min-h-0 flex-1 flex-col px-0 pt-0 md:px-4 md:pt-3')}>
        <AssistantRuntimeProvider runtime={runtime}>
          <AdvisorThread
            hasConversation={messages.length > 0}
            isLoading={isLoading}
            loadError={loadError}
            sendError={sendMutation.isError}
            onDismissSendError={sendMutation.reset}
            onRetryLoad={onRetryLoad}
          />
        </AssistantRuntimeProvider>
      </CardContent>
    </Card>
  );
}
