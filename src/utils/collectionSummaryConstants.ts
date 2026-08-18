/** Alert thresholds for collection summary (₹). */
export const CASH_COLLECTION_ALERT_LIMIT = 100_000;
export const DAILY_CREDIT_SALES_ALERT_LIMIT = 50_000;

export const COLLECTION_MODE_COLORS = {
  cash: '#43a047',
  upi: '#1e88e5',
  card: '#5e35b1',
  credit: '#e53935',
  fleet: '#fb8c00',
} as const;
