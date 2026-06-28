import { useMemo, useState } from 'react';
import {
  calculateEstimatedCapitalGain,
  calculateSipFutureValue,
  generateSipGrowthData,
  getSipDurationMonths,
} from '@/src/lib/investmentCalculations';
import { defaultEndDate, today } from '../investments.utils';

export function useSipCalculator() {
  const [monthlySip, setMonthlySip] = useState('5000');
  const [cagr, setCagr] = useState('12');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const result = useMemo(() => {
    const monthlySipAmount = Number(monthlySip);
    const cagrRate = Number(cagr);
    const months = getSipDurationMonths(startDate, endDate);
    const totalInvested = Number.isFinite(monthlySipAmount) ? monthlySipAmount * months : 0;
    const futureValue = calculateSipFutureValue(monthlySipAmount, cagrRate, months);

    return {
      months,
      totalInvested,
      futureValue,
      capitalGain: calculateEstimatedCapitalGain(futureValue, totalInvested),
      growthData: generateSipGrowthData(monthlySipAmount, cagrRate, startDate, endDate),
    };
  }, [cagr, endDate, monthlySip, startDate]);

  return {
    monthlySip,
    cagr,
    startDate,
    endDate,
    result,
    setMonthlySip,
    setCagr,
    setStartDate,
    setEndDate,
  };
}
