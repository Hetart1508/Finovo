const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatRupees = (value: unknown) => `₹${currency.format(Number(value || 0))}`;
