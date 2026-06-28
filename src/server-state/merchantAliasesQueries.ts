import { queryOptions } from '@tanstack/react-query';
import { merchantAliasesApi } from '@/src/api/merchantAliasesApi';
import { queryKeys } from './queryKeys';

export const merchantAliasesQuery = () => queryOptions({
  queryKey: queryKeys.merchantAliases,
  queryFn: () => merchantAliasesApi.list(),
});
