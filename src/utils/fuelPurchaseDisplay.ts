import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';

/** VAT on fuel purchase invoices (dealer inward). */
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

export function litersFromKl(kl: number): number {
  return kl * 1000;
}

export function klFromLiters(liters: number): number {
  return liters / 1000;
}

export function purchaseLineTotal(kl: number, ratePerKl: number): number {
  return kl * ratePerKl;
}

export function purchaseLineVat(total: number): number {
  return total * PURCHASE_VAT_RATE;
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
