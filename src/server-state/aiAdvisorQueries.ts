import { queryOptions } from '@tanstack/react-query';
import { aiAdvisorApi } from '@/src/api/aiAdvisorApi';
import { queryKeys } from './queryKeys';

export const aiAdvisorSessionsQuery = () => queryOptions({
  queryKey: queryKeys.aiAdvisorSessions,
  queryFn: () => aiAdvisorApi.listSessions(),
});

export const aiAdvisorMessagesQuery = (sessionId = 'default') => queryOptions({
  queryKey: queryKeys.aiAdvisorMessages(sessionId),
  queryFn: () => aiAdvisorApi.listMessages(sessionId),
});
