import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { ShiftReading } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoCreateInitialReadings,
  demoGetLastClosingForNozzle,
  demoGetReading,
  demoListReadingsForShift,
  demoUpdateReadingsOnEnd,
} from '@/localDemo/demoBackend';

function mapReading(id: string, data: DocumentData): ShiftReading {
  return {
    id,
    shiftId: String(data.shiftId ?? ''),
    nozzleId: String(data.nozzleId ?? ''),
    openingReading: Number(data.openingReading ?? 0),
    closingReading: Number(data.closingReading ?? 0),
    testLiters: Number(data.testLiters ?? 0),
    totalLiters: Number(data.totalLiters ?? 0),
    finalSalesLiters: Number(data.finalSalesLiters ?? 0),
    rateAtSale: Number(data.rateAtSale ?? 0),
    totalAmount: Number(data.totalAmount ?? 0),
  };
}

export async function listReadingsForShift(shiftId: string): Promise<ShiftReading[]> {
  if (LOCAL_DEMO) {
    return demoListReadingsForShift(shiftId);
  }
  const ref = collection(getDb(), COLLECTIONS.shiftReadings);
  const qy = query(ref, where('shiftId', '==', shiftId));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapReading(d.id, d.data()));
}

export async function getReading(id: string): Promise<ShiftReading | null> {
  if (LOCAL_DEMO) {
    return demoGetReading(id);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.shiftReadings, id));
  if (!snap.exists()) {
    return null;
  }
  return mapReading(snap.id, snap.data());
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
  const ref = collection(getDb(), COLLECTIONS.shiftReadings);
  const qy = query(ref, where('nozzleId', '==', nozzleId));
  const snap = await getDocs(qy);
  if (snap.empty) {
    return 0;
  }
  let bestTs = -1;
  let bestClosing = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const shiftId = String(data.shiftId ?? '');
    const shiftDoc = await getDoc(doc(getDb(), COLLECTIONS.shifts, shiftId));
    if (!shiftDoc.exists()) {
      continue;
    }
    const sd = shiftDoc.data()!;
    const isClosed = sd.status === 'closed';
    let ts: number | null = null;
    if (isClosed && sd.endTime?.toMillis) {
      ts = sd.endTime.toMillis();
    } else if (sd.readingsCompleteAt?.toMillis) {
      ts = sd.readingsCompleteAt.toMillis();
    }
    if (ts == null) {
      continue;
    }
    const closing = Number(data.closingReading ?? 0);
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
  const batch = writeBatch(getDb());
  for (const nId of nozzleIds) {
    const open = openingByNozzle[nId] ?? 0;
    const r = doc(collection(getDb(), COLLECTIONS.shiftReadings));
    batch.set(r, {
      shiftId,
      nozzleId: nId,
      openingReading: open,
      closingReading: open,
      testLiters: 0,
      totalLiters: 0,
      finalSalesLiters: 0,
      rateAtSale: 0,
      totalAmount: 0,
    });
  }
  await batch.commit();
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
  const batch = writeBatch(getDb());
  for (const u of updates) {
    const r = doc(getDb(), COLLECTIONS.shiftReadings, u.id);
    batch.update(r, {
      openingReading: u.openingReading,
      closingReading: u.closingReading,
      testLiters: u.testLiters,
      totalLiters: u.totalLiters,
      finalSalesLiters: u.finalSalesLiters,
      rateAtSale: u.rateAtSale,
      totalAmount: u.totalAmount,
    });
  }
  await batch.commit();
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
