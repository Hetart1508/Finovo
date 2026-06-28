import { queryOptions } from '@tanstack/react-query';
import { recurringApi } from '@/src/api/recurringApi';
import { queryKeys } from './queryKeys';

export const recurringQuery = () => queryOptions({
  queryKey: queryKeys.recurring,
  queryFn: () => recurringApi.list(),
});

export const upcomingRecurringQuery = (days = 365) => queryOptions({
  queryKey: queryKeys.upcomingRecurring(days),
  queryFn: () => recurringApi.upcoming(days),
});
