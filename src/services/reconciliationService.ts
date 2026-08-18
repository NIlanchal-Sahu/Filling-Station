import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { ReconciliationCreditLine, ShiftReconciliation } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import { createCreditSalesForReconciliation, replaceCreditSalesForShift } from '@/services/creditSalesService';
import { closeShift } from '@/services/shiftsService';
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

export function parseCreditLineItems(raw: unknown): ReconciliationCreditLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item): ReconciliationCreditLine => {
    const o = item as DocumentData;
    return {
      customerId: String(o.customerId ?? ''),
      amount: Number(o.amount ?? 0),
      fuelTypeId: o.fuelTypeId ? String(o.fuelTypeId) : undefined,
      liters: o.liters != null ? Number(o.liters) : undefined,
      rateAtSale: o.rateAtSale != null ? Number(o.rateAtSale) : undefined,
    };
  });
}

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

export async function getReconciliationForShift(
  shiftId: string,
): Promise<ShiftReconciliation | null> {
  if (LOCAL_DEMO) {
    return demoGetReconciliationForShift(shiftId);
  }
  const ref = collection(getDb(), COLLECTIONS.shiftReconciliations);
  const qy = query(ref, where('shiftId', '==', shiftId));
  const snap = await getDocs(qy);
  if (snap.empty) {
    return null;
  }
  const rows = snap.docs
    .map((d) => mapRecon(d.id, d.data()))
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );
  return rows[0] ?? null;
}

export async function getReconciliation(id: string): Promise<ShiftReconciliation | null> {
  if (LOCAL_DEMO) {
    return demoGetReconciliation(id);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.shiftReconciliations, id));
  if (!snap.exists()) {
    return null;
  }
  return mapRecon(snap.id, snap.data());
}

export async function listPendingReconciliations(): Promise<ShiftReconciliation[]> {
  if (LOCAL_DEMO) {
    return demoListPendingReconciliations();
  }
  const ref = collection(getDb(), COLLECTIONS.shiftReconciliations);
  const qy = query(ref, where('status', '==', 'pending'));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapRecon(d.id, d.data()))
    .sort(
      (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0),
    );
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
  const batch = writeBatch(getDb());
  const reconRef = doc(collection(getDb(), COLLECTIONS.shiftReconciliations));
  batch.set(reconRef, {
    shiftId: input.shiftId,
    operatorId: input.operatorId,
    totalSalesAmount: input.totalSalesAmount,
    paytmOnline: input.paytmOnline,
    iciciCard: input.iciciCard,
    fleetCard: input.fleetCard,
    creditAmount: input.creditAmount,
    shortAmount: input.shortAmount,
    cashAmount: input.cashAmount,
    totalReceived: input.totalReceived,
    difference: input.difference,
    status: 'pending',
    locked: false,
    creditLineItems: input.creditLineItems,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  if (input.creditLineItems.length > 0) {
    await createCreditSalesForReconciliation(
      reconRef.id,
      input.shiftId,
      input.creditLineItems,
    );
  }
  await closeShift(input.shiftId);
  notifyShiftSalesUpdated();
  notifyShiftStatusUpdated();
  return reconRef.id;
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
  const r = doc(getDb(), COLLECTIONS.shiftReconciliations, id);
  await updateDoc(r, {
    status,
    managerComment: managerComment ?? null,
    locked: status === 'approved',
    updatedAt: serverTimestamp(),
  });
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
  const r = doc(getDb(), COLLECTIONS.shiftReconciliations, id);
  const snap = await getDoc(r);
  if (!snap.exists()) {
    throw new Error('Reconciliation not found.');
  }
  const data = snap.data();
  if (data.status !== 'pending') {
    throw new Error('Only pending reconciliations can be edited.');
  }
  await updateDoc(r, {
    totalSalesAmount: input.totalSalesAmount,
    paytmOnline: input.paytmOnline,
    iciciCard: input.iciciCard,
    fleetCard: input.fleetCard,
    creditAmount: input.creditAmount,
    shortAmount: input.shortAmount,
    cashAmount: input.cashAmount,
    totalReceived: input.totalReceived,
    difference: input.difference,
    creditLineItems: input.creditLineItems,
    updatedAt: serverTimestamp(),
  });
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
  const r = doc(getDb(), COLLECTIONS.shiftReconciliations, id);
  await updateDoc(r, { locked: !unlocked, updatedAt: serverTimestamp() });
}
