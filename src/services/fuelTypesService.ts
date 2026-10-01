import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { FuelType } from '@/types/entities';
import { asTimestamp, asTimestampOrNull } from '@/types/time';
import { DEFAULT_TANK_CAPACITY_LITERS } from '@/utils/fuelStockDisplay';
import {
  demoCreateFuelType,
  demoGetFuelType,
  demoListFuelTypes,
  demoUpdateFuelRate,
} from '@/localDemo/demoBackend';

type FuelTypeRow = {
  id: string;
  name: string | null;
  current_rate: number | null;
  last_updated_at: string | null;
  tank_capacity_liters: number | null;
  reserve_liters: number | null;
  current_stock_liters: number | null;
  last_dip_cm: number | null;
  last_dip_at: string | null;
};

function mapFuelType(row: FuelTypeRow): FuelType {
  return {
    id: row.id,
    name: String(row.name ?? ''),
    currentRate: Number(row.current_rate ?? 0),
    lastUpdatedAt: asTimestamp(row.last_updated_at),
    tankCapacityLiters:
      row.tank_capacity_liters != null
        ? Number(row.tank_capacity_liters)
        : DEFAULT_TANK_CAPACITY_LITERS,
    reserveLiters: row.reserve_liters != null ? Number(row.reserve_liters) : undefined,
    currentStockLiters:
      row.current_stock_liters != null ? Number(row.current_stock_liters) : undefined,
    lastDipCm: row.last_dip_cm != null ? Number(row.last_dip_cm) : null,
    lastDipAt: asTimestampOrNull(row.last_dip_at),
  };
}

export async function listFuelTypes(): Promise<FuelType[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTypes();
  }
  const { data, error } = await getSupabase().from('fuel_types').select('*');
  throwIfError(error, 'List fuel types');
  return ((data ?? []) as FuelTypeRow[]).map(mapFuelType);
}

export async function getFuelType(id: string): Promise<FuelType | null> {
  if (LOCAL_DEMO) {
    return demoGetFuelType(id);
  }
  const { data, error } = await getSupabase().from('fuel_types').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load fuel type');
  return data ? mapFuelType(data as FuelTypeRow) : null;
}

export async function createFuelType(name: string, currentRate: number): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateFuelType(name, currentRate);
  }
  const id = newId();
  const { error } = await getSupabase().from('fuel_types').insert({
    id,
    name,
    current_rate: currentRate,
    tank_capacity_liters: DEFAULT_TANK_CAPACITY_LITERS,
    last_updated_at: new Date().toISOString(),
  });
  throwIfError(error, 'Create fuel type');
  return id;
}

export async function updateFuelRate(id: string, currentRate: number): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateFuelRate(id, currentRate);
  }
  const { error } = await getSupabase()
    .from('fuel_types')
    .update({ current_rate: currentRate, last_updated_at: new Date().toISOString() })
    .eq('id', id);
  throwIfError(error, 'Update fuel rate');
}
