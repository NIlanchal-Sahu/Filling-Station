import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import type { DipValueLedgerEntry } from '@/types/entities';
import {
  demoGetDipValueLedgerEntry,
  demoListDipValueLedgerInRange,
  demoUpsertDipValueLedgerEntry,
} from '@/localDemo/demoBackend';
import {
  closingBookLitersFromEntry,
  computeOpeningVariationLiters,
  priorPumpDayIso,
} from '@/utils/dipValueRegister';
import { setFuelTypeCurrentStockLiters } from '@/services/fuelStockService';

function ledgerDocId(fuelTypeId: string, pumpDayIso: string): string {
  return `${pumpDayIso}_${fuelTypeId}`;
}

function roundLiters(n: number): number {
  return Math.round(n * 10) / 10;
}

function mapEntry(id: string, data: DocumentData): DipValueLedgerEntry {
  return {
    id,
    fuelTypeId: String(data.fuelTypeId ?? ''),
    pumpDayIso: String(data.pumpDayIso ?? ''),
    openingStockLiters: Number(data.openingStockLiters ?? 0),
    receiptLiters: Number(data.receiptLiters ?? 0),
    totalStockLiters: Number(data.totalStockLiters ?? 0),
    salesLiters: Number(data.salesLiters ?? 0),
    closingBookLiters: Number(data.closingBookLiters ?? 0),
    variationLiters: data.variationLiters != null ? Number(data.variationLiters) : null,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy != null ? String(data.updatedBy) : undefined,
  };
}

export async function getDipValueLedgerEntry(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<DipValueLedgerEntry | null> {
  if (LOCAL_DEMO) {
    return demoGetDipValueLedgerEntry(fuelTypeId, pumpDayIso);
  }
  const id = ledgerDocId(fuelTypeId, pumpDayIso);
  const snap = await getDoc(doc(getDb(), COLLECTIONS.fuelDipLedger, id));
  if (!snap.exists()) return null;
  return mapEntry(snap.id, snap.data());
}

export async function listDipValueLedgerForDay(pumpDayIso: string): Promise<DipValueLedgerEntry[]> {
  return listDipValueLedgerInRange(pumpDayIso, pumpDayIso);
}

export async function listDipValueLedgerInRange(
  fromIso: string,
  toIso: string,
  fuelTypeId?: string,
): Promise<DipValueLedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListDipValueLedgerInRange(fromIso, toIso, fuelTypeId);
  }
  const ref = collection(getDb(), COLLECTIONS.fuelDipLedger);
  const qy = query(
    ref,
    where('pumpDayIso', '>=', fromIso),
    where('pumpDayIso', '<=', toIso),
  );
  const snap = await getDocs(qy);
  let list = snap.docs.map((d) => mapEntry(d.id, d.data()));
  if (fuelTypeId) {
    list = list.filter((e) => e.fuelTypeId === fuelTypeId);
  }
  return list.sort(
    (a, b) => a.pumpDayIso.localeCompare(b.pumpDayIso) || a.fuelTypeId.localeCompare(b.fuelTypeId),
  );
}

export type UpsertDipValueLedgerInput = {
  fuelTypeId: string;
  pumpDayIso: string;
  openingStockLiters: number;
  receiptLiters: number;
  salesLiters: number;
  /** When set, stored as closing book (physical / dip liters). Otherwise opening + receipt − sales. */
  closingBookLiters?: number;
  updatedBy?: string;
};

export async function upsertDipValueLedgerEntry(input: UpsertDipValueLedgerInput): Promise<void> {
  const openingStockLiters = roundLiters(input.openingStockLiters);
  const receiptLiters = roundLiters(input.receiptLiters);
  const salesLiters = roundLiters(input.salesLiters);
  const totalStockLiters = roundLiters(openingStockLiters + receiptLiters);
  const closingBookLiters =
    input.closingBookLiters != null && Number.isFinite(input.closingBookLiters)
      ? roundLiters(input.closingBookLiters)
      : roundLiters(totalStockLiters - salesLiters);

  const prior = await getDipValueLedgerEntry(input.fuelTypeId, priorPumpDayIso(input.pumpDayIso));
  const priorClosing = prior ? closingBookLitersFromEntry(prior) : null;
  const variationLiters = computeOpeningVariationLiters(openingStockLiters, priorClosing);

  if (LOCAL_DEMO) {
    await demoUpsertDipValueLedgerEntry({
      ...input,
      openingStockLiters,
      receiptLiters,
      salesLiters,
      totalStockLiters,
      closingBookLiters,
      variationLiters,
    });
    await setFuelTypeCurrentStockLiters(input.fuelTypeId, closingBookLiters);
    return;
  }

  const id = ledgerDocId(input.fuelTypeId, input.pumpDayIso);
  await setDoc(
    doc(getDb(), COLLECTIONS.fuelDipLedger, id),
    {
      fuelTypeId: input.fuelTypeId,
      pumpDayIso: input.pumpDayIso,
      openingStockLiters,
      receiptLiters,
      totalStockLiters,
      salesLiters,
      closingBookLiters,
      variationLiters,
      updatedAt: serverTimestamp(),
      updatedBy: input.updatedBy ?? null,
    },
    { merge: true },
  );
  await setFuelTypeCurrentStockLiters(input.fuelTypeId, closingBookLiters);
}

/** Previous calendar pump day closing book (liters), if saved. */
export async function getPriorDayClosingBookLiters(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number | null> {
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorPumpDayIso(pumpDayIso));
  return prior ? closingBookLitersFromEntry(prior) : null;
}

/** Suggested opening when no ledger row exists yet for this day. */
export async function suggestOpeningStockLiters(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number | null> {
  const existing = await getDipValueLedgerEntry(fuelTypeId, pumpDayIso);
  if (existing) return existing.openingStockLiters;
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorPumpDayIso(pumpDayIso));
  if (prior) return closingBookLitersFromEntry(prior);
  return null;
}

export function computeClosingBook(
  openingStockLiters: number,
  receiptLiters: number,
  salesLiters: number,
): number {
  return roundLiters(openingStockLiters + receiptLiters - salesLiters);
}

