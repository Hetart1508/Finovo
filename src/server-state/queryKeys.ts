export const queryKeys = {
  transactions: ['transactions'] as const,
  dashboardTransactions: ['transactions', { limit: 10_000, offset: 0 }] as const,
  recurring: ['recurring'] as const,
  upcomingRecurring: (days = 365) => ['recurring', 'upcoming', { days }] as const,
  merchantAliases: ['merchant-aliases'] as const,
  userProfile: ['user-profile'] as const,
  investments: ['investments'] as const,
  investmentSummary: ['investments', 'summary'] as const,
  aiAdvisorSessions: ['ai-advisor', 'sessions'] as const,
  aiAdvisorMessages: (sessionId = 'default') => ['ai-advisor', 'messages', { sessionId }] as const,
};
