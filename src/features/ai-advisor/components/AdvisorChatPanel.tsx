import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject, type UIEvent } from 'react';
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
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { aiAdvisorApi, type AdvisorChatResponse, type AdvisorMessage } from '@/src/api/aiAdvisorApi';
import { formatLocalTime, parseApiDateTime } from '@/src/utils/formatters';
import { stripAdvisorReasoning } from '../aiAdvisor.utils';
import {
  RiAlertLine,
  RiArrowDownLine,
  RiCheckLine,
  RiCloseLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSendPlane2Line,
  RiSparkling2Line,
  RiToolsLine,
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
  sendMutation: UseMutationResult<AdvisorChatResponse, Error, string, unknown>;
  onResponseComplete: () => Promise<unknown>;
  onRetryLoad: () => void;
};

const convertMessage = (message: AdvisorMessage): ThreadMessageLike => ({
  id: `${message.session_id}-${message.id}`,
  role: message.role,
  content: [{
    type: 'text',
    text: message.role === 'assistant' ? stripAdvisorReasoning(message.content) : message.content,
  }],
  createdAt: parseApiDateTime(message.created_at),
  status: message.role === 'assistant' ? { type: 'complete', reason: 'stop' } : undefined,
});

function MessageTime() {
  const createdAt = useAuiState((state) => state.message.createdAt);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;

  return (
    <time className="mt-1 block text-[0.68rem] text-muted-foreground" dateTime={createdAt.toISOString()}>
      {formatLocalTime(createdAt)}
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
  const isEmpty = useAuiState((state) =>
    state.message.content.length === 0 ||
    state.message.content.every((part) => part.type === 'text' && !part.text)
  );

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

const formatToolName = (name: string): string => {
  const map: Record<string, string> = {
    get_spending_summary: 'Analyzed spending summary',
    get_category_spending: 'Calculated category totals',
    get_top_merchants: 'Checked top merchants',
    get_monthly_spending: 'Reviewed monthly trends',
    calculate_change: 'Calculated period change',
    get_current_date: 'Checked current date',
    get_transactions: 'Retrieved transactions',
    search_transactions: 'Searched transactions',
    get_transaction: 'Retrieved transaction details',
    create_expense: 'Prepared expense entry',
    delete_expense: 'Prepared expense deletion',
    get_investments: 'Checked investment portfolio',
    get_investment_summary: 'Calculated portfolio metrics',
    get_recurring_expenses: 'Checked recurring expenses',
    get_ai_memory: 'Retrieved user goals & preferences',
  };
  return map[name] || name.replace(/_/g, ' ');
};

function PendingActionCard({
  pendingAction,
  sessionId,
  onResolved,
}: {
  pendingAction: NonNullable<AdvisorChatResponse['pending_action']>;
  sessionId: string;
  onResolved: () => Promise<unknown>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);

  const handleAction = async (confirm: boolean) => {
    setSubmitting(true);
    try {
      await aiAdvisorApi.confirmAction(sessionId, pendingAction.actionId, confirm);
      setResolvedStatus(confirm ? 'confirmed' : 'cancelled');
      await onResolved();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  if (resolvedStatus) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <RiCheckLine className="text-emerald-500" />
        <span>Action {resolvedStatus === 'confirmed' ? 'confirmed and executed' : 'cancelled'}.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
        <RiAlertLine className="size-4 text-amber-600 dark:text-amber-400" />
        <span>Confirmation Required</span>
      </div>
      <p className="mt-1.5 text-foreground">{pendingAction.summary}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={submitting}
          onClick={() => handleAction(false)}
          className="h-7 text-xs"
        >
          <RiCloseLine className="mr-1" /> Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={submitting}
          onClick={() => handleAction(true)}
          className="h-7 bg-[#4F9CF9] text-xs text-white hover:bg-[#3d8be8]"
        >
          <RiCheckLine className="mr-1" /> Confirm Action
        </Button>
      </div>
    </div>
  );
}

function AdvisorThread({
  hasConversation,
  isLoading,
  loadError,
  sendError,
  onDismissSendError,
  onRetryLoad,
  viewportRef,
  onViewportScroll,
  onFollowLatest,
  showScrollToBottom,
  suggestedPrompts,
  displayProvider,
  isStreaming,
  pendingAction,
  toolsUsed,
  sessionId,
  onResponseComplete,
}: {
  hasConversation: boolean;
  isLoading: boolean;
  loadError: boolean;
  sendError: boolean;
  onDismissSendError: () => void;
  onRetryLoad: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  onViewportScroll: (event: UIEvent<HTMLDivElement>) => void;
  onFollowLatest: () => void;
  showScrollToBottom: boolean;
  suggestedPrompts: string[];
  displayProvider: string | null;
  isStreaming: boolean;
  pendingAction?: AdvisorChatResponse['pending_action'];
  toolsUsed?: string[];
  sessionId: string;
  onResponseComplete: () => Promise<unknown>;
}) {
  return (
    <ThreadPrimitive.Root className="relative flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport
        ref={viewportRef}
        autoScroll={false}
        scrollToBottomOnInitialize={false}
        scrollToBottomOnThreadSwitch={false}
        scrollToBottomOnRunStart={false}
        onScroll={onViewportScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FAFBFC] px-1 py-2 pb-5 md:rounded-lg md:border md:border-border md:px-2"
      >
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />

        {toolsUsed && toolsUsed.length > 0 && !isStreaming ? (
          <div className="mx-2 mb-2 flex flex-wrap items-center gap-1.5 px-1 md:mx-3">
            <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground">
              <RiToolsLine className="size-3 text-[#4F9CF9]" /> Tools used:
            </span>
            {toolsUsed.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <RiCheckLine className="size-3" />
                {formatToolName(tool)}
              </span>
            ))}
          </div>
        ) : null}

        {pendingAction && !isStreaming ? (
          <div className="mx-2 mb-3 md:mx-3">
            <PendingActionCard
              pendingAction={pendingAction}
              sessionId={sessionId}
              onResolved={onResponseComplete}
            />
          </div>
        ) : null}

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

      {showScrollToBottom ? (
        <button
          type="button"
          onClick={onFollowLatest}
          className="absolute bottom-[6.25rem] left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition hover:text-foreground md:bottom-[5.5rem]"
          aria-label="Scroll to latest message"
          title="Scroll to latest message"
        >
          <RiArrowDownLine aria-hidden="true" />
        </button>
      ) : null}

      {sendError ? (
        <div className="mx-2 mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive md:mx-0">
          <p>Your question was saved, but the advisor couldn’t finish its response. You can continue when the service recovers.</p>
          <button type="button" className="shrink-0 font-semibold underline" onClick={onDismissSendError}>Dismiss</button>
        </div>
      ) : null}

      <ComposerPrimitive.Root className="sticky bottom-0 z-10 shrink-0 border-t bg-white/95 p-2 md:border-0 md:bg-card md:px-0 md:pb-1 md:pt-3">
        {suggestedPrompts.length > 0 && !isStreaming ? (
          <div className="mb-2 flex flex-wrap gap-1.5 px-0.5">
            {suggestedPrompts.map((prompt) => (
              <ThreadPrimitive.Suggestion
                key={prompt}
                prompt={prompt}
                send
                className="rounded-full border border-[#4F9CF9]/30 bg-[#EEF6FF] px-2.5 py-1 text-left text-[0.7rem] leading-4 text-[#4F9CF9] shadow-sm transition hover:border-[#4F9CF9]/60 hover:bg-[#4F9CF9]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {prompt}
              </ThreadPrimitive.Suggestion>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 shadow-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 md:rounded-xl">
          <ComposerPrimitive.Input
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
          {displayProvider ? (
            <span className="flex max-w-[55%] items-center gap-1 truncate">
              <span className="inline-block size-1.5 shrink-0 rounded-full bg-green-400" aria-hidden="true" />
              <span className="truncate">{displayProvider}</span>
            </span>
          ) : (
            <span>Planning guidance only</span>
          )}
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
  onResponseComplete,
  onRetryLoad,
}: AdvisorChatPanelProps) {
  const [stagedUserMessage, setStagedUserMessage] = useState<AdvisorMessage | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<AdvisorMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [lastResponse, setLastResponse] = useState<AdvisorChatResponse | null>(null);

  // Derived from last response — cleared while the AI is thinking
  const suggestedPrompts = (!sendMutation.isPending && !isStreaming)
    ? (lastResponse?.suggested_prompts ?? [])
    : [];
  const displayProvider: string | null = (() => {
    if (sendMutation.isPending || isStreaming || !lastResponse?.provider) return null;
    if (lastResponse.provider.startsWith('local-')) return null;
    return [lastResponse.provider, lastResponse.model].filter(Boolean).join(' · ');
  })();
  const streamActiveRef = useRef(true);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(false);
  const initializedSessionRef = useRef<string | null>(null);
  const manualScrollRef = useRef(false);
  const manualScrollTimeoutRef = useRef<number | null>(null);
  const initialScrollCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    streamActiveRef.current = false;
    if (manualScrollTimeoutRef.current) window.clearTimeout(manualScrollTimeoutRef.current);
    initialScrollCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setLastResponse(null);
      setStagedUserMessage(null);
      setStreamingMessage(null);
    }
  }, [messages.length]);

  const runtimeMessages = useMemo(
    () => [
      introMessage,
      ...messages,
      ...(stagedUserMessage ? [stagedUserMessage] : []),
      ...(streamingMessage ? [streamingMessage] : []),
    ],
    [introMessage, messages, stagedUserMessage, streamingMessage]
  );

  useLayoutEffect(() => {
    if (isLoading || initializedSessionRef.current === introMessage.session_id) return;

    initializedSessionRef.current = introMessage.session_id;
    shouldFollowRef.current = true;
    initialScrollCleanupRef.current?.();

    const scrollToBottom = () => {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        setShowScrollToBottom(false);
      }
    };

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
      window.requestAnimationFrame(scrollToBottom);
    });
    const timers = [50, 150, 350, 700].map((delay) => window.setTimeout(scrollToBottom, delay));
    const observer = new ResizeObserver(scrollToBottom);
    if (viewportRef.current) observer.observe(viewportRef.current);

    initialScrollCleanupRef.current = () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      initialScrollCleanupRef.current = null;
    };

    return initialScrollCleanupRef.current;
  }, [introMessage.session_id, isLoading, runtimeMessages.length]);

  useLayoutEffect(() => {
    if (!shouldFollowRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        setShowScrollToBottom(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stagedUserMessage, streamingMessage?.content]);

  const handleViewportScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (manualScrollRef.current) {
      if (distanceFromBottom < 4) {
        manualScrollRef.current = false;
        shouldFollowRef.current = true;
        setShowScrollToBottom(false);
        if (manualScrollTimeoutRef.current) {
          window.clearTimeout(manualScrollTimeoutRef.current);
          manualScrollTimeoutRef.current = null;
        }
      }
      return;
    }

    shouldFollowRef.current = distanceFromBottom < 120;
    setShowScrollToBottom(distanceFromBottom >= 120);
  };

  const scrollToLatest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    manualScrollRef.current = true;
    shouldFollowRef.current = false;
    setShowScrollToBottom(false);
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });

    if (manualScrollTimeoutRef.current) window.clearTimeout(manualScrollTimeoutRef.current);
    manualScrollTimeoutRef.current = window.setTimeout(() => {
      manualScrollRef.current = false;
      shouldFollowRef.current = true;
      setShowScrollToBottom(false);
      manualScrollTimeoutRef.current = null;
    }, 1200);
  };

  const revealResponse = async (response: AdvisorChatResponse) => {
    const completeMessage = {
      ...response.message,
      content: stripAdvisorReasoning(response.message.content),
    };
    const pieces = completeMessage.content.split(/(\s+)/).filter(Boolean);
    const batchSize = Math.max(1, Math.ceil(pieces.length / 220));
    let visibleContent = '';

    setStreamingMessage({ ...completeMessage, content: '' });

    for (let index = 0; index < pieces.length; index += batchSize) {
      if (!streamActiveRef.current) return;
      visibleContent += pieces.slice(index, index + batchSize).join('');
      setStreamingMessage({ ...completeMessage, content: visibleContent });
      await new Promise((resolve) => window.setTimeout(resolve, 32));
    }
  };

  const runtime = useExternalStoreRuntime({
    messages: runtimeMessages,
    convertMessage,
    isLoading,
    isRunning: sendMutation.isPending || isStreaming,
    isSendDisabled: isLoading || loadError,
    onNew: async (message) => {
      const content = message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();

      if (!content) return;
      const optimisticId = -Date.now();
      const createdAt = new Date().toISOString();
      shouldFollowRef.current = true;
      setStagedUserMessage({
        id: optimisticId,
        session_id: introMessage.session_id,
        role: 'user',
        content,
        created_at: createdAt,
      });

      // Allow the blue user bubble to paint before adding the assistant turn.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      setIsStreaming(true);
      setStreamingMessage({
        id: optimisticId - 1,
        session_id: introMessage.session_id,
        role: 'assistant',
        content: '',
        created_at: createdAt,
      });
      const requestStartedAt = Date.now();

      try {
        const response = await sendMutation.mutateAsync(content);
        setLastResponse(response);
        const remainingThinkingTime = Math.max(0, 350 - (Date.now() - requestStartedAt));
        if (remainingThinkingTime) {
          await new Promise((resolve) => window.setTimeout(resolve, remainingThinkingTime));
        }
        await revealResponse(response);
        await onResponseComplete();
        setStagedUserMessage(null);
        setStreamingMessage(null);
      } catch (error) {
        setStagedUserMessage(null);
        setStreamingMessage(null);
        throw error;
      } finally {
        if (streamActiveRef.current) setIsStreaming(false);
      }
    },
  });

  return (
    <Card className="flex min-h-0 flex-1 rounded-none border-0 bg-transparent py-0 shadow-none md:rounded-lg md:border md:bg-card md:shadow-sm">
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 py-0 md:p-2">
        <AssistantRuntimeProvider runtime={runtime}>
          <AdvisorThread
            hasConversation={messages.length > 0 || Boolean(stagedUserMessage)}
            isLoading={isLoading}
            loadError={loadError}
            sendError={sendMutation.isError}
            onDismissSendError={sendMutation.reset}
            onRetryLoad={onRetryLoad}
            viewportRef={viewportRef}
            onViewportScroll={handleViewportScroll}
            onFollowLatest={scrollToLatest}
            showScrollToBottom={showScrollToBottom}
            suggestedPrompts={suggestedPrompts}
            displayProvider={displayProvider}
            isStreaming={isStreaming}
            pendingAction={lastResponse?.pending_action}
            toolsUsed={lastResponse?.tools_used}
            sessionId={introMessage.session_id}
            onResponseComplete={onResponseComplete}
          />
        </AssistantRuntimeProvider>
      </CardContent>
    </Card>
  );
}
