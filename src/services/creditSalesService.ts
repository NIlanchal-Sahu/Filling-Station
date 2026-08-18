import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { CreditSale, ReconciliationCreditLine } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoCreateCreditSalesForReconciliation,
  demoCreateManualCreditSale,
  demoListAllCreditSales,
  demoListSalesForCustomer,
  demoReplaceCreditSalesForShift,
} from '@/localDemo/demoBackend';

/** Sentinel shift id for credit lines posted from customer detail (not tied to shift recon). */
export const MANAGER_CREDIT_SHIFT_ID = '__mgr_credit__';

function roundMoney2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function mapCreditSale(id: string, data: DocumentData): CreditSale {
  return {
    id,
    customerId: String(data.customerId ?? ''),
    shiftId: String(data.shiftId ?? ''),
    date: data.date,
    amount: Number(data.amount ?? 0),
    fuelTypeId: data.fuelTypeId ? String(data.fuelTypeId) : undefined,
    liters: data.liters != null ? Number(data.liters) : undefined,
    rateAtSale: data.rateAtSale != null ? Number(data.rateAtSale) : undefined,
    reference: data.reference ? String(data.reference) : undefined,
  };
}

export async function replaceCreditSalesForShift(
  shiftId: string,
  lines: ReconciliationCreditLine[],
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoReplaceCreditSalesForShift(shiftId, lines);
  }
  const ref = collection(getDb(), COLLECTIONS.creditSales);
  const qy = query(ref, where('shiftId', '==', shiftId));
  const snap = await getDocs(qy);
  const batch = writeBatch(getDb());
  for (const d of snap.docs) {
    const data = d.data();
    const refStr = data.reference ? String(data.reference) : '';
    if (!refStr.startsWith('SHIFT_RECON:')) {
      continue;
    }
    const customerId = String(data.customerId ?? '');
    const amount = Number(data.amount ?? 0);
    if (customerId && amount > 0) {
      await bumpCustomerBalance(customerId, -amount);
    }
    batch.delete(d.ref);
  }
  await batch.commit();
  if (lines.length > 0) {
    await createCreditSalesForReconciliation('update', shiftId, lines);
  }
}

export async function createCreditSalesForReconciliation(
  _reconciliationId: string,
  shiftId: string,
  lines: ReconciliationCreditLine[],
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoCreateCreditSalesForReconciliation(_reconciliationId, shiftId, lines);
  }
  const batch = writeBatch(getDb());
  const now = Timestamp.now();
  for (const line of lines) {
    if (line.amount <= 0) {
      continue;
    }
    const r = doc(collection(getDb(), COLLECTIONS.creditSales));
    const payload: Record<string, unknown> = {
      customerId: line.customerId,
      shiftId,
      date: now,
      amount: roundMoney2(line.amount),
      reference: `SHIFT_RECON:${shiftId}`,
    };
    if (line.fuelTypeId) {
      payload.fuelTypeId = line.fuelTypeId;
    }
    if (line.liters != null && Number.isFinite(line.liters)) {
      payload.liters = line.liters;
    }
    if (line.rateAtSale != null && Number.isFinite(line.rateAtSale)) {
      payload.rateAtSale = roundMoney2(line.rateAtSale);
    }
    batch.set(r, payload);
  }
  await batch.commit();
  for (const line of lines) {
    if (line.amount > 0) {
      await bumpCustomerBalance(line.customerId, line.amount);
    }
  }
}

async function bumpCustomerBalance(customerId: string, deltaCredit: number): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.creditCustomers, customerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return;
  }
  const cur = Number(snap.data()?.currentBalance ?? 0);
  await updateDoc(ref, { currentBalance: cur + deltaCredit });
}

/** Manager-only: log credit sale like a cashbook line (fuel, liters × rate → amount). */
export async function createManualCreditSale(input: {
  customerId: string;
  date: Date;
  fuelTypeId: string;
  liters: number;
  rateAtSale: number;
}): Promise<string> {
  const amount = roundMoney2(input.liters * input.rateAtSale);
  if (amount <= 0 || input.liters <= 0 || input.rateAtSale < 0) {
    throw new Error('Liters and rate must produce a positive amount.');
  }

  if (LOCAL_DEMO) {
    return demoCreateManualCreditSale({
      customerId: input.customerId,
      date: input.date,
      fuelTypeId: input.fuelTypeId,
      liters: input.liters,
      rateAtSale: roundMoney2(input.rateAtSale),
      amount,
    });
  }

  const r = await addDoc(collection(getDb(), COLLECTIONS.creditSales), {
    customerId: input.customerId,
    shiftId: MANAGER_CREDIT_SHIFT_ID,
    date: Timestamp.fromDate(input.date),
    amount,
    fuelTypeId: input.fuelTypeId,
    liters: input.liters,
    rateAtSale: roundMoney2(input.rateAtSale),
    reference: 'MANAGER_ENTRY',
  });
  await bumpCustomerBalance(input.customerId, amount);
  return r.id;
}

export async function listSalesForCustomer(customerId: string): Promise<CreditSale[]> {
  if (LOCAL_DEMO) {
    return demoListSalesForCustomer(customerId);
  }
  const ref = collection(getDb(), COLLECTIONS.creditSales);
  const qy = query(ref, where('customerId', '==', customerId));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapCreditSale(d.id, d.data()))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

export async function listAllCreditSales(): Promise<CreditSale[]> {
  if (LOCAL_DEMO) {
    return demoListAllCreditSales();
  }
  const snap = await getDocs(collection(getDb(), COLLECTIONS.creditSales));
  return snap.docs.map((d) => mapCreditSale(d.id, d.data()));
}
