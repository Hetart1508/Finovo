// Unified AI interface. Gemini is primary via server routes; local Ollama remains as fallback.

import api from './api';

type BillData = {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  rawText?: string;
  provider?: string;
  model?: string;
};

type FinancialInsights = {
  summary: string;
  spendingHighlights?: string[];
  trendAnalysis?: string[];
  futureExpensePrediction?: string[];
  savingAdvice?: string[];
  investmentGuidance?: string[];
  actionPlan?: string[];
  provider?: string;
  model?: string;
};

export const extractBillData = async (base64Data: string, mimeType: string): Promise<BillData> => {
  try {
    const { data } = await api.post('/ai/extract-bill', { base64Data, mimeType });
    return data;
  } catch (error) {
    console.warn('Gemini bill extraction failed, falling back to local Ollama/OCR:', error);
    const ollama = await import('./ollama');
    return ollama.extractBillData(base64Data, mimeType);
  }
};

export const getFinancialInsights = async (transactions: any[], recurringEvents: any[] = []): Promise<FinancialInsights> => {
  try {
    const { data } = await api.post('/ai/insights', { transactions, recurringEvents });
    return data;
  } catch (error) {
    console.warn('Gemini insights failed, falling back to local Ollama:', error);
    const ollama = await import('./ollama');
    return ollama.getFinancialInsights(transactions);
  }
};
