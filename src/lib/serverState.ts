import { queryOptions } from '@tanstack/react-query';
import api from './api';

export const queryKeys = {
  transactions: ['transactions'] as const,
  dashboardTransactions: ['transactions', { limit: 10_000, offset: 0 }] as const,
  recurring: ['recurring'] as const,
  upcomingRecurring: (days = 365) => ['recurring', 'upcoming', { days }] as const,
  merchantAliases: ['merchant-aliases'] as const,
  investments: ['investments'] as const,
  investmentSummary: ['investments', 'summary'] as const,
  aiAdvisorSessions: ['ai-advisor', 'sessions'] as const,
  aiAdvisorMessages: (sessionId = 'default') => ['ai-advisor', 'messages', { sessionId }] as const,
};

const getData = async <T>(request: Promise<{ data: T }>) => (await request).data;

export const transactionsQuery = () => queryOptions({
  queryKey: queryKeys.transactions,
  queryFn: () => getData<any[]>(api.get('/transactions')),
});

export const dashboardTransactionsQuery = () => queryOptions({
  queryKey: queryKeys.dashboardTransactions,
  queryFn: () => getData<any[]>(api.get('/transactions', { params: { limit: 10_000, offset: 0 } })),
});

export const recurringQuery = () => queryOptions({
  queryKey: queryKeys.recurring,
  queryFn: () => getData<any[]>(api.get('/recurring')),
});

export const upcomingRecurringQuery = (days = 365) => queryOptions({
  queryKey: queryKeys.upcomingRecurring(days),
  queryFn: () => getData<any[]>(api.get('/recurring/upcoming', { params: { days } })),
});

export const merchantAliasesQuery = () => queryOptions({
  queryKey: queryKeys.merchantAliases,
  queryFn: () => getData<Array<{ id: number; vpa: string; company_name: string }>>(api.get('/merchant-aliases')),
});

export const investmentsQuery = () => queryOptions({
  queryKey: queryKeys.investments,
  queryFn: () => getData<any[]>(api.get('/investments')),
});

export const investmentSummaryQuery = () => queryOptions({
  queryKey: queryKeys.investmentSummary,
  queryFn: () => getData<any>(api.get('/investments/summary')),
});
