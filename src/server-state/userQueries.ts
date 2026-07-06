import { queryOptions } from '@tanstack/react-query';
import { userApi } from '@/src/api/userApi';
import { queryKeys } from './queryKeys';

export const userProfileQuery = () => queryOptions({
  queryKey: queryKeys.userProfile,
  queryFn: () => userApi.getProfile(),
});
