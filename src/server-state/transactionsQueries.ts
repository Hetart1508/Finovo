import { queryOptions } from '@tanstack/react-query';
import { transactionsApi } from '@/src/api/transactionsApi';
import { queryKeys } from './queryKeys';

export const transactionsQuery = (walletId: number | null) => queryOptions({
  queryKey: queryKeys.transactionsForWallet(walletId),
  queryFn: () => transactionsApi.list({ wallet_id: walletId ?? undefined }),
  enabled: Boolean(walletId),
});

export const dashboardTransactionsQuery = (walletId: number | null) => queryOptions({
  queryKey: queryKeys.dashboardTransactions(walletId),
  queryFn: () => transactionsApi.list({ wallet_id: walletId ?? undefined, limit: 10_000, offset: 0 }),
  enabled: Boolean(walletId),
});
