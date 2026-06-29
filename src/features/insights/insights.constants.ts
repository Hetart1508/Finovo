export type RangeMode = 'currentMonth' | 'last30Days' | 'last4Months' | 'selectedMonth' | 'custom';
export type InsightSectionKey =
  | 'spendingHighlights'
  | 'trendAnalysis'
  | 'futureExpensePrediction'
  | 'savingAdvice'
  | 'investmentGuidance'
  | 'actionPlan';

export const insightSections: { key: InsightSectionKey; title: string }[] = [
  { key: 'spendingHighlights', title: 'Spending Highlights' },
  { key: 'trendAnalysis', title: 'Previous Transaction Trends' },
  { key: 'futureExpensePrediction', title: 'Future Expense Prediction' },
  { key: 'savingAdvice', title: 'Saving Advice' },
  { key: 'investmentGuidance', title: 'Investment & Planning Notes' },
  { key: 'actionPlan', title: 'Next Actions' },
];
