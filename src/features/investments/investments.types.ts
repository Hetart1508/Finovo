export type InvestmentType = 'sip' | 'lumpsum';

export type Investment = {
  id: number;
  investment_type?: InvestmentType;
  sip_name: string;
  fund_name: string;
  monthly_sip_amount: number;
  total_invested_amount: number;
  current_value: number;
  expected_cagr: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  months: number;
  future_value: number;
  estimated_capital_gain: number;
};

export type InvestmentSummary = {
  investment_count: number;
  sip_count: number;
  lumpsum_count: number;
  total_monthly_sip: number;
  total_lumpsum_amount: number;
  total_invested_amount: number;
  current_value: number;
  current_capital_gain: number;
  projected_future_value: number;
  estimated_capital_gain: number;
};
