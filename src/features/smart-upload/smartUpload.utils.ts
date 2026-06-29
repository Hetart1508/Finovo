import type { ExtractedBillData } from './smartUpload.types';

export const getTodayDateString = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

export const getExtractionConfidence = (data: ExtractedBillData) => (
  data.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? 'high' : 'medium'
);
