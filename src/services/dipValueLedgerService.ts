import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import type { DipValueLedgerEntry } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import {
  demoGetDipValueLedgerEntry,
  demoListDipValueLedgerInRange,
  demoUpsertDipValueLedgerEntry,
} from '@/localDemo/demoBackend';
import {
  closingBookLitersFromEntry,
  computeOpeningVariationLiters,
  priorPumpDayIso,
} from '@/utils/dipValueRegister';
import { setFuelTypeCurrentStockLiters } from '@/services/fuelStockService';

function ledgerDocId(fuelTypeId: string, pumpDayIso: string): string {
  return `${pumpDayIso}_${fuelTypeId}`;
}

function roundLiters(n: number): number {
  return Math.round(n * 10) / 10;
}

type LedgerRow = {
  id: string;
  fuel_type_id: string | null;
  pump_day_iso: string | null;
  opening_stock_liters: number | null;
  receipt_liters: number | null;
  total_stock_liters: number | null;
  sales_liters: number | null;
  closing_book_liters: number | null;
  variation_liters: number | null;
  updated_at: string | null;
  updated_by: string | null;
};

function mapEntry(row: LedgerRow): DipValueLedgerEntry {
  return {
    id: row.id,
    fuelTypeId: String(row.fuel_type_id ?? ''),
    pumpDayIso: String(row.pump_day_iso ?? ''),
    openingStockLiters: Number(row.opening_stock_liters ?? 0),
    receiptLiters: Number(row.receipt_liters ?? 0),
    totalStockLiters: Number(row.total_stock_liters ?? 0),
    salesLiters: Number(row.sales_liters ?? 0),
    closingBookLiters: Number(row.closing_book_liters ?? 0),
    variationLiters: row.variation_liters != null ? Number(row.variation_liters) : null,
    updatedAt: asTimestamp(row.updated_at),
    updatedBy: row.updated_by != null ? String(row.updated_by) : undefined,
  };
}

export async function getDipValueLedgerEntry(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<DipValueLedgerEntry | null> {
  if (LOCAL_DEMO) {
    return demoGetDipValueLedgerEntry(fuelTypeId, pumpDayIso);
  }
  const id = ledgerDocId(fuelTypeId, pumpDayIso);
  const { data, error } = await getSupabase().from('fuel_dip_ledger').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load dip ledger');
  return data ? mapEntry(data as LedgerRow) : null;
}

export async function listDipValueLedgerForDay(pumpDayIso: string): Promise<DipValueLedgerEntry[]> {
  return listDipValueLedgerInRange(pumpDayIso, pumpDayIso);
}

export async function listDipValueLedgerInRange(
  fromIso: string,
  toIso: string,
  fuelTypeId?: string,
): Promise<DipValueLedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListDipValueLedgerInRange(fromIso, toIso, fuelTypeId);
  }
  let query = getSupabase()
    .from('fuel_dip_ledger')
    .select('*')
    .gte('pump_day_iso', fromIso)
    .lte('pump_day_iso', toIso);
  if (fuelTypeId) {
    query = query.eq('fuel_type_id', fuelTypeId);
  }
  const { data, error } = await query;
  throwIfError(error, 'List dip ledger');
  return ((data ?? []) as LedgerRow[])
    .map(mapEntry)
    .sort((a, b) => a.pumpDayIso.localeCompare(b.pumpDayIso) || a.fuelTypeId.localeCompare(b.fuelTypeId));
}

export type UpsertDipValueLedgerInput = {
  fuelTypeId: string;
  pumpDayIso: string;
  openingStockLiters: number;
  receiptLiters: number;
  salesLiters: number;
  /** When set, stored as closing book (physical / dip liters). Otherwise opening + receipt − sales. */
  closingBookLiters?: number;
  updatedBy?: string;
};

export async function upsertDipValueLedgerEntry(input: UpsertDipValueLedgerInput): Promise<void> {
  const openingStockLiters = roundLiters(input.openingStockLiters);
  const receiptLiters = roundLiters(input.receiptLiters);
  const salesLiters = roundLiters(input.salesLiters);
  const totalStockLiters = roundLiters(openingStockLiters + receiptLiters);
  const closingBookLiters =
    input.closingBookLiters != null && Number.isFinite(input.closingBookLiters)
      ? roundLiters(input.closingBookLiters)
      : roundLiters(totalStockLiters - salesLiters);

  const prior = await getDipValueLedgerEntry(input.fuelTypeId, priorPumpDayIso(input.pumpDayIso));
  const priorClosing = prior ? closingBookLitersFromEntry(prior) : null;
  const variationLiters = computeOpeningVariationLiters(openingStockLiters, priorClosing);

  if (LOCAL_DEMO) {
    await demoUpsertDipValueLedgerEntry({
      ...input,
      openingStockLiters,
      receiptLiters,
      salesLiters,
      totalStockLiters,
      closingBookLiters,
      variationLiters,
    });
    await setFuelTypeCurrentStockLiters(input.fuelTypeId, closingBookLiters);
    return;
  }

  const id = ledgerDocId(input.fuelTypeId, input.pumpDayIso);
  const { error } = await getSupabase().from('fuel_dip_ledger').upsert(
    {
      id,
      fuel_type_id: input.fuelTypeId,
      pump_day_iso: input.pumpDayIso,
      opening_stock_liters: openingStockLiters,
      receipt_liters: receiptLiters,
      total_stock_liters: totalStockLiters,
      sales_liters: salesLiters,
      closing_book_liters: closingBookLiters,
      variation_liters: variationLiters,
      updated_at: new Date().toISOString(),
      updated_by: input.updatedBy ?? null,
    },
    { onConflict: 'id' },
  );
  throwIfError(error, 'Save dip ledger');
  await setFuelTypeCurrentStockLiters(input.fuelTypeId, closingBookLiters);
}

/** Previous calendar pump day closing book (liters), if saved. */
export async function getPriorDayClosingBookLiters(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number | null> {
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorPumpDayIso(pumpDayIso));
  return prior ? closingBookLitersFromEntry(prior) : null;
}

/** Suggested opening when no ledger row exists yet for this day. */
export async function suggestOpeningStockLiters(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number | null> {
  const existing = await getDipValueLedgerEntry(fuelTypeId, pumpDayIso);
  if (existing) return existing.openingStockLiters;
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorPumpDayIso(pumpDayIso));
  if (prior) return closingBookLitersFromEntry(prior);
  return null;
}

export function computeClosingBook(
  openingStockLiters: number,
  receiptLiters: number,
  salesLiters: number,
): number {
  return roundLiters(openingStockLiters + receiptLiters - salesLiters);
}
