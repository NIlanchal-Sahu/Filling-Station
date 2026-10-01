import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import type { ReconciliationCreditLine, ShiftReconciliation } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import { replaceCreditSalesForShift } from '@/services/creditSalesService';
import { getShift, shiftPumpDayIso } from '@/services/shiftsService';
import { notifyShiftSalesUpdated } from '@/utils/shiftSalesDisplay';
import { notifyShiftStatusUpdated } from '@/utils/shiftStatusDisplay';
import {
  demoCreateReconciliationWithClose,
  demoGetReconciliation,
  demoGetReconciliationForShift,
  demoListPendingReconciliations,
  demoSetReconciliationStatus,
  demoSetReconciliationUnlocked,
  demoUpdatePendingReconciliation,
} from '@/localDemo/demoBackend';

type ReconRow = {
  id: string;
  shift_id: string | null;
  operator_id: string | null;
  total_sales_amount: number | null;
  paytm_online: number | null;
  icici_card: number | null;
  fleet_card: number | null;
  credit_amount: number | null;
  short_amount: number | null;
  cash_amount: number | null;
  total_received: number | null;
  difference: number | null;
  status: string | null;
  manager_comment: string | null;
  locked: boolean | null;
  credit_line_items: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export function parseCreditLineItems(raw: unknown): ReconciliationCreditLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item): ReconciliationCreditLine => {
    const o = item as Record<string, unknown>;
    return {
      customerId: String(o.customerId ?? ''),
      amount: Number(o.amount ?? 0),
      fuelTypeId: o.fuelTypeId ? String(o.fuelTypeId) : undefined,
      liters: o.liters != null ? Number(o.liters) : undefined,
      rateAtSale: o.rateAtSale != null ? Number(o.rateAtSale) : undefined,
    };
  });
}

function mapRecon(row: ReconRow): ShiftReconciliation {
  return {
    id: row.id,
    shiftId: String(row.shift_id ?? ''),
    operatorId: String(row.operator_id ?? ''),
    totalSalesAmount: Number(row.total_sales_amount ?? 0),
    paytmOnline: Number(row.paytm_online ?? 0),
    iciciCard: Number(row.icici_card ?? 0),
    fleetCard: Number(row.fleet_card ?? 0),
    creditAmount: Number(row.credit_amount ?? 0),
    shortAmount: Number(row.short_amount ?? 0),
    cashAmount: Number(row.cash_amount ?? 0),
    totalReceived: Number(row.total_received ?? 0),
    difference: Number(row.difference ?? 0),
    status: (row.status as ShiftReconciliation['status']) ?? 'pending',
    managerComment: row.manager_comment ? String(row.manager_comment) : undefined,
    locked: row.locked === true,
    creditLineItems: parseCreditLineItems(row.credit_line_items),
    createdAt: asTimestamp(row.created_at),
    updatedAt: asTimestamp(row.updated_at),
  };
}

function localNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export async function getReconciliationForShift(
  shiftId: string,
): Promise<ShiftReconciliation | null> {
  if (LOCAL_DEMO) {
    return demoGetReconciliationForShift(shiftId);
  }
  const { data, error } = await getSupabase()
    .from('shift_reconciliations')
    .select('*')
    .eq('shift_id', shiftId);
  throwIfError(error, 'Load reconciliation');
  const rows = ((data ?? []) as ReconRow[])
    .map(mapRecon)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return rows[0] ?? null;
}

export async function getReconciliation(id: string): Promise<ShiftReconciliation | null> {
  if (LOCAL_DEMO) {
    return demoGetReconciliation(id);
  }
  const { data, error } = await getSupabase()
    .from('shift_reconciliations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Load reconciliation');
  return data ? mapRecon(data as ReconRow) : null;
}

export async function listPendingReconciliations(): Promise<ShiftReconciliation[]> {
  if (LOCAL_DEMO) {
    return demoListPendingReconciliations();
  }
  const { data, error } = await getSupabase()
    .from('shift_reconciliations')
    .select('*')
    .eq('status', 'pending');
  throwIfError(error, 'List pending reconciliations');
  return ((data ?? []) as ReconRow[])
    .map(mapRecon)
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
}

export async function createReconciliationWithClose(input: {
  shiftId: string;
  operatorId: string;
  totalSalesAmount: number;
  paytmOnline: number;
  iciciCard: number;
  fleetCard: number;
  creditAmount: number;
  shortAmount: number;
  cashAmount: number;
  totalReceived: number;
  difference: number;
  creditLineItems: ReconciliationCreditLine[];
}): Promise<string> {
  if (LOCAL_DEMO) {
    const id = await demoCreateReconciliationWithClose(input);
    notifyShiftSalesUpdated();
    notifyShiftStatusUpdated();
    return id;
  }
  const shift = await getShift(input.shiftId);
  const saleDate = shift ? localNoon(shiftPumpDayIso(shift)) : new Date();
  const { data, error } = await getSupabase().rpc('create_reconciliation_with_close', {
    payload: {
      ...input,
      saleDate: saleDate.toISOString(),
    },
  });
  throwIfError(error, 'Close shift with reconciliation');
  notifyShiftSalesUpdated();
  notifyShiftStatusUpdated();
  return String(data ?? '');
}

export async function setReconciliationStatus(
  id: string,
  status: 'approved' | 'rejected',
  managerComment?: string,
): Promise<void> {
  if (LOCAL_DEMO) {
    await demoSetReconciliationStatus(id, status, managerComment);
    notifyShiftStatusUpdated();
    return;
  }
  const { error } = await getSupabase()
    .from('shift_reconciliations')
    .update({
      status,
      manager_comment: managerComment ?? null,
      locked: status === 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  throwIfError(error, 'Update reconciliation status');
  notifyShiftStatusUpdated();
}

export async function updatePendingReconciliation(
  id: string,
  input: {
    shiftId: string;
    totalSalesAmount: number;
    paytmOnline: number;
    iciciCard: number;
    fleetCard: number;
    creditAmount: number;
    shortAmount: number;
    cashAmount: number;
    totalReceived: number;
    difference: number;
    creditLineItems: ReconciliationCreditLine[];
  },
): Promise<void> {
  if (LOCAL_DEMO) {
    await demoUpdatePendingReconciliation(id, input);
    notifyShiftSalesUpdated();
    notifyShiftStatusUpdated();
    return;
  }
  const existing = await getReconciliation(id);
  if (!existing) {
    throw new Error('Reconciliation not found.');
  }
  if (existing.status !== 'pending') {
    throw new Error('Only pending reconciliations can be edited.');
  }
  const { error } = await getSupabase()
    .from('shift_reconciliations')
    .update({
      total_sales_amount: input.totalSalesAmount,
      paytm_online: input.paytmOnline,
      icici_card: input.iciciCard,
      fleet_card: input.fleetCard,
      credit_amount: input.creditAmount,
      short_amount: input.shortAmount,
      cash_amount: input.cashAmount,
      total_received: input.totalReceived,
      difference: input.difference,
      credit_line_items: input.creditLineItems,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  throwIfError(error, 'Update reconciliation');
  await replaceCreditSalesForShift(input.shiftId, input.creditLineItems);
  notifyShiftSalesUpdated();
}

export async function setReconciliationUnlocked(
  id: string,
  unlocked: boolean,
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoSetReconciliationUnlocked(id, unlocked);
  }
  const { error } = await getSupabase()
    .from('shift_reconciliations')
    .update({ locked: !unlocked, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwIfError(error, 'Unlock reconciliation');
}
