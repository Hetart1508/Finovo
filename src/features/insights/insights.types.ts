export type TopCategoryDataPoint = {
  name: string;
  value: number;
};

export type FinancialInsightResult = {
  model?: string;
  summary?: string;
  spendingHighlights?: string[];
  trendAnalysis?: string[];
  futureExpensePrediction?: string[];
  savingAdvice?: string[];
  investmentGuidance?: string[];
  actionPlan?: string[];
};
