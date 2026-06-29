export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: unknown) => currencyFormatter.format(Number(value || 0));

export const formatRupees = (value: unknown) => `₹${Number(value || 0).toLocaleString()}`;

export const formatSignedRupees = (value: unknown, isPositive: boolean) =>
  `${isPositive ? '+' : '-'}${formatRupees(Math.abs(Number(value || 0)))}`;
