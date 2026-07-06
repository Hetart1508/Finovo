import api from '@/src/lib/api';
import type { UserProfile, UserProfilePayload } from '@/src/types/profile';
import { getData } from './http';

export const userApi = {
  updateThreshold: (threshold: number) => api.patch('/user/threshold', { threshold }),
  getProfile: () => getData<UserProfile>(api.get('/user/profile')),
  updateProfile: (payload: UserProfilePayload) => api.put<UserProfile>('/user/profile', payload),
  updateAiPersonalization: (enabled: boolean) =>
    api.patch<UserProfile>('/user/profile/ai-personalization', { enabled }),
};
