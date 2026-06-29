import type { ExtractedBillData } from './smartUpload.types';
export { getTodayDateString } from '@/src/utils/dateRanges';

export const getExtractionConfidence = (data: ExtractedBillData) => (
  data.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? 'high' : 'medium'
);
