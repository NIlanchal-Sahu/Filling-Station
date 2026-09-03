import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';

/** VAT on fuel purchase invoices (dealer inward): HSD 24%, MS/XP 28%. */
export const PURCHASE_VAT_RATE_BY_FUEL: Record<string, number> = {
  HSD: 0.24,
  MS: 0.28,
  XP: 0.28,
};

/** @deprecated Prefer purchaseVatRateForFuel — kept for callers that need a default. */
export const PURCHASE_VAT_RATE = 0.24;

/** IndianOil-style material codes per fuel (override per receipt if needed). */
export const FUEL_PURCHASE_MATERIAL_CODE: Record<string, string> = {
  MS: '50001',
  HSD: '50703',
  XP: '50301',
};

export function defaultMaterialCodeForFuel(fuelName: string): string {
  const code = fuelStockDisplayMeta(fuelName).shortCode;
  return FUEL_PURCHASE_MATERIAL_CODE[code] ?? '';
}

export function purchaseVatRateForFuel(fuelNameOrCode: string): number {
  const code = fuelStockDisplayMeta(fuelNameOrCode).shortCode;
  return PURCHASE_VAT_RATE_BY_FUEL[code] ?? PURCHASE_VAT_RATE;
}

export function purchaseVatPercentLabel(fuelNameOrCode: string): string {
  return String(Math.round(purchaseVatRateForFuel(fuelNameOrCode) * 100));
}

export function litersFromKl(kl: number): number {
  return kl * 1000;
}

export function klFromLiters(liters: number): number {
  return liters / 1000;
}

export function purchaseLineTotal(kl: number, ratePerKl: number): number {
  return kl * ratePerKl;
}

export function purchaseLineVat(total: number, fuelNameOrCode?: string): number {
  const rate = fuelNameOrCode != null ? purchaseVatRateForFuel(fuelNameOrCode) : PURCHASE_VAT_RATE;
  return total * rate;
}

export function purchaseLineGrandTotal(total: number, vat: number): number {
  return total + vat;
}

export function formatPurchaseMoney(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatPurchaseKl(kl: number): string {
  if (!Number.isFinite(kl)) return '—';
  return Number.isInteger(kl) ? String(kl) : kl.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}
