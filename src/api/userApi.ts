import api from '@/src/lib/api';
import type { UserProfile, UserProfilePayload } from '@/src/types/profile';
import { getData } from './http';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export type MonthlyReportPreferences = {
  email_enabled: boolean;
  report_frequency: ReportFrequency;
  custom_interval_days: number;
  send_day_of_month: number;
  include_ai_summary: boolean;
  include_next_month_planning: boolean;
  delivery_email: string | null;
};

export const userApi = {
  updateThreshold: (threshold: number) => api.patch('/user/threshold', { threshold }),
  getProfile: () => getData<UserProfile>(api.get('/user/profile')),
  updateProfile: (payload: UserProfilePayload) => api.put<UserProfile>('/user/profile', payload),
  updateAiPersonalization: (enabled: boolean) =>
    api.patch<UserProfile>('/user/profile/ai-personalization', { enabled }),
  getMonthlyReportPreferences: () =>
    getData<MonthlyReportPreferences>(api.get('/user/monthly-report/preferences')),
  updateMonthlyReportPreferences: (payload: MonthlyReportPreferences) =>
    api.put<MonthlyReportPreferences>('/user/monthly-report/preferences', payload),
};
