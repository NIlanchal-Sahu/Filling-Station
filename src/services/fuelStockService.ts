import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import {
  demoGetFuelStockOverview,
  demoListFuelTankDips,
  demoListFuelTankDipsInRange,
  demoRecordFuelTankDip,
  demoUpsertFuelTankDipForDay,
} from '@/localDemo/demoBackend';
import type { DipKind, FuelStockOverview, FuelTankDipReading, FuelType } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import { buildFuelStockItem, notifyFuelStockUpdated, sortFuelStockItems } from '@/utils/fuelStockDisplay';
import { canonicalDipCm, dipCmFromLiters, litersFromDipCm } from '@/utils/fuelTankCalibration';
import { listFuelTypes, getFuelType } from '@/services/fuelTypesService';

type DipRow = {
  id: string;
  fuel_type_id: string | null;
  dip_cm: number | null;
  dip_liters: number | null;
  pump_day_iso: string | null;
  dip_kind: string | null;
  recorded_at: string | null;
  recorded_by: string | null;
  notes: string | null;
};

function mapDip(row: DipRow, fuelName = ''): FuelTankDipReading {
  const dipLiters = Number(row.dip_liters ?? 0);
  const recordedAt = asTimestamp(row.recorded_at);
  const dipCmRaw = row.dip_cm;
  const dipCm =
    dipCmRaw != null ? canonicalDipCm(Number(dipCmRaw)) : (dipCmFromLiters(dipLiters, fuelName) ?? 0);
  const pumpDayIso =
    typeof row.pump_day_iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.pump_day_iso)
      ? row.pump_day_iso
      : format(recordedAt.toDate(), 'yyyy-MM-dd');
  const dipKind: DipKind = row.dip_kind === 'opening' ? 'opening' : 'closing';

  return {
    id: row.id,
    fuelTypeId: String(row.fuel_type_id ?? ''),
    dipCm,
    dipLiters,
    pumpDayIso,
    dipKind,
    recordedAt,
    recordedBy: row.recorded_by ? String(row.recorded_by) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function isUpdatedToday(lastDipAt: FuelType['lastDipAt']): boolean {
  if (!lastDipAt) return false;
  return isSameDay(lastDipAt.toDate(), new Date());
}

function buildOverviewFromFuels(fuels: FuelType[]): FuelStockOverview {
  const items = sortFuelStockItems(
    fuels
      .map((f) => buildFuelStockItem(f, { updatedToday: isUpdatedToday(f.lastDipAt) }))
      .filter((item): item is NonNullable<typeof item> => item != null),
  );

  const totalStockLiters = items.reduce((sum, i) => sum + i.currentStockLiters, 0);
  const totalCapacityLiters = items.reduce((sum, i) => sum + i.tankCapacityLiters, 0);
  const overallUtilizationPercent =
    totalCapacityLiters > 0 ? Math.min(100, (totalStockLiters / totalCapacityLiters) * 100) : 0;

  return {
    items,
    totalStockLiters,
    totalCapacityLiters,
    overallUtilizationPercent,
    hasData: items.length > 0,
  };
}

export async function getFuelStockOverview(): Promise<FuelStockOverview> {
  if (LOCAL_DEMO) {
    return demoGetFuelStockOverview();
  }

  const fuels = await listFuelTypes();
  return buildOverviewFromFuels(fuels);
}

export async function listFuelTankDips(fuelTypeId: string): Promise<FuelTankDipReading[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTankDips(fuelTypeId);
  }

  const fuel = await listFuelTypes().then((rows) => rows.find((f) => f.id === fuelTypeId));
  const fuelName = fuel?.name ?? '';

  const { data, error } = await getSupabase()
    .from('fuel_tank_dips')
    .select('*')
    .eq('fuel_type_id', fuelTypeId)
    .order('recorded_at', { ascending: false });
  throwIfError(error, 'List tank dips');
  return ((data ?? []) as DipRow[]).map((row) => mapDip(row, fuelName));
}

export async function listFuelTankDipsInRange(
  fromIso: string,
  toIso: string,
): Promise<FuelTankDipReading[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTankDipsInRange(fromIso, toIso);
  }

  const fuels = await listFuelTypes();
  const nameById = new Map(fuels.map((f) => [f.id, f.name]));
  const { data, error } = await getSupabase()
    .from('fuel_tank_dips')
    .select('*')
    .order('recorded_at', { ascending: false });
  throwIfError(error, 'List tank dips');
  return ((data ?? []) as DipRow[])
    .map((row) => mapDip(row, nameById.get(String(row.fuel_type_id ?? '')) ?? ''))
    .filter((d) => d.pumpDayIso >= fromIso && d.pumpDayIso <= toIso);
}

export async function listFuelTankDipsForDay(pumpDayIso: string): Promise<FuelTankDipReading[]> {
  const dips = await listFuelTankDipsInRange(pumpDayIso, pumpDayIso);
  return dips.filter((d) => d.pumpDayIso === pumpDayIso);
}

/** Preview stock liters from a dip-stick reading before saving (135.8 → 136 cm chart). */
export function previewStockFromDipCm(dipCm: number, fuelName: string): number {
  return litersFromDipCm(dipCm, fuelName);
}

export async function recordFuelTankDip(input: {
  fuelTypeId: string;
  dipCm: number;
  pumpDayIso?: string;
  dipKind?: DipKind;
  recordedBy?: string;
  notes?: string;
}): Promise<string> {
  const fuel = await getFuelType(input.fuelTypeId);
  if (!fuel) {
    throw new Error('Fuel type not found');
  }
  const dipCm = canonicalDipCm(input.dipCm);
  const dipLiters = litersFromDipCm(dipCm, fuel.name);
  const pumpDayIso = input.pumpDayIso ?? format(new Date(), 'yyyy-MM-dd');
  const dipKind = input.dipKind ?? 'closing';

  if (LOCAL_DEMO) {
    const id = await demoRecordFuelTankDip({ ...input, dipLiters, pumpDayIso, dipKind });
    notifyFuelStockUpdated();
    return id;
  }

  const id = newId();
  const { error } = await getSupabase().from('fuel_tank_dips').insert({
    id,
    fuel_type_id: input.fuelTypeId,
    dip_cm: dipCm,
    dip_liters: dipLiters,
    pump_day_iso: pumpDayIso,
    dip_kind: dipKind,
    recorded_at: new Date().toISOString(),
    recorded_by: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  throwIfError(error, 'Record tank dip');

  if (dipKind === 'closing') {
    const { error: fuelError } = await getSupabase()
      .from('fuel_types')
      .update({
        current_stock_liters: dipLiters,
        last_dip_cm: dipCm,
        last_dip_at: new Date().toISOString(),
      })
      .eq('id', input.fuelTypeId);
    throwIfError(fuelError, 'Update fuel stock from dip');
  }

  notifyFuelStockUpdated();
  return id;
}

/** Replace opening or closing dip for a fuel × pump day. */
export async function upsertFuelTankDipForDay(input: {
  fuelTypeId: string;
  pumpDayIso: string;
  dipKind: DipKind;
  dipCm: number;
  recordedBy?: string;
  notes?: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    const id = await demoUpsertFuelTankDipForDay(input);
    notifyFuelStockUpdated();
    return id;
  }

  const fuel = await getFuelType(input.fuelTypeId);
  if (!fuel) throw new Error('Fuel type not found');
  const dipCm = canonicalDipCm(input.dipCm);
  const dipLiters = litersFromDipCm(dipCm, fuel.name);

  const id = newId();
  const { error } = await getSupabase().from('fuel_tank_dips').insert({
    id,
    fuel_type_id: input.fuelTypeId,
    dip_cm: dipCm,
    dip_liters: dipLiters,
    pump_day_iso: input.pumpDayIso,
    dip_kind: input.dipKind,
    recorded_at: new Date().toISOString(),
    recorded_by: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  throwIfError(error, 'Save tank dip');

  if (input.dipKind === 'closing' && input.pumpDayIso === format(new Date(), 'yyyy-MM-dd')) {
    const { error: fuelError } = await getSupabase()
      .from('fuel_types')
      .update({
        current_stock_liters: dipLiters,
        last_dip_cm: dipCm,
        last_dip_at: new Date().toISOString(),
      })
      .eq('id', input.fuelTypeId);
    throwIfError(fuelError, 'Update fuel stock from dip');
  }

  notifyFuelStockUpdated();
  return id;
}

export function formatFuelLiters(value: number): string {
  return `${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`;
}

export async function setFuelTypeCurrentStockLiters(
  fuelTypeId: string,
  liters: number,
): Promise<void> {
  const rounded = Math.round(liters * 10) / 10;
  if (LOCAL_DEMO) {
    const { demoSetFuelTypeCurrentStockLiters } = await import('@/localDemo/demoBackend');
    await demoSetFuelTypeCurrentStockLiters(fuelTypeId, rounded);
    notifyFuelStockUpdated();
    return;
  }
  const { error } = await getSupabase()
    .from('fuel_types')
    .update({ current_stock_liters: rounded })
    .eq('id', fuelTypeId);
  throwIfError(error, 'Update fuel stock');
  notifyFuelStockUpdated();
}

export function formatFuelPercent(value: number): string {
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
