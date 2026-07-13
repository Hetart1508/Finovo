export const APP_LOCALE = 'en-IN';
export const APP_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

export const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: unknown) => currencyFormatter.format(Number(value || 0));

export const formatRupees = (value: unknown) => `₹${Number(value || 0).toLocaleString(APP_LOCALE)}`;

export const formatSignedRupees = (value: unknown, isPositive: boolean) =>
  `${isPositive ? '+' : '-'}${formatRupees(Math.abs(Number(value || 0)))}`;

/**
 * MySQL date strings do not include an offset. The API stores TIMESTAMP values
 * in UTC, so make that explicit before formatting them for the application.
 */
export const parseApiDateTime = (value: string | Date) => {
  if (value instanceof Date) return value;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized);
};

export const formatLocalTime = (value: string | Date) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_TIME_ZONE,
  }).format(parseApiDateTime(value)).toLowerCase();

export const formatLocalDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_TIME_ZONE,
    timeZoneName: 'short',
  }).format(parseApiDateTime(value));
