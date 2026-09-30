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

/** Live meter sales from closed shifts: pumpDayIso → fuelTypeId → liters. */
export type MeterSalesByPumpDay = Record<string, Record<string, number>>;

/** Fuel purchase receipts: pumpDayIso → fuelTypeId → liters (KL × 1,000). */
export type PurchaseReceiptByPumpDay = Record<string, Record<string, number>>;

function salesLitersForEntry(
  entry: DipValueLedgerEntry,
  meterSalesByPumpDay?: MeterSalesByPumpDay,
): number {
  const live = meterSalesByPumpDay?.[entry.pumpDayIso]?.[entry.fuelTypeId];
  return live !== undefined ? live : entry.salesLiters;
}

function receiptLitersForEntry(
  entry: DipValueLedgerEntry,
  purchaseReceiptByPumpDay?: PurchaseReceiptByPumpDay,
): number {
  const fromPurchase = purchaseReceiptByPumpDay?.[entry.pumpDayIso]?.[entry.fuelTypeId];
  if (fromPurchase !== undefined && fromPurchase > 0) {
    return round1(fromPurchase);
  }
  return entry.receiptLiters;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Book closing from ledger parts: opening + receipt − sales. */
export function closingBookLitersFromParts(
  openingStockLiters: number,
  receiptLiters: number,
  salesLiters: number,
): number {
  return round1(openingStockLiters + receiptLiters - salesLiters);
}

export function closingBookLitersFromEntry(entry: DipValueLedgerEntry): number {
  return closingBookLitersFromParts(
    entry.openingStockLiters,
    entry.receiptLiters,
    entry.salesLiters,
  );
}

/** Today opening minus previous calendar day closing book (liters). */
export function computeOpeningVariationLiters(
  todayOpeningStockLiters: number,
  priorDayClosingBookLiters: number | null | undefined,
): number | null {
  if (priorDayClosingBookLiters == null || !Number.isFinite(todayOpeningStockLiters)) return null;
  return round1(todayOpeningStockLiters - priorDayClosingBookLiters);
}

/** Closing book for the calendar day before `pumpDayIso`, from saved ledger rows for one fuel. */
export function priorCalendarDayClosingLiters(
  entries: DipValueLedgerEntry[],
  pumpDayIso: string,
  meterSalesByPumpDay?: MeterSalesByPumpDay,
  purchaseReceiptByPumpDay?: PurchaseReceiptByPumpDay,
): number | null {
  const priorIso = priorPumpDayIso(pumpDayIso);
  const prior = entries.find((e) => e.pumpDayIso === priorIso);
  if (!prior) return null;
  return closingBookLitersFromParts(
    prior.openingStockLiters,
    receiptLitersForEntry(prior, purchaseReceiptByPumpDay),
    salesLitersForEntry(prior, meterSalesByPumpDay),
  );
}

export function buildDipValueRegisterRows(
  entries: DipValueLedgerEntry[],
  meterSalesByPumpDay?: MeterSalesByPumpDay,
  purchaseReceiptByPumpDay?: PurchaseReceiptByPumpDay,
): DipValueRegisterRow[] {
  const sorted = [...entries].sort((a, b) => a.pumpDayIso.localeCompare(b.pumpDayIso));
  return sorted.map((row) => {
    const receiptLiters = receiptLitersForEntry(row, purchaseReceiptByPumpDay);
    const salesLiters = salesLitersForEntry(row, meterSalesByPumpDay);
    const totalStockLiters = round1(row.openingStockLiters + receiptLiters);
    const closingBookLiters = closingBookLitersFromParts(
      row.openingStockLiters,
      receiptLiters,
      salesLiters,
    );
    const priorClosing = priorCalendarDayClosingLiters(
      sorted,
      row.pumpDayIso,
      meterSalesByPumpDay,
      purchaseReceiptByPumpDay,
    );
    const variationLiters = computeOpeningVariationLiters(row.openingStockLiters, priorClosing);
    return {
      pumpDayIso: row.pumpDayIso,
      fuelTypeId: row.fuelTypeId,
      openingStockLiters: row.openingStockLiters,
      receiptLiters,
      totalStockLiters,
      salesLiters,
      closingBookLiters,
      variationLiters,
    };
  });
}

export function groupRegisterByFuel(
  entries: DipValueLedgerEntry[],
  meterSalesByPumpDay?: MeterSalesByPumpDay,
  purchaseReceiptByPumpDay?: PurchaseReceiptByPumpDay,
): Map<string, DipValueRegisterRow[]> {
  const byFuel = new Map<string, DipValueLedgerEntry[]>();
  for (const e of entries) {
    const list = byFuel.get(e.fuelTypeId) ?? [];
    list.push(e);
    byFuel.set(e.fuelTypeId, list);
  }
  const out = new Map<string, DipValueRegisterRow[]>();
  for (const [fuelTypeId, list] of byFuel) {
    out.set(
      fuelTypeId,
      buildDipValueRegisterRows(list, meterSalesByPumpDay, purchaseReceiptByPumpDay),
    );
  }
  return out;
}

export function priorPumpDayIso(pumpDayIso: string): string {
  return format(addDays(parseISO(`${pumpDayIso}T12:00:00`), -1), 'yyyy-MM-dd');
}

export function nextPumpDayIso(pumpDayIso: string): string {
  return format(addDays(parseISO(`${pumpDayIso}T12:00:00`), 1), 'yyyy-MM-dd');
}
