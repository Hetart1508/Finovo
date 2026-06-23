import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { investmentsQuery, investmentSummaryQuery, queryKeys } from '@/src/lib/serverState';
import api from '@/src/lib/api';
import { getApiMessage } from '@/src/lib/toastMessages';
import { cn } from '@/lib/utils';
import { RiAddLine, RiChat3Line, RiDeleteBinLine, RiSideBarLine, RiSendPlane2Line, RiSparkling2Line } from 'react-icons/ri';

type AdvisorMessage = {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type AdvisorSession = {
  session_id: string;
  title: string;
  message_count: number;
  updated_at?: string;
};

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
  const [showRecentChats, setShowRecentChats] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const investmentsResult = useQuery(investmentsQuery());
  const summaryResult = useQuery(investmentSummaryQuery());
  const sessionsResult = useQuery({
    queryKey: queryKeys.aiAdvisorSessions,
    queryFn: async () => (await api.get<AdvisorSession[]>('/ai-advisor/sessions')).data,
  });
  const messagesResult = useQuery({
    queryKey: queryKeys.aiAdvisorMessages(sessionId),
    queryFn: async () => (await api.get<AdvisorMessage[]>('/ai-advisor/messages', { params: { sessionId } })).data,
  });

  const messages = messagesResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const summary = summaryResult.data;
  const investments = investmentsResult.data ?? [];
  const isLoading = investmentsResult.isPending || summaryResult.isPending || messagesResult.isPending;

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
    mutationFn: async (content: string) => (
      await api.post('/ai-advisor/chat', { message: content, sessionId })
    ).data,
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions });
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'AI Wealth Advisor failed.'));
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => (await api.delete('/ai-advisor/messages', { params: { sessionId } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions });
      toast.success('Advisor chat cleared.');
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to clear advisor chat.'));
    },
  });

  const newChatMutation = useMutation({
    mutationFn: async () => (await api.post<AdvisorSession>('/ai-advisor/sessions')).data,
    onSuccess: (session) => {
      setSessionId(session.session_id);
      localStorage.setItem('ai-advisor-session', session.session_id);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions });
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to create advisor chat.'));
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/ai-advisor/sessions/${id}`)).data,
    onSuccess: (_data, deletedId) => {
      const nextSession = sessions.find((session) => session.session_id !== deletedId)?.session_id || defaultSessionId;
      setSessionId(nextSession);
      localStorage.setItem('ai-advisor-session', nextSession);
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(deletedId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(nextSession) });
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
    <div className="mx-auto grid h-full max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1F2937] sm:text-2xl">AI Wealth Advisor</h1>
          <p className="text-sm text-[#6B7280]">Goal planning based on your saved investments.</p>
        </div>
        <Button
          variant="outline"
          className="w-fit gap-2"
          onClick={() => clearMutation.mutate()}
          disabled={!messages.length || clearMutation.isPending}
        >
          <RiDeleteBinLine aria-hidden="true" />
          Clear Chat
        </Button>
      </div>

      <div className="grid min-h-0 grid-cols-2 gap-2 md:grid-cols-4">
        <Card className="rounded-lg py-2 shadow-sm">
          <CardHeader className="px-3">
            <CardDescription>Portfolio Value</CardDescription>
            <CardTitle>{formatCurrency(summary?.current_value)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-lg py-2 shadow-sm">
          <CardHeader className="px-3">
            <CardDescription>Monthly SIP</CardDescription>
            <CardTitle>{formatCurrency(summary?.total_monthly_sip)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-lg py-2 shadow-sm">
          <CardHeader className="px-3">
            <CardDescription>Total Invested</CardDescription>
            <CardTitle>{formatCurrency(summary?.total_invested_amount)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-lg py-2 shadow-sm">
          <CardHeader className="px-3">
            <CardDescription>Investments</CardDescription>
            <CardTitle>{summary?.investment_count || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className={cn('grid min-h-0 gap-2 md:gap-3', showRecentChats ? 'grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[2.5rem_16rem_minmax(0,1fr)]' : 'grid-cols-[2.5rem_minmax(0,1fr)]')}>
        <div className="flex min-h-0 justify-center">
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
        <Card className="min-h-0 rounded-lg shadow-sm">
          <CardHeader className="shrink-0 border-b py-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <RiChat3Line className="text-[#4F9CF9]" aria-hidden="true" />
                Recent Chats
              </CardTitle>
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
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
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
                      onClick={() => setSessionId(session.session_id)}
                      title={session.title}
                    >
                      {session.title}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete advisor chat"
                      className="opacity-0 group-hover:opacity-100"
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
        ) : null}

        <Card className="min-h-0 rounded-lg shadow-sm">
          <CardHeader className="shrink-0 border-b py-3">
            <CardTitle className="flex items-center gap-2">
              <RiSparkling2Line className="text-[#4F9CF9]" aria-hidden="true" />
              Advisor Chat
            </CardTitle>
            <CardDescription>Ask freely, answer follow-ups, and get a focused plan.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
              {[introMessage, ...messages].map((item) => {
                const isUser = item.role === 'user';
                return (
                  <div key={`${item.id}-${item.role}`} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[min(42rem,88%)] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6',
                        isUser
                          ? 'bg-[#4F9CF9] text-white'
                          : 'border border-[#E5E7EB] bg-white text-[#1F2937]'
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

            <form className="flex shrink-0 flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type any investment question..."
                className="h-16 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-20"
                maxLength={2000}
              />
              <Button type="submit" className="h-10 gap-2 self-end px-4" disabled={!message.trim() || sendMutation.isPending}>
                <RiSendPlane2Line aria-hidden="true" />
                Send
              </Button>
            </form>
            <p className="shrink-0 text-xs text-[#6B7280]">Planning guidance only. Please verify before making investment decisions.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
