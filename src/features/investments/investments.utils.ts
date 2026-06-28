import { addYears, format } from 'date-fns';
import type { Investment, InvestmentType } from './investments.types';

export const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const today = format(new Date(), 'yyyy-MM-dd');
export const defaultEndDate = format(addYears(new Date(), 10), 'yyyy-MM-dd');

export const getInvestmentType = (investment?: Pick<Investment, 'investment_type'> | null): InvestmentType =>
  investment?.investment_type === 'lumpsum' ? 'lumpsum' : 'sip';

export const getInvestmentTypeLabel = (type: InvestmentType) => type === 'lumpsum' ? 'Lumpsum' : 'SIP';
