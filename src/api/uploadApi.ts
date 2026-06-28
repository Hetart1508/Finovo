import api from '@/src/lib/api';

export const uploadApi = {
  uploadBill: (form: FormData) => api.post('/upload', form),
};
