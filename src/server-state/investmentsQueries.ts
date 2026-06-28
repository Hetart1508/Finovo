import { queryOptions } from '@tanstack/react-query';
import { investmentsApi } from '@/src/api/investmentsApi';
import { queryKeys } from './queryKeys';

export const investmentsQuery = () => queryOptions({
  queryKey: queryKeys.investments,
  queryFn: () => investmentsApi.list(),
});

export const investmentSummaryQuery = () => queryOptions({
  queryKey: queryKeys.investmentSummary,
  queryFn: () => investmentsApi.summary(),
});
