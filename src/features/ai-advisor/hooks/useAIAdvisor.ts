import { useEffect, useMemo, useState } from 'react';
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
import { queryKeys } from '@/src/server-state/queryKeys';
import { aiAdvisorApi, type AdvisorMessage, type AdvisorSession } from '@/src/api/aiAdvisorApi';
import { getApiMessage } from '@/src/lib/toastMessages';
import { storageKeys } from '@/src/lib/storageKeys';
import { defaultAdvisorSessionId } from '../aiAdvisor.constants';
import { formatAdvisorCurrency } from '../aiAdvisor.utils';

export function useAIAdvisor() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(storageKeys.aiAdvisorSession) || defaultAdvisorSessionId);
  const [showRecentChats, setShowRecentChats] = useState(() => window.matchMedia('(min-width: 768px)').matches);
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
      void invalidateAdvisorSessions(queryClient);
    },
    onError: async (error) => {
      // The API saves the user's message before generating a response. Refreshing
      // here keeps that question visible even when the AI provider is unavailable.
      await invalidateAdvisorMessages(queryClient, sessionId);
      toast.error(getApiMessage(error, 'AI Wealth Advisor failed.'));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => aiAdvisorApi.clearMessages(sessionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId) });
      const previousMessages = queryClient.getQueryData<AdvisorMessage[]>(queryKeys.aiAdvisorMessages(sessionId));
      queryClient.setQueryData<AdvisorMessage[]>(queryKeys.aiAdvisorMessages(sessionId), []);
      return { previousMessages };
    },
    onSuccess: async () => {
      queryClient.setQueryData<AdvisorMessage[]>(queryKeys.aiAdvisorMessages(sessionId), []);
      queryClient.setQueryData<AdvisorSession[]>(queryKeys.aiAdvisorSessions, (old) =>
        old ? old.map((s) => (s.session_id === sessionId ? { ...s, message_count: 0, title: 'New Chat' } : s)) : []
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions, refetchType: 'all' }),
      ]);
      toast.success('Advisor chat cleared.');
    },
    onError: (error, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKeys.aiAdvisorMessages(sessionId), context.previousMessages);
      }
      toast.error(getApiMessage(error, 'Failed to clear advisor chat.'));
    },
  });

  const newChatMutation = useMutation({
    mutationFn: () => aiAdvisorApi.createSession(),
    onSuccess: async (session) => {
      queryClient.setQueryData<AdvisorSession[]>(queryKeys.aiAdvisorSessions, (old) =>
        old ? [session, ...old.filter((s) => s.session_id !== session.session_id)] : [session]
      );
      queryClient.setQueryData<AdvisorMessage[]>(queryKeys.aiAdvisorMessages(session.session_id), []);
      setSessionId(session.session_id);
      localStorage.setItem(storageKeys.aiAdvisorSession, session.session_id);
      sendMutation.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions, refetchType: 'all' });
    },
    onError: (error) => {
      toast.error(getApiMessage(error, 'Failed to create advisor chat.'));
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (id: string) => aiAdvisorApi.deleteSession(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdvisorSessions });
      const previousSessions = queryClient.getQueryData<AdvisorSession[]>(queryKeys.aiAdvisorSessions);
      queryClient.setQueryData<AdvisorSession[]>(queryKeys.aiAdvisorSessions, (old) =>
        old ? old.filter((s) => s.session_id !== deletedId) : []
      );
      return { previousSessions };
    },
    onSuccess: async (_data, deletedId) => {
      queryClient.removeQueries({ queryKey: queryKeys.aiAdvisorMessages(deletedId) });

      if (sessionId === deletedId) {
        const remaining = (queryClient.getQueryData<AdvisorSession[]>(queryKeys.aiAdvisorSessions) || [])
          .filter((s) => s.session_id !== deletedId);
        const nextSession = remaining[0]?.session_id || defaultAdvisorSessionId;
        setSessionId(nextSession);
        localStorage.setItem(storageKeys.aiAdvisorSession, nextSession);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.aiAdvisorMessages(nextSession),
          refetchType: 'all',
        });
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdvisorSessions,
        refetchType: 'all',
      });
      toast.success('Advisor chat deleted.');
    },
    onError: (error, _deletedId, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(queryKeys.aiAdvisorSessions, context.previousSessions);
      }
      toast.error(getApiMessage(error, 'Failed to delete advisor chat.'));
    },
  });

  useEffect(() => {
    localStorage.setItem(storageKeys.aiAdvisorSession, sessionId);
  }, [sessionId]);

  const selectSession = (nextSessionId: string) => {
    setSessionId(nextSessionId);
    sendMutation.reset();
    setShowRecentChats(false);
  };

  const refreshMessages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId), refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions, refetchType: 'all' }),
    ]);
  };

  return {
    sessionId,
    showRecentChats,
    setShowRecentChats,
    messages,
    sessions,
    summaryCards,
    introMessage,
    isLoading,
    messagesLoadError: messagesResult.isError,
    retryMessages: messagesResult.refetch,
    refreshMessages,
    sendMutation,
    clearMutation,
    newChatMutation,
    deleteChatMutation,
    selectSession,
  };
}
