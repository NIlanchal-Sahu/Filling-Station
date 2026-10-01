import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { ShiftReading } from '@/types/entities';
import {
  demoCreateInitialReadings,
  demoGetLastClosingForNozzle,
  demoGetReading,
  demoListReadingsForShift,
  demoUpdateReadingsOnEnd,
} from '@/localDemo/demoBackend';
import { getNozzle } from '@/services/nozzlesService';
import { compareNozzleOrder } from '@/utils/nozzleSort';
import { formatMachineNumbers } from '@/utils/machineDisplay';

type ReadingRow = {
  id: string;
  shift_id: string | null;
  nozzle_id: string | null;
  opening_reading: number | null;
  closing_reading: number | null;
  test_liters: number | null;
  total_liters: number | null;
  final_sales_liters: number | null;
  rate_at_sale: number | null;
  total_amount: number | null;
};

type ShiftStampRow = {
  status: string | null;
  end_time: string | null;
  readings_complete_at: string | null;
};

function mapReading(row: ReadingRow): ShiftReading {
  return {
    id: row.id,
    shiftId: String(row.shift_id ?? ''),
    nozzleId: String(row.nozzle_id ?? ''),
    openingReading: Number(row.opening_reading ?? 0),
    closingReading: Number(row.closing_reading ?? 0),
    testLiters: Number(row.test_liters ?? 0),
    totalLiters: Number(row.total_liters ?? 0),
    finalSalesLiters: Number(row.final_sales_liters ?? 0),
    rateAtSale: Number(row.rate_at_sale ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
  };
}

export async function listReadingsForShift(shiftId: string): Promise<ShiftReading[]> {
  let readings: ShiftReading[];
  if (LOCAL_DEMO) {
    readings = await demoListReadingsForShift(shiftId);
  } else {
    const { data, error } = await getSupabase()
      .from('shift_readings')
      .select('*')
      .eq('shift_id', shiftId);
    throwIfError(error, 'List shift readings');
    readings = ((data ?? []) as ReadingRow[]).map(mapReading);
  }

  const paired = await Promise.all(
    readings.map(async (r) => ({ r, n: await getNozzle(r.nozzleId) })),
  );
  paired.sort((a, b) => {
    const af = a.n ?? { machineNumber: '999', nozzleNumber: '999' };
    const bf = b.n ?? { machineNumber: '999', nozzleNumber: '999' };
    return compareNozzleOrder(af, bf);
  });
  return paired.map((p) => p.r);
}

export async function getReading(id: string): Promise<ShiftReading | null> {
  if (LOCAL_DEMO) {
    return demoGetReading(id);
  }
  const { data, error } = await getSupabase().from('shift_readings').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load shift reading');
  return data ? mapReading(data as ReadingRow) : null;
}

/**
 * Latest closing reading for this nozzle: uses the most recently finalized meter row — either from a **closed**
 * shift (after reconciliation end time), or otherwise from **`readingsCompleteAt`** once end-of-shift meters were
 * saved, so the next day's opening can match yesterday's closing even before reconciliation is approved.
 */
export async function getLastClosingForNozzle(nozzleId: string): Promise<number> {
  if (LOCAL_DEMO) {
    return demoGetLastClosingForNozzle(nozzleId);
  }
  const { data, error } = await getSupabase()
    .from('shift_readings')
    .select('*')
    .eq('nozzle_id', nozzleId);
  throwIfError(error, 'List nozzle readings');
  const rows = (data ?? []) as ReadingRow[];
  if (rows.length === 0) {
    return 0;
  }
  let bestTs = -1;
  let bestClosing = 0;
  for (const row of rows) {
    const shiftId = String(row.shift_id ?? '');
    const { data: shift, error: shiftError } = await getSupabase()
      .from('shifts')
      .select('status, end_time, readings_complete_at')
      .eq('id', shiftId)
      .maybeSingle();
    throwIfError(shiftError, 'Load shift for nozzle closing');
    if (!shift) {
      continue;
    }
    const sd = shift as ShiftStampRow;
    const isClosed = sd.status === 'closed';
    let ts: number | null = null;
    if (isClosed && sd.end_time) {
      ts = Date.parse(sd.end_time);
    } else if (sd.readings_complete_at) {
      ts = Date.parse(sd.readings_complete_at);
    }
    if (ts == null || Number.isNaN(ts)) {
      continue;
    }
    const closing = Number(row.closing_reading ?? 0);
    if (ts > bestTs || (ts === bestTs && closing > bestClosing)) {
      bestTs = ts;
      bestClosing = closing;
    }
  }
  return bestClosing;
}

export async function createInitialReadings(
  shiftId: string,
  nozzleIds: string[],
  openingByNozzle: Record<string, number>,
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoCreateInitialReadings(shiftId, nozzleIds, openingByNozzle);
  }
  if (nozzleIds.length === 0) {
    return;
  }
  const rows = nozzleIds.map((nId) => {
    const open = openingByNozzle[nId] ?? 0;
    return {
      id: newId(),
      shift_id: shiftId,
      nozzle_id: nId,
      opening_reading: open,
      closing_reading: open,
      test_liters: 0,
      total_liters: 0,
      final_sales_liters: 0,
      rate_at_sale: 0,
      total_amount: 0,
    };
  });
  const { error } = await getSupabase().from('shift_readings').insert(rows);
  throwIfError(error, 'Create shift readings');
}

export async function updateReadingsOnEnd(
  updates: {
    id: string;
    openingReading: number;
    closingReading: number;
    testLiters: number;
    totalLiters: number;
    finalSalesLiters: number;
    rateAtSale: number;
    totalAmount: number;
  }[],
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateReadingsOnEnd(updates);
  }
  if (updates.length === 0) {
    return;
  }
  const { error } = await getSupabase().rpc('update_shift_readings', { updates });
  throwIfError(error, 'Update shift readings');
}

export function computeLiters(
  opening: number,
  closing: number,
  test: number,
): { totalLiters: number; finalSalesLiters: number } {
  const totalLiters = Math.max(0, closing - opening);
  const finalSalesLiters = Math.max(0, totalLiters - test);
  return { totalLiters, finalSalesLiters };
}

/** Dispenser machines assigned to this shift via its nozzles (e.g. "M1" or "M1, M2"). */
export async function getMachineLabelForShift(shiftId: string): Promise<string> {
  const readings = await listReadingsForShift(shiftId);
  if (readings.length === 0) return '—';

  const machineNums: string[] = [];
  for (const r of readings) {
    const nozzle = await getNozzle(r.nozzleId);
    if (nozzle?.machineNumber.trim()) {
      machineNums.push(nozzle.machineNumber.trim());
    }
  }

  return formatMachineNumbers(machineNums);
}
