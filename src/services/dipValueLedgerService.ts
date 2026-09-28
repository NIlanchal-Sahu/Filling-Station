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
import { nextPumpDayIso, priorPumpDayIso } from '@/utils/dipValueRegister';
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
  updatedBy?: string;
};

export async function upsertDipValueLedgerEntry(input: UpsertDipValueLedgerInput): Promise<void> {
  const openingStockLiters = roundLiters(input.openingStockLiters);
  const receiptLiters = roundLiters(input.receiptLiters);
  const salesLiters = roundLiters(input.salesLiters);
  const totalStockLiters = roundLiters(openingStockLiters + receiptLiters);
  const closingBookLiters = roundLiters(totalStockLiters - salesLiters);

  if (LOCAL_DEMO) {
    await demoUpsertDipValueLedgerEntry({
      ...input,
      openingStockLiters,
      receiptLiters,
      salesLiters,
      totalStockLiters,
      closingBookLiters,
    });
    await setFuelTypeCurrentStockLiters(input.fuelTypeId, openingStockLiters);
    await linkVariationChain(input.fuelTypeId, input.pumpDayIso, openingStockLiters);
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
      updatedAt: serverTimestamp(),
      updatedBy: input.updatedBy ?? null,
    },
    { merge: true },
  );
  await setFuelTypeCurrentStockLiters(input.fuelTypeId, openingStockLiters);
  await linkVariationChain(input.fuelTypeId, input.pumpDayIso, openingStockLiters);
}

async function linkVariationChain(
  fuelTypeId: string,
  pumpDayIso: string,
  todayOpening: number,
): Promise<void> {
  const priorIso = priorPumpDayIso(pumpDayIso);
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorIso);
  if (!prior) return;
  const variationLiters = roundLiters(todayOpening - prior.closingBookLiters);
  if (LOCAL_DEMO) {
    await demoUpsertDipValueLedgerEntry({
      fuelTypeId,
      pumpDayIso: priorIso,
      openingStockLiters: prior.openingStockLiters,
      receiptLiters: prior.receiptLiters,
      salesLiters: prior.salesLiters,
      totalStockLiters: prior.totalStockLiters,
      closingBookLiters: prior.closingBookLiters,
      variationLiters,
      updatedBy: prior.updatedBy,
    });
    return;
  }
  const id = ledgerDocId(fuelTypeId, priorIso);
  await setDoc(
    doc(getDb(), COLLECTIONS.fuelDipLedger, id),
    { variationLiters, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Suggested opening when no ledger row exists yet for this day. */
export async function suggestOpeningStockLiters(
  fuelTypeId: string,
  pumpDayIso: string,
): Promise<number | null> {
  const existing = await getDipValueLedgerEntry(fuelTypeId, pumpDayIso);
  if (existing) return existing.openingStockLiters;
  const prior = await getDipValueLedgerEntry(fuelTypeId, priorPumpDayIso(pumpDayIso));
  if (prior) return prior.closingBookLiters;
  return null;
}

export function computeClosingBook(
  openingStockLiters: number,
  receiptLiters: number,
  salesLiters: number,
): number {
  return roundLiters(openingStockLiters + receiptLiters - salesLiters);
}

export async function computeChainVariation(
  fuelTypeId: string,
  pumpDayIso: string,
  closingBookLiters: number,
): Promise<number | null> {
  const next = await getDipValueLedgerEntry(fuelTypeId, nextPumpDayIso(pumpDayIso));
  if (!next) return null;
  return roundLiters(next.openingStockLiters - closingBookLiters);
}
