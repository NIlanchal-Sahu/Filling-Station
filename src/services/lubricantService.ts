import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { Lubricant, LubricantSale, LubricantStockEntry } from '@/types/entities';
import { getDb, COLLECTIONS } from '@/lib/firebase';
import {
  demoCreateLubricant,
  demoUpdateLubricant,
  demoListLubricants,
  demoGetLubricant,
  demoAddLubricantStock,
  demoListLubricantStock,
  demoAddLubricantSale,
  demoListLubricantSales,
} from '@/localDemo/demoBackend';

// ── mappers ──────────────────────────────────────────────────────────────────

function mapLubricant(id: string, d: DocumentData): Lubricant {
  return {
    id,
    name: String(d.name ?? ''),
    brand: String(d.brand ?? ''),
    grade: String(d.grade ?? ''),
    unit: String(d.unit ?? 'litre'),
    sellingPrice: Number(d.sellingPrice ?? 0),
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentStock: Number(d.currentStock ?? 0),
    minStockAlert: Number(d.minStockAlert ?? 0),
    isActive: d.isActive !== false,
  };
}

function mapStockEntry(id: string, d: DocumentData): LubricantStockEntry {
  return {
    id,
    lubricantId: String(d.lubricantId ?? ''),
    pumpDayIso: String(d.pumpDayIso ?? ''),
    quantity: Number(d.quantity ?? 0),
    purchasePricePerUnit: Number(d.purchasePricePerUnit ?? 0),
    supplier: d.supplier ?? undefined,
    invoiceNo: d.invoiceNo ?? undefined,
    notes: d.notes ?? undefined,
    recordedBy: d.recordedBy ?? undefined,
    recordedAt: d.recordedAt as Timestamp,
  };
}

function mapSale(id: string, d: DocumentData): LubricantSale {
  return {
    id,
    lubricantId: String(d.lubricantId ?? ''),
    pumpDayIso: String(d.pumpDayIso ?? ''),
    quantity: Number(d.quantity ?? 0),
    sellingPricePerUnit: Number(d.sellingPricePerUnit ?? 0),
    totalAmount: Number(d.totalAmount ?? 0),
    customerName: d.customerName ?? undefined,
    vehicleNumber: d.vehicleNumber ?? undefined,
    notes: d.notes ?? undefined,
    recordedBy: d.recordedBy ?? undefined,
    recordedAt: d.recordedAt as Timestamp,
  };
}

// ── lubricant catalog ─────────────────────────────────────────────────────────

export async function listLubricants(activeOnly = true): Promise<Lubricant[]> {
  if (LOCAL_DEMO) return demoListLubricants(activeOnly);
  const ref = collection(getDb(), COLLECTIONS.lubricants);
  const qy = activeOnly ? query(ref, where('isActive', '==', true)) : ref;
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapLubricant(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLubricant(id: string): Promise<Lubricant | null> {
  if (LOCAL_DEMO) return demoGetLubricant(id);
  const snap = await getDoc(doc(getDb(), COLLECTIONS.lubricants, id));
  return snap.exists() ? mapLubricant(snap.id, snap.data()) : null;
}

export async function createLubricant(
  input: Omit<Lubricant, 'id' | 'currentStock'>,
): Promise<string> {
  if (LOCAL_DEMO) return demoCreateLubricant(input);
  const ref = await addDoc(collection(getDb(), COLLECTIONS.lubricants), {
    ...input,
    currentStock: 0,
  });
  return ref.id;
}

export async function updateLubricant(
  id: string,
  patch: Partial<Omit<Lubricant, 'id'>>,
): Promise<void> {
  if (LOCAL_DEMO) return demoUpdateLubricant(id, patch);
  await updateDoc(doc(getDb(), COLLECTIONS.lubricants, id), patch);
}

// ── stock entries (inward) ────────────────────────────────────────────────────

export async function addLubricantStock(input: {
  lubricantId: string;
  pumpDayIso: string;
  quantity: number;
  purchasePricePerUnit: number;
  supplier?: string;
  invoiceNo?: string;
  notes?: string;
  recordedBy?: string;
}): Promise<string> {
  if (LOCAL_DEMO) return demoAddLubricantStock(input);
  const db = getDb();
  const ref = await addDoc(collection(db, COLLECTIONS.lubricantStockEntries), {
    ...input,
    recordedAt: Timestamp.now(),
  });
  const lubDoc = await getDoc(doc(db, COLLECTIONS.lubricants, input.lubricantId));
  if (lubDoc.exists()) {
    const cur = Number(lubDoc.data().currentStock ?? 0);
    await updateDoc(doc(db, COLLECTIONS.lubricants, input.lubricantId), {
      currentStock: cur + input.quantity,
    });
  }
  return ref.id;
}

export async function listLubricantStockEntries(lubricantId?: string): Promise<LubricantStockEntry[]> {
  if (LOCAL_DEMO) return demoListLubricantStock(lubricantId);
  const ref = collection(getDb(), COLLECTIONS.lubricantStockEntries);
  const qy = lubricantId
    ? query(ref, where('lubricantId', '==', lubricantId), orderBy('recordedAt', 'desc'))
    : query(ref, orderBy('recordedAt', 'desc'));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapStockEntry(d.id, d.data()));
}

// ── sales ─────────────────────────────────────────────────────────────────────

export async function addLubricantSale(input: {
  lubricantId: string;
  pumpDayIso: string;
  quantity: number;
  sellingPricePerUnit: number;
  customerName?: string;
  vehicleNumber?: string;
  notes?: string;
  recordedBy?: string;
}): Promise<string> {
  if (LOCAL_DEMO) return demoAddLubricantSale(input);
  const db = getDb();
  const totalAmount = Math.round(input.quantity * input.sellingPricePerUnit * 100) / 100;
  const ref = await addDoc(collection(db, COLLECTIONS.lubricantSales), {
    ...input,
    totalAmount,
    recordedAt: Timestamp.now(),
  });
  const lubDoc = await getDoc(doc(db, COLLECTIONS.lubricants, input.lubricantId));
  if (lubDoc.exists()) {
    const cur = Number(lubDoc.data().currentStock ?? 0);
    await updateDoc(doc(db, COLLECTIONS.lubricants, input.lubricantId), {
      currentStock: Math.max(0, cur - input.quantity),
    });
  }
  return ref.id;
}

export async function listLubricantSales(
  fromIso?: string,
  toIso?: string,
): Promise<LubricantSale[]> {
  if (LOCAL_DEMO) return demoListLubricantSales(fromIso, toIso);
  const ref = collection(getDb(), COLLECTIONS.lubricantSales);
  let qy = query(ref, orderBy('recordedAt', 'desc'));
  if (fromIso) {
    qy = query(ref, where('pumpDayIso', '>=', fromIso), orderBy('pumpDayIso', 'desc'));
  }
  if (fromIso && toIso) {
    qy = query(
      ref,
      where('pumpDayIso', '>=', fromIso),
      where('pumpDayIso', '<=', toIso),
      orderBy('pumpDayIso', 'desc'),
    );
  }
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapSale(d.id, d.data()));
}
