import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  aiAdvisorMessagesQuery,
  aiAdvisorSessionsQuery,
  investmentsQuery,
  investmentSummaryQuery,
} from '@/src/server-state';
import {
  invalidateAdvisorMessages,
  invalidateAdvisorSessions,
} from '@/src/server-state/invalidations';
import { aiAdvisorApi, type AdvisorMessage } from '@/src/api/aiAdvisorApi';
import { getApiMessage } from '@/src/lib/toastMessages';
import { cn } from '@/lib/utils';
import { RiAddLine, RiChat3Line, RiCloseLine, RiDeleteBinLine, RiSideBarLine, RiSendPlane2Line, RiSparkling2Line } from 'react-icons/ri';

const defaultSessionId = 'default';

const formatCurrency = (value: unknown) =>
  Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

export default function AIWealthAdvisor() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('ai-advisor-session') || defaultSessionId);
  const [showRecentChats, setShowRecentChats] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const investmentsResult = useQuery(investmentsQuery());
  const summaryResult = useQuery(investmentSummaryQuery());
  const sessionsResult = useQuery(aiAdvisorSessionsQuery());
  const messagesResult = useQuery(aiAdvisorMessagesQuery(sessionId));

  const messages = messagesResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const summary = summaryResult.data;
  const investments = investmentsResult.data ?? [];
  const isLoading = investmentsResult.isPending || summaryResult.isPending || messagesResult.isPending;
  const summaryCards = [
    ['Portfolio Value', formatCurrency(summary?.current_value)],
    ['Monthly SIP', formatCurrency(summary?.total_monthly_sip)],
    ['Total Invested', formatCurrency(summary?.total_invested_amount)],
    ['Investments', summary?.investment_count || 0],
  ];

  const introMessage = useMemo<AdvisorMessage>(() => ({
    id: 0,
    session_id: sessionId,
    role: 'assistant',
    content: investments.length
      ? 'Ask me any investment or money planning question. I will use your saved SIPs and lumpsum investments, then ask follow-up questions when needed.'
      : 'Ask me any investment or money planning question. Add SIP or lumpsum investments to get answers based on your real portfolio.',
    created_at: new Date().toISOString(),
  }), [investments.length]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => aiAdvisorApi.sendMessage(content, sessionId),
    onSuccess: () => {
      setMessage('');
      invalidateAdvisorMessages(queryClient, sessionId);
      invalidateAdvisorSessions(queryClient);
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'AI Wealth Advisor failed.'));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => aiAdvisorApi.clearMessages(sessionId),
    onSuccess: () => {
      invalidateAdvisorMessages(queryClient, sessionId);
      invalidateAdvisorSessions(queryClient);
      toast.success('Advisor chat cleared.');
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to clear advisor chat.'));
    },
  });

  const newChatMutation = useMutation({
    mutationFn: () => aiAdvisorApi.createSession(),
    onSuccess: (session) => {
      setSessionId(session.session_id);
      localStorage.setItem('ai-advisor-session', session.session_id);
      setMessage('');
      invalidateAdvisorSessions(queryClient);
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to create advisor chat.'));
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (id: string) => aiAdvisorApi.deleteSession(id),
    onSuccess: (_data, deletedId) => {
      const nextSession = sessions.find((session) => session.session_id !== deletedId)?.session_id || defaultSessionId;
      setSessionId(nextSession);
      localStorage.setItem('ai-advisor-session', nextSession);
      invalidateAdvisorSessions(queryClient);
      invalidateAdvisorMessages(queryClient, deletedId);
      invalidateAdvisorMessages(queryClient, nextSession);
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to delete advisor chat.'));
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sendMutation.isPending]);

  useEffect(() => {
    localStorage.setItem('ai-advisor-session', sessionId);
  }, [sessionId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] max-w-6xl flex-col overflow-hidden md:grid md:h-full md:min-h-0 md:gap-3 md:grid-rows-[auto_auto_minmax(0,1fr)]">
      <div className="hidden min-h-0 flex-col gap-2 md:flex md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1F2937] sm:text-2xl">AI Wealth Advisor</h1>
          <p className="text-sm text-[#6B7280]">Goal planning based on your saved investments.</p>
        </div>
        <Button
          variant="outline"
          className="h-9 w-fit gap-2"
          onClick={() => clearMutation.mutate()}
          disabled={!messages.length || clearMutation.isPending}
        >
          <RiDeleteBinLine aria-hidden="true" />
          Clear Chat
        </Button>
      </div>

      <div className="hidden min-h-0 grid-cols-2 gap-2 md:grid md:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <Card key={label} className="rounded-lg py-1.5 shadow-sm sm:py-2">
            <CardHeader className="px-3 py-2 sm:py-3">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className={cn('grid min-h-0 flex-1 grid-cols-1 md:gap-3', showRecentChats ? 'md:grid-cols-[2.5rem_16rem_minmax(0,1fr)]' : 'md:grid-cols-[2.5rem_minmax(0,1fr)]')}>
        <div className="hidden min-h-0 justify-center md:flex">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={showRecentChats ? 'Hide recent chats' : 'Show recent chats'}
            title={showRecentChats ? 'Hide recent chats' : 'Show recent chats'}
            onClick={() => setShowRecentChats((current) => !current)}
          >
            <RiSideBarLine aria-hidden="true" />
          </Button>
        </div>
        {showRecentChats ? (
        <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#1F2937]/30 backdrop-blur-[1px] md:hidden"
          aria-label="Hide recent chats"
          onClick={() => setShowRecentChats(false)}
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
                  onClick={() => setShowRecentChats(false)}
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
              disabled={!messages.length || clearMutation.isPending}
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
                        setSessionId(session.session_id);
                        setShowRecentChats(false);
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
                      onClick={() => deleteChatMutation.mutate(session.session_id)}
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
        ) : null}

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
                  onClick={() => setShowRecentChats(true)}
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

            <form className="flex shrink-0 items-end gap-2 border-t bg-white/95 px-2 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0" onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
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
      </div>
    </div>
  );
}
