import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  aiAdvisorApi,
  type AdvisorChatResponse,
  type AdvisorMessage,
  type StreamEvent,
} from '@/src/api/aiAdvisorApi';
import { formatLocalTime } from '@/src/utils/formatters';
import { stripAdvisorReasoning } from '../aiAdvisor.utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  RiAlertLine,
  RiArrowDownLine,
  RiCheckLine,
  RiCloseLine,
  RiCompass3Line,
  RiEditLine,
  RiFileCopyLine,
  RiLightbulbLine,
  RiPieChartLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSendPlane2Line,
  RiSparkling2Line,
  RiStopCircleLine,
  RiThumbDownLine,
  RiThumbUpLine,
  RiToolsLine,
} from 'react-icons/ri';

const starterPromptCards = [
  {
    icon: RiPieChartLine,
    title: 'Analyze Monthly Spending',
    prompt: 'How much did I spend this month and what are my top categories?',
  },
  {
    icon: RiCompass3Line,
    title: 'Compare Periods',
    prompt: 'Compare my spending this month with last month and show where expenses increased.',
  },
  {
    icon: RiAlertLine,
    title: 'Budget Utilization',
    prompt: 'Am I on track with my monthly budget or daily threshold?',
  },
  {
    icon: RiLightbulbLine,
    title: 'Section 80C Tax Guide',
    prompt: 'Explain Section 80C tax saving options and ELSS vs PPF rules.',
  },
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

function AssistantMessageActions({
  messageId,
  content,
  sessionId,
  onRegenerate,
}: {
  messageId?: number;
  content: string;
  sessionId: string;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleFeedback = async (rating: 'thumbs_up' | 'thumbs_down') => {
    if (!messageId || messageId <= 0) return;
    setFeedback(rating);
    try {
      await aiAdvisorApi.sendFeedback({
        messageId,
        rating,
        sessionId,
      });
      toast.success(rating === 'thumbs_up' ? 'Thanks for your feedback!' : 'Feedback received. We will improve.');
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[0.7rem] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Copy response"
      >
        {copied ? <RiCheckLine className="text-emerald-500" /> : <RiFileCopyLine />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>

      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[0.7rem] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="Regenerate answer"
        >
          <RiRefreshLine />
          <span>Regenerate</span>
        </button>
      ) : null}

      {messageId && messageId > 0 ? (
        <div className="ml-1 flex items-center gap-0.5 border-l border-border/60 pl-1">
          <button
            type="button"
            onClick={() => handleFeedback('thumbs_up')}
            className={`inline-flex size-6 items-center justify-center rounded transition hover:bg-muted ${feedback === 'thumbs_up' ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}`}
            title="Helpful response"
          >
            <RiThumbUpLine className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => handleFeedback('thumbs_down')}
            className={`inline-flex size-6 items-center justify-center rounded transition hover:bg-muted ${feedback === 'thumbs_down' ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}
            title="Poor response"
          >
            <RiThumbDownLine className="size-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}



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
        <span>Action {resolvedStatus === 'confirmed' ? 'confirmed and executed successfully.' : 'cancelled.'}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
        <RiAlertLine className="size-4 text-amber-600 dark:text-amber-400" />
        <span>Confirmation Required</span>
      </div>
      <p className="mt-1.5 text-foreground leading-relaxed">{pendingAction.summary}</p>
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

export function AdvisorChatPanel({
  messages,
  introMessage,
  isLoading,
  loadError,
  sendMutation,
  onResponseComplete,
  onRetryLoad,
}: AdvisorChatPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [executedTools, setExecutedTools] = useState<Array<{ name: string; label: string; summary: string }>>([]);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [lastCompletedResponse, setLastCompletedResponse] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editPromptText, setEditPromptText] = useState<string>('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [inputText, setInputText] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldFollowRef = useRef(true);

  // Auto-resize textarea as user types
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
    }
  }, []);

  // Suggested prompts
  const suggestedPrompts = !isGenerating ? (lastCompletedResponse?.suggestedPrompts || []) : [];

  // Scroll viewport to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      setShowScrollToBottom(false);
    }
  };

  const handleViewportScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldFollowRef.current = distanceFromBottom < 100;
    setShowScrollToBottom(distanceFromBottom >= 100);
  };

  useEffect(() => {
    if (shouldFollowRef.current) {
      scrollToBottom('auto');
    }
  }, [messages.length, streamingText, activeStatus]);

  // Main streaming submission function
  const handleSendMessage = async (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || isGenerating) return;

    setInputText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsGenerating(true);
    setActiveStatus('Understanding your request...');
    setExecutedTools([]);
    setIsToolsExpanded(false);
    setStreamingText('');
    setLastCompletedResponse(null);
    shouldFollowRef.current = true;

    abortControllerRef.current = new AbortController();

    try {
      await aiAdvisorApi.streamMessage(
        trimmed,
        introMessage.session_id,
        (event: StreamEvent) => {
          if (event.type === 'status') {
            setActiveStatus(event.label);
          } else if (event.type === 'tool_start') {
            setActiveStatus(event.label);
          } else if (event.type === 'tool_result') {
            setExecutedTools((prev) => [
              ...prev,
              { name: event.name, label: event.label, summary: event.summary },
            ]);
          } else if (event.type === 'text_delta') {
            setActiveStatus(null);
            setStreamingText((prev) => prev + event.text);
          } else if (event.type === 'pending_action') {
            setLastCompletedResponse((prev: any) => ({
              ...prev,
              pendingAction: event,
            }));
          } else if (event.type === 'message_complete') {
            setLastCompletedResponse(event);
          } else if (event.type === 'error') {
            toast.error(event.error);
          }
        },
        undefined,
        abortControllerRef.current.signal
      );

      await onResponseComplete();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Could not complete generation. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setActiveStatus(null);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setActiveStatus(null);
      toast.info('Generation stopped.');
    }
  };

  const handleRegenerateLast = () => {
    const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserTurn) {
      handleSendMessage(lastUserTurn.content);
    }
  };

  const handleSaveUserEdit = (originalId: number) => {
    if (editPromptText.trim()) {
      handleSendMessage(editPromptText.trim());
    }
    setEditingMessageId(null);
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent py-0 shadow-none md:rounded-xl md:border md:border-border/80 md:bg-card md:shadow-sm">
      <CardContent className="relative flex min-h-0 flex-1 flex-col p-0">
        {/* Messages Viewport */}
        <div
          ref={viewportRef}
          onScroll={handleViewportScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FAFBFC] px-2 py-3 pb-6 md:rounded-t-xl dark:bg-background md:px-4"
        >
          {/* Loading skeleton */}
          {isLoading ? (
            <div className="space-y-5 px-1 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex w-full items-start gap-2.5">
                  <div className="mt-0.5 size-7 shrink-0 animate-pulse rounded-full bg-muted/70" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Empty State / Starter Cards */}
          {!isLoading && messages.length === 0 && !isGenerating ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-2 py-8 text-center">
              <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#4F9CF9] to-[#80BFFF] text-white shadow-lg">
                <RiSparkling2Line className="size-7" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Welcome to Finovo AI</h2>
              <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
                Your production personal wealth and finance advisor. Ask anything about your daily expenses, monthly budgets, SIP investments, or Indian tax rules.
              </p>

              <div className="mt-6 grid w-full gap-2.5 sm:grid-cols-2">
                {starterPromptCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => handleSendMessage(card.prompt)}
                      className="group flex flex-col items-start rounded-xl border border-border/70 bg-card p-3.5 text-left shadow-xs transition hover:border-[#4F9CF9] hover:bg-[#EEF6FF]/50 dark:hover:bg-blue-950/20"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground group-hover:text-[#4F9CF9]">
                        <Icon className="size-4 text-[#4F9CF9]" />
                        <span>{card.title}</span>
                      </div>
                      <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
                        {card.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Render historical messages */}
          <div className="space-y-4">
            {messages.map((message) => {
              if (message.role === 'user') {
                const isEditing = editingMessageId === message.id;
                return (
                  <div key={message.id} className="group/user flex w-full justify-end px-1">
                    {isEditing ? (
                      <div className="w-full max-w-xl rounded-2xl border border-[#4F9CF9] bg-card p-3 shadow-md">
                        <textarea
                          value={editPromptText}
                          onChange={(e) => setEditPromptText(e.target.value)}
                          className="w-full resize-none bg-transparent text-sm text-foreground outline-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setEditingMessageId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-[#4F9CF9] text-xs text-white hover:bg-[#3d8be8]"
                            onClick={() => handleSaveUserEdit(message.id)}
                          >
                            Save & Send
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative max-w-[min(44rem,88%)]">
                        <div className="rounded-2xl rounded-br-md bg-[#4F9CF9] px-4 py-2.5 text-sm leading-6 text-white shadow-xs">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <time className="mt-1 block text-[0.65rem] text-white/80">
                            {formatLocalTime(new Date(message.created_at))}
                          </time>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditPromptText(message.content);
                          }}
                          className="absolute -left-7 top-2 text-muted-foreground opacity-0 transition hover:text-foreground group-hover/user:opacity-100"
                          title="Edit question"
                        >
                          <RiEditLine className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={message.id} className="group/message flex w-full items-start gap-2.5 px-1">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#4F9CF9] dark:bg-blue-950/50">
                    <RiRobot2Line className="size-4" />
                  </div>
                  <div className="min-w-0 max-w-[min(46rem,calc(100%-2.5rem))]">
                    <div className="rounded-2xl rounded-tl-md border border-border/80 bg-card px-4 py-3 text-sm shadow-xs">
                      <MarkdownRenderer content={stripAdvisorReasoning(message.content)} />
                      <time className="mt-1.5 block text-[0.65rem] text-muted-foreground">
                        {formatLocalTime(new Date(message.created_at))}
                      </time>
                    </div>
                    <AssistantMessageActions
                      messageId={message.id}
                      content={message.content}
                      sessionId={message.session_id}
                      onRegenerate={handleRegenerateLast}
                    />
                  </div>
                </div>
              );
            })}

            {/* Active Streaming Assistant Turn */}
            {isGenerating || streamingText ? (
              <div className="flex w-full items-start gap-2.5 px-1">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#4F9CF9] animate-pulse dark:bg-blue-950/50">
                  <RiSparkling2Line className="size-4" />
                </div>
                <div className="min-w-0 max-w-[min(46rem,calc(100%-2.5rem))] space-y-2">
                  {/* Tool execution indicator pill */}
                  {activeStatus ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#4F9CF9]/30 bg-[#EEF6FF] px-3 py-1 text-xs font-medium text-[#1E3A8A] shadow-xs animate-pulse dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-200">
                      <RiToolsLine className="size-3.5 text-[#4F9CF9]" />
                      <span>{activeStatus}</span>
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                        <span className="size-1 animate-bounce rounded-full bg-current" />
                      </span>
                    </div>
                  ) : null}

                  {/* Executed tools collapsible chip */}
                  {executedTools.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                        className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground"
                      >
                        <RiCheckLine className="text-emerald-500" />
                        <span>Used {executedTools.length} verified tool{executedTools.length > 1 ? 's' : ''}</span>
                        <span className="underline">{isToolsExpanded ? 'Hide' : 'View'}</span>
                      </button>
                      {isToolsExpanded ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {executedTools.map((t, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.68rem] text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <RiCheckLine className="size-3" />
                              {t.label.replace('...', '')}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Streaming Text Render */}
                  {streamingText ? (
                    <div className="rounded-2xl rounded-tl-md border border-border/80 bg-card px-4 py-3 text-sm shadow-xs">
                      <MarkdownRenderer content={streamingText} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Pending Action Card if returned */}
            {lastCompletedResponse?.pendingAction ? (
              <div className="mx-2 my-2">
                <PendingActionCard
                  pendingAction={lastCompletedResponse.pendingAction}
                  sessionId={introMessage.session_id}
                  onResolved={onResponseComplete}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollToBottom ? (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-24 left-1/2 z-20 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition hover:text-foreground"
            aria-label="Scroll to bottom"
          >
            <RiArrowDownLine className="size-4" />
          </button>
        ) : null}

        {/* Composer Area */}
        <div className="shrink-0 border-t border-border/70 bg-card p-3 md:px-4 md:py-3">
          {/* Suggested follow-up prompt pills */}
          {suggestedPrompts.length > 0 && !isGenerating ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestedPrompts.map((prompt: string) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="rounded-full border border-[#4F9CF9]/30 bg-[#EEF6FF] px-2.5 py-1 text-left text-[0.7rem] leading-4 text-[#4F9CF9] shadow-2xs transition hover:border-[#4F9CF9]/60 hover:bg-[#4F9CF9]/15 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {/* Text Input and Action Buttons */}
          <div className="relative flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 shadow-xs transition focus-within:border-[#4F9CF9] focus-within:ring-2 focus-within:ring-[#4F9CF9]/20">
            <textarea
              ref={textareaRef}
              value={inputText}
              placeholder="Ask Finovo about your spending, budget, or wealth goals..."
              disabled={isLoading || loadError}
              rows={1}
              onChange={(e) => {
                setInputText(e.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isGenerating) {
                    handleSendMessage(inputText);
                  }
                }
              }}
              className="max-h-36 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            />

            {isGenerating ? (
              <Button
                type="button"
                onClick={handleStopGenerating}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs hover:bg-rose-600"
                title="Stop generating"
              >
                <RiStopCircleLine className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  if (inputText.trim()) {
                    handleSendMessage(inputText);
                  }
                }}
                disabled={isLoading || loadError || !inputText.trim()}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#4F9CF9] text-white shadow-xs hover:bg-[#3d8be8] disabled:cursor-not-allowed disabled:opacity-40"
                title="Send message"
              >
                <RiSendPlane2Line className="size-4" />
              </Button>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between px-1 text-[0.68rem] text-muted-foreground">
            <span>Enter to send · Shift+Enter for new line</span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              <span>Finovo AI Agent v2.0 (Gemini 2.5)</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
