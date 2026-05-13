import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { CreditCustomer } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import {
  demoCreateCustomer,
  demoGetCustomer,
  demoListCreditCustomers,
  demoRecomputeAllBalancesFromLedger,
  demoUpdateCustomer,
} from '@/localDemo/demoBackend';

function mapCustomer(id: string, data: DocumentData): CreditCustomer {
  return {
    id,
    name: String(data.name ?? ''),
    contactPerson: data.contactPerson ? String(data.contactPerson) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    vehicleNumber: data.vehicleNumber ? String(data.vehicleNumber) : undefined,
    isActive: data.isActive !== false,
    currentBalance: Number(data.currentBalance ?? 0),
  };
}

export async function getCustomer(id: string): Promise<CreditCustomer | null> {
  if (LOCAL_DEMO) {
    return demoGetCustomer(id);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.creditCustomers, id));
  if (!snap.exists()) {
    return null;
  }
  return mapCustomer(snap.id, snap.data());
}

export async function listCreditCustomers(includeInactive: boolean): Promise<CreditCustomer[]> {
  if (LOCAL_DEMO) {
    return demoListCreditCustomers(includeInactive);
  }
  const ref = collection(getDb(), COLLECTIONS.creditCustomers);
  const snap = await getDocs(ref);
  return snap.docs
    .map((d) => mapCustomer(d.id, d.data()))
    .filter((c) => includeInactive || c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Recompute from all sales/payments. */
export async function recomputeAllBalancesFromLedger(): Promise<void> {
  if (LOCAL_DEMO) {
    return demoRecomputeAllBalancesFromLedger();
  }
  const [sales, payments] = await Promise.all([listAllCreditSales(), listAllCreditPayments()]);
  const byC = new Map<string, { sales: number; pay: number }>();
  for (const s of sales) {
    const b = byC.get(s.customerId) ?? { sales: 0, pay: 0 };
    b.sales += s.amount;
    byC.set(s.customerId, b);
  }
  for (const p of payments) {
    const b = byC.get(p.customerId) ?? { sales: 0, pay: 0 };
    b.pay += p.amountReceived;
    byC.set(p.customerId, b);
  }
  const all = await getDocs(collection(getDb(), COLLECTIONS.creditCustomers));
  for (const d of all.docs) {
    const t = byC.get(d.id) ?? { sales: 0, pay: 0 };
    const bal = t.sales - t.pay;
    await updateDoc(d.ref, { currentBalance: bal });
  }
}

export async function createCustomer(
  input: Omit<CreditCustomer, 'id' | 'currentBalance'>,
): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateCustomer(input);
  }
  const ref = await addDoc(collection(getDb(), COLLECTIONS.creditCustomers), {
    name: input.name,
    contactPerson: input.contactPerson ?? null,
    phone: input.phone ?? null,
    vehicleNumber: input.vehicleNumber ?? null,
    isActive: input.isActive,
    currentBalance: 0,
  });
  return ref.id;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<CreditCustomer, 'name' | 'contactPerson' | 'phone' | 'vehicleNumber' | 'isActive'>>,
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateCustomer(id, patch);
  }
  const r = doc(getDb(), COLLECTIONS.creditCustomers, id);
  const clean: Record<string, unknown> = {};
  if (patch.name != null) {
    clean.name = patch.name;
  }
  if (patch.contactPerson !== undefined) {
    clean.contactPerson = patch.contactPerson ?? null;
  }
  if (patch.phone !== undefined) {
    clean.phone = patch.phone ?? null;
  }
  if (patch.vehicleNumber !== undefined) {
    clean.vehicleNumber = patch.vehicleNumber ?? null;
  }
  if (patch.isActive != null) {
    clean.isActive = patch.isActive;
  }
  if (Object.keys(clean).length) {
    await updateDoc(r, clean);
  }
}
