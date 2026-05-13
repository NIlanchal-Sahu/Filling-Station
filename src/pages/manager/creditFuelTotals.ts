import type { CreditSale } from '@/types/entities';
import { trimNumberDisplay } from './creditRegisterFormatters';

export type FuelKind = 'diesel' | 'petrol' | 'other';

/** Classify fuel from pump name (normalized uppercase). */
export function classifyFuelKind(fuelUpperName: string): FuelKind {
  const u = fuelUpperName.trim().toUpperCase();
  if (u.includes('DIESEL')) return 'diesel';
  if (u.includes('PETROL') || u.includes('GASOLINE')) return 'petrol';
  return 'other';
}

export type CustomerFuelCreditTotals = {
  dieselLiters: number;
  petrolLiters: number;
  otherLiters: number;
  dieselAmount: number;
  petrolAmount: number;
  otherAmount: number;
  /** Shift reconciliation rows etc. — no fuel / liters on the sale */
  unallocatedAmount: number;
};

function emptyTotals(): CustomerFuelCreditTotals {
  return {
    dieselLiters: 0,
    petrolLiters: 0,
    otherLiters: 0,
    dieselAmount: 0,
    petrolAmount: 0,
    otherAmount: 0,
    unallocatedAmount: 0,
  };
}

function addSaleToTotals(
  t: CustomerFuelCreditTotals,
  s: CreditSale,
  fuelUpperNameById: Map<string, string>,
): void {
  const liters =
    s.liters != null && Number.isFinite(s.liters) && s.liters > 0 ? s.liters : 0;
  const amt = Number.isFinite(s.amount) ? s.amount : 0;
  const fid = s.fuelTypeId;
  if (!fid) {
    t.unallocatedAmount += amt;
    return;
  }
  const name = fuelUpperNameById.get(fid);
  if (!name) {
    t.unallocatedAmount += amt;
    return;
  }
  const kind = classifyFuelKind(name);
  if (kind === 'diesel') {
    t.dieselLiters += liters;
    t.dieselAmount += amt;
  } else if (kind === 'petrol') {
    t.petrolLiters += liters;
    t.petrolAmount += amt;
  } else {
    t.otherLiters += liters;
    t.otherAmount += amt;
  }
}

/** Lifetime credit sales grouped by inferred fuel type (from fuel master name). */
export function aggregateFuelCreditTotals(
  sales: CreditSale[],
  fuelUpperNameById: Map<string, string>,
): CustomerFuelCreditTotals {
  const t = emptyTotals();
  for (const s of sales) {
    addSaleToTotals(t, s, fuelUpperNameById);
  }
  return t;
}

export function fuelCreditTotalsByCustomerId(
  sales: CreditSale[],
  fuelUpperNameById: Map<string, string>,
): Record<string, CustomerFuelCreditTotals> {
  const out: Record<string, CustomerFuelCreditTotals> = {};
  for (const s of sales) {
    if (!out[s.customerId]) {
      out[s.customerId] = emptyTotals();
    }
    addSaleToTotals(out[s.customerId]!, s, fuelUpperNameById);
  }
  return out;
}

/** Compact line for cards (liters preferred; mentions shift-only amounts). */
export function describeFuelCreditTotals(t: CustomerFuelCreditTotals): string {
  const parts: string[] = [];
  const pushFuel = (
    label: string,
    liters: number,
    amt: number,
  ): void => {
    if (liters > 0) {
      parts.push(`${label} ${trimNumberDisplay(liters)} L`);
    } else if (amt > 0) {
      parts.push(`${label} ₹${amt.toFixed(2)}`);
    }
  };
  pushFuel('Diesel', t.dieselLiters, t.dieselAmount);
  pushFuel('Petrol', t.petrolLiters, t.petrolAmount);
  pushFuel('Other fuel', t.otherLiters, t.otherAmount);
  if (t.unallocatedAmount > 0) {
    parts.push(`shift / no fuel ₹${t.unallocatedAmount.toFixed(2)}`);
  }
  return parts.join(' · ');
}
