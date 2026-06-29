import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
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
import { defaultAdvisorSessionId } from '../aiAdvisor.constants';
import { formatAdvisorCurrency } from '../aiAdvisor.utils';

export function useAIAdvisor() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('ai-advisor-session') || defaultAdvisorSessionId);
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
    ['Portfolio Value', formatAdvisorCurrency(summary?.current_value)],
    ['Monthly SIP', formatAdvisorCurrency(summary?.total_monthly_sip)],
    ['Total Invested', formatAdvisorCurrency(summary?.total_invested_amount)],
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
  }), [investments.length, sessionId]);

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
      const nextSession = sessions.find((session) => session.session_id !== deletedId)?.session_id || defaultAdvisorSessionId;
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

  const selectSession = (nextSessionId: string) => {
    setSessionId(nextSessionId);
    setShowRecentChats(false);
  };

  return {
    message,
    setMessage,
    sessionId,
    showRecentChats,
    setShowRecentChats,
    messagesEndRef,
    messages,
    sessions,
    summaryCards,
    introMessage,
    isLoading,
    sendMutation,
    clearMutation,
    newChatMutation,
    deleteChatMutation,
    handleSubmit,
    selectSession,
  };
}
