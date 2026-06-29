export const dashboardChartColors = ['#4F9CF9', '#34C759', '#FFB84D', '#FF6B6B', '#6B7280', '#EEF6FF', '#E5E7EB'];

export type RangePreset = 'This-Month' | 'Last-Month' | 'This-Week' | 'Last-Week' | 'Last-3-Months' | 'Last-6-Months' | 'All';
export type AnalysisRange = RangePreset | 'Custom';

export const rangeLabels: Record<AnalysisRange, string> = {
  'This-Month': 'This-Month',
  'Last-Month': 'Last-Month',
  'This-Week': 'This-Week',
  'Last-Week': 'Last-Week',
  'Last-3-Months': 'Last-3-Months',
  'Last-6-Months': 'Last-6-Months',
  All: 'All',
  Custom: 'Custom',
};
