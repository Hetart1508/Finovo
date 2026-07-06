export type RiskAppetite = 'low' | 'moderate' | 'high';

export type UserProfile = {
  id: number;
  email: string;
  name: string;
  daily_threshold: number;
  date_of_birth: string | null;
  occupation: string | null;
  city: string | null;
  country: string;
  monthly_income: number | null;
  monthly_expense_target: number | null;
  emergency_fund_target: number | null;
  risk_appetite: RiskAppetite | null;
  investment_goal: string | null;
  financial_dependents: number | null;
  preferred_currency: string;
  ai_personalization_enabled: boolean;
  profile_context_version: number;
  profile_updated_at: string | null;
};

export type UserProfilePayload = {
  name: string;
  date_of_birth: string | null;
  occupation: string | null;
  city: string | null;
  country: string;
  monthly_income: number | null;
  monthly_expense_target: number | null;
  emergency_fund_target: number | null;
  risk_appetite: RiskAppetite | null;
  investment_goal: string | null;
  financial_dependents: number | null;
  preferred_currency: string;
  ai_personalization_enabled: boolean;
};
