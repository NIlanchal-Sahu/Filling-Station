import { addDays, format, parseISO } from 'date-fns';
import type { DipValueLedgerEntry } from '@/types/entities';

export type DipValueRegisterRow = {
  pumpDayIso: string;
  fuelTypeId: string;
  openingStockLiters: number;
  receiptLiters: number;
  totalStockLiters: number;
  salesLiters: number;
  closingBookLiters: number;
  variationLiters: number | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildDipValueRegisterRows(entries: DipValueLedgerEntry[]): DipValueRegisterRow[] {
  const sorted = [...entries].sort((a, b) => a.pumpDayIso.localeCompare(b.pumpDayIso));
  return sorted.map((row, i) => {
    const next = sorted[i + 1];
    const variationLiters =
      row.variationLiters != null
        ? row.variationLiters
        : next
          ? round1(next.openingStockLiters - row.closingBookLiters)
          : null;
    return {
      pumpDayIso: row.pumpDayIso,
      fuelTypeId: row.fuelTypeId,
      openingStockLiters: row.openingStockLiters,
      receiptLiters: row.receiptLiters,
      totalStockLiters: row.totalStockLiters,
      salesLiters: row.salesLiters,
      closingBookLiters: row.closingBookLiters,
      variationLiters,
    };
  });
}

export function groupRegisterByFuel(
  entries: DipValueLedgerEntry[],
): Map<string, DipValueRegisterRow[]> {
  const byFuel = new Map<string, DipValueLedgerEntry[]>();
  for (const e of entries) {
    const list = byFuel.get(e.fuelTypeId) ?? [];
    list.push(e);
    byFuel.set(e.fuelTypeId, list);
  }
  const out = new Map<string, DipValueRegisterRow[]>();
  for (const [fuelTypeId, list] of byFuel) {
    out.set(fuelTypeId, buildDipValueRegisterRows(list));
  }
  return out;
}

export function priorPumpDayIso(pumpDayIso: string): string {
  return format(addDays(parseISO(`${pumpDayIso}T12:00:00`), -1), 'yyyy-MM-dd');
}

export function nextPumpDayIso(pumpDayIso: string): string {
  return format(addDays(parseISO(`${pumpDayIso}T12:00:00`), 1), 'yyyy-MM-dd');
}
