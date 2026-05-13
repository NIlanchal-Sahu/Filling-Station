import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { ShiftReconciliation } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import { parseCreditLineItems } from '@/services/reconciliationService';
import { demoListAllReconciliations, demoListReconciliationsInWindow } from '@/localDemo/demoBackend';

function mapRecon(id: string, data: DocumentData): ShiftReconciliation {
  return {
    id,
    shiftId: String(data.shiftId ?? ''),
    operatorId: String(data.operatorId ?? ''),
    totalSalesAmount: Number(data.totalSalesAmount ?? 0),
    paytmOnline: Number(data.paytmOnline ?? 0),
    iciciCard: Number(data.iciciCard ?? 0),
    fleetCard: Number(data.fleetCard ?? 0),
    creditAmount: Number(data.creditAmount ?? 0),
    shortAmount: Number(data.shortAmount ?? 0),
    cashAmount: Number(data.cashAmount ?? 0),
    totalReceived: Number(data.totalReceived ?? 0),
    difference: Number(data.difference ?? 0),
    status: (data.status as ShiftReconciliation['status']) ?? 'pending',
    managerComment: data.managerComment ? String(data.managerComment) : undefined,
    locked: data.locked === true,
    creditLineItems: parseCreditLineItems(data.creditLineItems),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listAllReconciliations(): Promise<ShiftReconciliation[]> {
  if (LOCAL_DEMO) {
    return demoListAllReconciliations();
  }
  const snap = await getDocs(collection(getDb(), COLLECTIONS.shiftReconciliations));
  return snap.docs.map((d) => mapRecon(d.id, d.data()));
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
