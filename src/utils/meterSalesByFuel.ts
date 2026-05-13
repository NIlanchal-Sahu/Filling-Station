import type { ShiftReading } from '@/types/entities';
import { listReadingsForShift } from '@/services/shiftReadingsService';
import { getNozzle } from '@/services/nozzlesService';
import { getFuelType } from '@/services/fuelTypesService';

const EPS = 0.01;

export type MeterSalesByFuel = {
  petrol: number;
  diesel: number;
  xp: number;
  /** Any other nozzle fuel (included in TOTAL SALES). */
  other: number;
  total: number;
};

function fuelBucket(name: string): keyof Pick<MeterSalesByFuel, 'petrol' | 'diesel' | 'xp' | 'other'> {
  const u = name.trim().toUpperCase();
  if (u === 'PETROL' || u.includes('PETROL')) return 'petrol';
  if (u === 'DIESEL' || u.includes('DIESEL')) return 'diesel';
  if (u === 'XP' || u.includes('XP')) return 'xp';
  return 'other';
}

/** Sum meter ₹ by fuel for one shift (from saved readings). */
export async function summarizeMeterSalesForShift(shiftId: string): Promise<MeterSalesByFuel> {
  const readings = await listReadingsForShift(shiftId);
  return summarizeMeterSalesFromReadings(readings);
}

export async function summarizeMeterSalesFromReadings(
  readings: ShiftReading[],
): Promise<MeterSalesByFuel> {
  const out: MeterSalesByFuel = { petrol: 0, diesel: 0, xp: 0, other: 0, total: 0 };
  for (const r of readings) {
    const n = await getNozzle(r.nozzleId);
    const ft = n ? await getFuelType(n.fuelTypeId) : null;
    const name = ft?.name ?? 'Unknown';
    const key = fuelBucket(name);
    const amt = Number(r.totalAmount ?? 0);
    out[key] += amt;
    out.total += amt;
  }
  return out;
}

/** Merge several shifts (dedupes shift ids). */
export async function summarizeMeterSalesForShifts(shiftIds: string[]): Promise<MeterSalesByFuel> {
  const seen = new Set<string>();
  const merged: MeterSalesByFuel = { petrol: 0, diesel: 0, xp: 0, other: 0, total: 0 };
  for (const sid of shiftIds) {
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    const one = await summarizeMeterSalesForShift(sid);
    merged.petrol += one.petrol;
    merged.diesel += one.diesel;
    merged.xp += one.xp;
    merged.other += one.other;
    merged.total += one.total;
  }
  return merged;
}

export function roundMoney2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Shortfall to subtract in cash formula: sum of max(0, −difference) per reconciliation. */
export function shortageFromReconciliationDifferences(differenceSum: number): number {
  if (differenceSum >= -EPS) return 0;
  return roundMoney2(-differenceSum);
}

/**
 * Excel-style: TOTAL CASH = meter total − phone pe − icici − fleet − credit − shortage.
 */
export function totalCashFromMeterAndChannels(
  meterTotal: number,
  paytm: number,
  icici: number,
  fleet: number,
  credit: number,
  shortage: number,
): number {
  return roundMoney2(meterTotal - paytm - icici - fleet - credit - shortage);
}

export function hasFuelDetail(m: MeterSalesByFuel): boolean {
  return (
    Math.abs(m.petrol) > EPS ||
    Math.abs(m.diesel) > EPS ||
    Math.abs(m.xp) > EPS ||
    Math.abs(m.other) > EPS
  );
}
