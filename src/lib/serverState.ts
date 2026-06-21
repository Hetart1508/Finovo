import { queryOptions } from '@tanstack/react-query';
import api from './api';

export const queryKeys = {
  transactions: ['transactions'] as const,
  dashboardTransactions: ['transactions', { limit: 10_000, offset: 0 }] as const,
  recurring: ['recurring'] as const,
  upcomingRecurring: (days = 365) => ['recurring', 'upcoming', { days }] as const,
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
