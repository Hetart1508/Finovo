export type SipProjectionPoint = {
  month: number;
  label: string;
  estimatedValue: number;
  contributedAmount: number;
};

const parseDateParts = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
};

export const getSipDurationMonths = (startDate: string, endDate: string) => {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  if (!start || !end || end < start) return 0;
  return Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
};

export const calculateSipFutureValue = (monthlySipAmount: number, expectedCagr: number, months: number) => {
  if (!Number.isFinite(monthlySipAmount) || monthlySipAmount <= 0 || !Number.isFinite(expectedCagr) || expectedCagr < 0 || months <= 0) {
    return 0;
  }

  const monthlyRate = expectedCagr / 12 / 100;
  if (monthlyRate === 0) return monthlySipAmount * months;

  return monthlySipAmount * (((1 + monthlyRate) ** months - 1) / monthlyRate) * (1 + monthlyRate);
};

export const calculateLumpsumFutureValue = (principalAmount: number, expectedCagr: number, months: number) => {
  if (!Number.isFinite(principalAmount) || principalAmount <= 0 || !Number.isFinite(expectedCagr) || expectedCagr < 0 || months < 0) {
    return 0;
  }
  if (months === 0) return principalAmount;

  const annualRate = expectedCagr / 100;
  if (annualRate === 0) return principalAmount;

  return principalAmount * ((1 + annualRate) ** (months / 12));
};

export const calculateEstimatedCapitalGain = (futureValue: number, totalInvestedAmount: number) =>
  futureValue - totalInvestedAmount;

export const generateSipGrowthData = (
  monthlySipAmount: number,
  expectedCagr: number,
  startDate: string,
  endDate: string
): SipProjectionPoint[] => {
  const start = parseDateParts(startDate);
  const months = getSipDurationMonths(startDate, endDate);
  if (!start || monthlySipAmount <= 0 || expectedCagr < 0 || months <= 0) return [];

  const interval = months <= 36 ? 1 : 12;
  const checkpoints = Array.from(
    { length: Math.floor(months / interval) },
    (_, index) => (index + 1) * interval
  );
  if (checkpoints.at(-1) !== months) checkpoints.push(months);

  return checkpoints.map((month) => {
    const pointDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month, 1));
    return {
      month,
      label: interval === 1
        ? pointDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
        : pointDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      estimatedValue: Number(calculateSipFutureValue(monthlySipAmount, expectedCagr, month).toFixed(2)),
      contributedAmount: Number((monthlySipAmount * month).toFixed(2)),
    };
  });
};
