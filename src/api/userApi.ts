import api from '@/src/lib/api';

export const userApi = {
  updateThreshold: (threshold: number) => api.patch('/user/threshold', { threshold }),
};
