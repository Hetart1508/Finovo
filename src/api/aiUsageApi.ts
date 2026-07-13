import api from '@/src/lib/api';

export type AiUsageFeature = {
  feature: string;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  failed_requests: number;
};

export type AiUsageDashboard = {
  month: string;
  keys: Array<{ identifier: string; configured: boolean }>;
  summary: {
    total_requests: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    credits_used: number;
    failed_requests: number;
    quota_errors: number;
    active_model: string | null;
    active_provider: string | null;
  };
  features: AiUsageFeature[];
  recent: Array<{
    provider: string;
    model: string;
    key_identifier: string | null;
    status: 'success' | 'failed';
    error_type: string | null;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    created_at: string;
  }>;
  settings: {
    monthly_credit_limit: number;
    warning_percent: number;
    limit_behavior: 'block' | 'fallback';
    warning_active: boolean;
    limit_reached: boolean;
    remaining_credits: number | null;
    credit_usd: number;
  };
};

export const aiUsageApi = {
  getDashboard: () => api.get<AiUsageDashboard>('/admin/ai-usage'),
  updateSettings: (settings: Pick<AiUsageDashboard['settings'], 'monthly_credit_limit' | 'warning_percent' | 'limit_behavior'>) =>
    api.put<AiUsageDashboard>('/admin/ai-usage/settings', settings),
};
