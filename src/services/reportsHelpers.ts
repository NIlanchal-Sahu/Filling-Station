import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import type { ShiftReconciliation } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import { parseCreditLineItems } from '@/services/reconciliationService';
import { demoListAllReconciliations, demoListReconciliationsInWindow } from '@/localDemo/demoBackend';

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

export async function listAllReconciliations(): Promise<ShiftReconciliation[]> {
  if (LOCAL_DEMO) {
    return demoListAllReconciliations();
  }
  const { data, error } = await getSupabase().from('shift_reconciliations').select('*');
  throwIfError(error, 'List reconciliations');
  return ((data ?? []) as ReconRow[]).map(mapRecon);
}

export async function listReconciliationsInWindow(
  from: Date,
  to: Date,
): Promise<ShiftReconciliation[]> {
  if (LOCAL_DEMO) {
    return demoListReconciliationsInWindow(from, to);
  }
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const all = await listAllReconciliations();
  return all.filter((r) => {
    const t = r.createdAt?.toDate?.() ?? from;
    const m = t.getTime();
    return m >= fromMs && m <= toMs;
  });
}
