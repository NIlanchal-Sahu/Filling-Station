import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import {
  demoListFuelReceiptsForDay,
  demoListAllFuelReceiptsForPumpDay,
  demoListFuelReceiptsInRange,
  demoRecordFuelReceipt,
  demoSetFuelReceiptLitersForDay,
} from '@/localDemo/demoBackend';
import type { FuelReceipt } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import { notifyFuelStockUpdated } from '@/utils/fuelStockDisplay';

type ReceiptRow = {
  id: string;
  fuel_type_id: string | null;
  pump_day_iso: string | null;
  liters: number | null;
  rate_per_kl: number | null;
  material_code: string | null;
  supplier: string | null;
  invoice_no: string | null;
  recorded_by: string | null;
  notes: string | null;
  recorded_at: string | null;
};

function mapReceipt(row: ReceiptRow): FuelReceipt {
  return {
    id: row.id,
    fuelTypeId: String(row.fuel_type_id ?? ''),
    pumpDayIso: String(row.pump_day_iso ?? ''),
    liters: Number(row.liters ?? 0),
    ratePerKl: row.rate_per_kl != null ? Number(row.rate_per_kl) : undefined,
    materialCode: row.material_code ? String(row.material_code) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    invoiceNo: row.invoice_no ? String(row.invoice_no) : undefined,
    recordedBy: row.recorded_by ? String(row.recorded_by) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    recordedAt: asTimestamp(row.recorded_at),
  };
}

export async function listFuelReceiptsInRange(
  fromIso: string,
  toIso: string,
  fuelTypeId?: string,
): Promise<FuelReceipt[]> {
  if (LOCAL_DEMO) {
    return demoListFuelReceiptsInRange(fromIso, toIso, fuelTypeId);
  }

  let query = getSupabase()
    .from('fuel_receipts')
    .select('*')
    .gte('pump_day_iso', fromIso)
    .lte('pump_day_iso', toIso);
  if (fuelTypeId) {
    query = query.eq('fuel_type_id', fuelTypeId);
  }
  const { data, error } = await query;
  throwIfError(error, 'List fuel receipts');
  return ((data ?? []) as ReceiptRow[])
    .map(mapReceipt)
    .sort((a, b) => {
      const dayCmp = a.pumpDayIso.localeCompare(b.pumpDayIso);
      if (dayCmp !== 0) return dayCmp;
      return a.recordedAt.toMillis() - b.recordedAt.toMillis();
    });
}

export async function listAllFuelReceiptsForPumpDay(pumpDayIso: string): Promise<FuelReceipt[]> {
  if (LOCAL_DEMO) {
    return demoListAllFuelReceiptsForPumpDay(pumpDayIso);
  }

  const { data, error } = await getSupabase()
    .from('fuel_receipts')
    .select('*')
    .eq('pump_day_iso', pumpDayIso);
  throwIfError(error, 'List fuel receipts');
  return ((data ?? []) as ReceiptRow[])
    .map(mapReceipt)
    .sort((a, b) => b.recordedAt.toMillis() - a.recordedAt.toMillis());
}

export async function listFuelReceiptsForDay(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<FuelReceipt[]> {
  if (LOCAL_DEMO) {
    return demoListFuelReceiptsForDay(fuelTypeId, pumpDayIso);
  }

  const { data, error } = await getSupabase()
    .from('fuel_receipts')
    .select('*')
    .eq('fuel_type_id', fuelTypeId)
    .eq('pump_day_iso', pumpDayIso);
  throwIfError(error, 'List fuel receipts');
  return ((data ?? []) as ReceiptRow[]).map(mapReceipt);
}

export async function sumFuelReceiptLitersForDay(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number> {
  const rows = await listFuelReceiptsForDay(fuelTypeId, pumpDayIso);
  return rows.reduce((sum, r) => sum + r.liters, 0);
}

/** Sum purchase receipt liters by fuel for one pump day (KL entries stored as liters). */
export async function sumFuelReceiptLitersByFuelForDay(
  pumpDayIso: string,
): Promise<Record<string, number>> {
  const rows = await listAllFuelReceiptsForPumpDay(pumpDayIso);
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.fuelTypeId] = (out[r.fuelTypeId] ?? 0) + r.liters;
  }
  return out;
}

/** pumpDayIso → fuelTypeId → total purchase liters in range. */
export function aggregateFuelReceiptLitersByPumpDay(
  receipts: FuelReceipt[],
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of receipts) {
    const day = out[r.pumpDayIso] ?? {};
    day[r.fuelTypeId] = (day[r.fuelTypeId] ?? 0) + r.liters;
    out[r.pumpDayIso] = day;
  }
  return out;
}

/** Upsert total receipt liters for a fuel × day (single consolidated row). */
export async function setFuelReceiptLitersForDay(input: {
  fuelTypeId: string;
  pumpDayIso: string;
  liters: number;
  recordedBy?: string;
  notes?: string;
}): Promise<void> {
  if (LOCAL_DEMO) {
    await demoSetFuelReceiptLitersForDay(input);
    notifyFuelStockUpdated();
    return;
  }

  if (input.liters <= 0) {
    return;
  }

  const { error } = await getSupabase().from('fuel_receipts').insert({
    id: newId(),
    fuel_type_id: input.fuelTypeId,
    pump_day_iso: input.pumpDayIso,
    liters: input.liters,
    recorded_at: new Date().toISOString(),
    recorded_by: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  throwIfError(error, 'Save fuel receipt');
  notifyFuelStockUpdated();
}

export async function recordFuelReceipt(input: {
  fuelTypeId: string;
  pumpDayIso: string;
  liters: number;
  ratePerKl?: number;
  materialCode?: string;
  supplier?: string;
  invoiceNo?: string;
  recordedBy?: string;
  notes?: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    const id = await demoRecordFuelReceipt(input);
    notifyFuelStockUpdated();
    return id;
  }

  const id = newId();
  const { error } = await getSupabase().from('fuel_receipts').insert({
    id,
    fuel_type_id: input.fuelTypeId,
    pump_day_iso: input.pumpDayIso,
    liters: input.liters,
    rate_per_kl: input.ratePerKl ?? null,
    material_code: input.materialCode ?? null,
    supplier: input.supplier ?? null,
    invoice_no: input.invoiceNo ?? null,
    recorded_at: new Date().toISOString(),
    recorded_by: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  throwIfError(error, 'Record fuel receipt');
  notifyFuelStockUpdated();
  return id;
}
