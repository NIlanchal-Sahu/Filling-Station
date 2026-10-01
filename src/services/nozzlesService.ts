import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { Nozzle } from '@/types/entities';
import {
  demoCreateNozzle,
  demoDeactivateNozzlesForMachine,
  demoGetNozzle,
  demoListNozzles,
  demoSetNozzleActive,
  demoUpdateNozzle,
} from '@/localDemo/demoBackend';
import { compareNozzleOrder } from '@/utils/nozzleSort';

type NozzleRow = {
  id: string;
  machine_number: string | null;
  nozzle_number: string | null;
  fuel_type_id: string | null;
  is_active: boolean | null;
};

function mapNozzle(row: NozzleRow): Nozzle {
  return {
    id: row.id,
    machineNumber: String(row.machine_number ?? ''),
    nozzleNumber: String(row.nozzle_number ?? ''),
    fuelTypeId: String(row.fuel_type_id ?? ''),
    isActive: row.is_active !== false,
  };
}

export async function listNozzles(activeOnly = true): Promise<Nozzle[]> {
  if (LOCAL_DEMO) {
    return demoListNozzles(activeOnly);
  }
  let query = getSupabase().from('nozzles').select('*');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  throwIfError(error, 'List nozzles');
  return ((data ?? []) as NozzleRow[])
    .map(mapNozzle)
    .sort((a, b) => compareNozzleOrder(a, b));
}

export async function getNozzle(id: string): Promise<Nozzle | null> {
  if (LOCAL_DEMO) {
    return demoGetNozzle(id);
  }
  const { data, error } = await getSupabase().from('nozzles').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load nozzle');
  return data ? mapNozzle(data as NozzleRow) : null;
}

export async function createNozzle(input: {
  machineNumber: string;
  nozzleNumber: string;
  fuelTypeId: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateNozzle(input);
  }
  const id = newId();
  const { error } = await getSupabase().from('nozzles').insert({
    id,
    machine_number: input.machineNumber,
    nozzle_number: input.nozzleNumber,
    fuel_type_id: input.fuelTypeId,
    is_active: true,
  });
  throwIfError(error, 'Create nozzle');
  return id;
}

export async function setNozzleActive(id: string, isActive: boolean): Promise<void> {
  if (LOCAL_DEMO) {
    return demoSetNozzleActive(id, isActive);
  }
  const { error } = await getSupabase().from('nozzles').update({ is_active: isActive }).eq('id', id);
  throwIfError(error, 'Update nozzle');
}

export type NozzleUpdateInput = {
  machineNumber?: string;
  nozzleNumber?: string;
  fuelTypeId?: string;
};

export async function updateNozzle(id: string, patch: NozzleUpdateInput): Promise<void> {
  const payload: Record<string, string> = {};
  if (patch.machineNumber !== undefined) {
    payload.machine_number = patch.machineNumber.trim();
  }
  if (patch.nozzleNumber !== undefined) {
    payload.nozzle_number = patch.nozzleNumber.trim();
  }
  if (patch.fuelTypeId !== undefined) {
    payload.fuel_type_id = patch.fuelTypeId;
  }
  if (Object.keys(payload).length === 0) {
    return;
  }
  if (LOCAL_DEMO) {
    return demoUpdateNozzle(id, {
      ...(patch.machineNumber !== undefined ? { machineNumber: patch.machineNumber.trim() } : {}),
      ...(patch.nozzleNumber !== undefined ? { nozzleNumber: patch.nozzleNumber.trim() } : {}),
      ...(patch.fuelTypeId !== undefined ? { fuelTypeId: patch.fuelTypeId } : {}),
    });
  }
  const { error } = await getSupabase().from('nozzles').update(payload).eq('id', id);
  throwIfError(error, 'Update nozzle');
}

export async function deactivateNozzlesForMachine(machineNumber: string): Promise<void> {
  const key = machineNumber.trim();
  if (!key) {
    return;
  }
  if (LOCAL_DEMO) {
    return demoDeactivateNozzlesForMachine(key);
  }
  const all = await listNozzles(false);
  await Promise.all(
    all
      .filter((n) => n.machineNumber.trim() === key && n.isActive)
      .map((n) => setNozzleActive(n.id, false)),
  );
}

/** True if another active nozzle already uses this machine + nozzle pair. */
export async function activeNozzleSlotTaken(
  machineNumber: string,
  nozzleNumber: string,
  excludeId?: string,
): Promise<boolean> {
  const m = machineNumber.trim();
  const n = nozzleNumber.trim();
  const all = await listNozzles(true);
  return all.some(
    (row) =>
      row.id !== excludeId &&
      row.machineNumber.trim() === m &&
      row.nozzleNumber.trim() === n,
  );
}
