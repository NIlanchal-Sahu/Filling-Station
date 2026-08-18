import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { LOCAL_DEMO } from '@/config/appMode';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoListFuelReceiptsForDay,
  demoRecordFuelReceipt,
  demoSetFuelReceiptLitersForDay,
} from '@/localDemo/demoBackend';
import type { FuelReceipt } from '@/types/entities';
import { notifyFuelStockUpdated } from '@/utils/fuelStockDisplay';

function mapReceipt(id: string, data: DocumentData): FuelReceipt {
  return {
    id,
    fuelTypeId: String(data.fuelTypeId ?? ''),
    pumpDayIso: String(data.pumpDayIso ?? ''),
    liters: Number(data.liters ?? 0),
    supplier: data.supplier ? String(data.supplier) : undefined,
    invoiceNo: data.invoiceNo ? String(data.invoiceNo) : undefined,
    recordedBy: data.recordedBy ? String(data.recordedBy) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    recordedAt: data.recordedAt,
  };
}

export async function listFuelReceiptsForDay(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<FuelReceipt[]> {
  if (LOCAL_DEMO) {
    return demoListFuelReceiptsForDay(fuelTypeId, pumpDayIso);
  }

  const q = query(
    collection(getDb(), COLLECTIONS.fuelReceipts),
    where('fuelTypeId', '==', fuelTypeId),
    where('pumpDayIso', '==', pumpDayIso),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReceipt(d.id, d.data()));
}

export async function sumFuelReceiptLitersForDay(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number> {
  const rows = await listFuelReceiptsForDay(fuelTypeId, pumpDayIso);
  return rows.reduce((sum, r) => sum + r.liters, 0);
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

  await addDoc(collection(getDb(), COLLECTIONS.fuelReceipts), {
    fuelTypeId: input.fuelTypeId,
    pumpDayIso: input.pumpDayIso,
    liters: input.liters,
    recordedAt: serverTimestamp(),
    recordedBy: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  notifyFuelStockUpdated();
}

export async function recordFuelReceipt(input: {
  fuelTypeId: string;
  pumpDayIso: string;
  liters: number;
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

  const ref = await addDoc(collection(getDb(), COLLECTIONS.fuelReceipts), {
    fuelTypeId: input.fuelTypeId,
    pumpDayIso: input.pumpDayIso,
    liters: input.liters,
    supplier: input.supplier ?? null,
    invoiceNo: input.invoiceNo ?? null,
    recordedAt: serverTimestamp(),
    recordedBy: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });
  notifyFuelStockUpdated();
  return ref.id;
}
