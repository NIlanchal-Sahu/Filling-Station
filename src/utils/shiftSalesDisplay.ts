export const SHIFT_SALES_UPDATED_EVENT = 'pumpstock:shift-sales-updated';

export function notifyShiftSalesUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHIFT_SALES_UPDATED_EVENT));
  }
}
