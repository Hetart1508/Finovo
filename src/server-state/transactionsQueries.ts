import { queryOptions } from '@tanstack/react-query';
import { transactionsApi } from '@/src/api/transactionsApi';
import { queryKeys } from './queryKeys';

export const transactionsQuery = () => queryOptions({
  queryKey: queryKeys.transactions,
  queryFn: () => transactionsApi.list(),
});

export const dashboardTransactionsQuery = () => queryOptions({
  queryKey: queryKeys.dashboardTransactions,
  queryFn: () => transactionsApi.list({ limit: 10_000, offset: 0 }),
});
