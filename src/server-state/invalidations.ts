import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export const invalidateTransactions = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions });

export const invalidateRecurring = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.recurring });

export const invalidateInvestments = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.investments }),
    queryClient.invalidateQueries({ queryKey: queryKeys.investmentSummary }),
  ]);
};

export const invalidateMerchantAliases = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.merchantAliases });

export const invalidateUserProfile = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });

export const invalidateAdvisorSessions = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorSessions });

export const invalidateAdvisorMessages = (queryClient: QueryClient, sessionId = 'default') =>
  queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisorMessages(sessionId) });
