export type ExtractedBillData = {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  rawText?: string;
  provider?: string;
  model?: string;
};

export type ExtractedBill = {
  data: ExtractedBillData;
  confidence: 'low' | 'medium' | 'high';
};
