import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, type DocumentData } from 'firebase/firestore';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { LedgerEntry, LedgerPaymentChannel, LedgerType } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoCreateLedgerEntry,
  demoDeleteLedgerEntry,
  demoListAllLedgerForBalance,
  demoListExpensesInRange,
  demoListLedgerInRange,
  demoUpdateLedgerEntry,
} from '@/localDemo/demoBackend';

function parsePaymentChannel(data: DocumentData): LedgerPaymentChannel | undefined {
  const v = data.paymentChannel ?? data.paymentMode;
  if (v === 'bank' || v === 'cash' || v === 'upi') {
    return v;
  }
  return undefined;
}

function mapLedger(id: string, data: DocumentData): LedgerEntry {
  return {
    id,
    date: data.date,
    type: (data.type as LedgerType) ?? 'expense',
    paymentChannel: parsePaymentChannel(data),
    paidToOrReceivedFrom: String(data.paidToOrReceivedFrom ?? ''),
    particulars: String(data.particulars ?? ''),
    category: String(data.category ?? ''),
    amount: Number(data.amount ?? 0),
    relatedCreditPaymentId: data.relatedCreditPaymentId
      ? String(data.relatedCreditPaymentId)
      : undefined,
    relatedLoanId: data.relatedLoanId ? String(data.relatedLoanId) : undefined,
    relatedLoanRepaymentId: data.relatedLoanRepaymentId
      ? String(data.relatedLoanRepaymentId)
      : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: data.createdAt,
  };
}

export async function createLedgerEntry(input: {
  date: Date;
  type: LedgerType;
  paymentChannel?: LedgerPaymentChannel;
  paidToOrReceivedFrom: string;
  particulars: string;
  category: string;
  amount: number;
  relatedCreditPaymentId?: string;
  relatedLoanId?: string;
  relatedLoanRepaymentId?: string;
  createdBy: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateLedgerEntry(input);
  }
  const ref = await addDoc(collection(getDb(), COLLECTIONS.ledgerEntries), {
    date: Timestamp.fromDate(input.date),
    type: input.type,
    paymentChannel: input.paymentChannel ?? null,
    paidToOrReceivedFrom: input.paidToOrReceivedFrom,
    particulars: input.particulars,
    category: input.category,
    amount: input.amount,
    relatedCreditPaymentId: input.relatedCreditPaymentId ?? null,
    relatedLoanId: input.relatedLoanId ?? null,
    relatedLoanRepaymentId: input.relatedLoanRepaymentId ?? null,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  if (LOCAL_DEMO) {
    await demoDeleteLedgerEntry(id);
    return;
  }
  await deleteDoc(doc(getDb(), COLLECTIONS.ledgerEntries, id));
}

/** Update line fields; preserves `relatedCreditPaymentId`, `createdBy`, `createdAt` on the server. */
export async function updateLedgerEntry(
  id: string,
  input: {
    date: Date;
    type: LedgerType;
    paymentChannel: LedgerPaymentChannel;
    paidToOrReceivedFrom: string;
    particulars: string;
    category: string;
    amount: number;
  },
): Promise<void> {
  if (LOCAL_DEMO) {
    await demoUpdateLedgerEntry(id, input);
    return;
  }
  await updateDoc(doc(getDb(), COLLECTIONS.ledgerEntries, id), {
    date: Timestamp.fromDate(input.date),
    type: input.type,
    paymentChannel: input.paymentChannel,
    paidToOrReceivedFrom: input.paidToOrReceivedFrom,
    particulars: input.particulars,
    category: input.category,
    amount: input.amount,
  });
}

export async function listLedgerInRange(
  from: Date,
  to: Date,
  typeFilter?: LedgerType,
): Promise<LedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListLedgerInRange(from, to, typeFilter);
  }
  const ref = collection(getDb(), COLLECTIONS.ledgerEntries);
  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);
  const qy = query(ref, where('date', '>=', fromTs), where('date', '<=', toTs));
  const snap = await getDocs(qy);
  let rows = snap.docs.map((d) => mapLedger(d.id, d.data()));
  if (typeFilter) {
    rows = rows.filter((e) => e.type === typeFilter);
  }
  return rows.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

export async function listExpensesInRange(
  from: Date,
  to: Date,
  category?: string,
): Promise<LedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListExpensesInRange(from, to, category);
  }
  const all = await listLedgerInRange(from, to, 'expense');
  if (category) {
    return all.filter((e) => e.category === category);
  }
  return all;
}

export async function listAllLedgerForBalance(): Promise<LedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListAllLedgerForBalance();
  }
  const ref = collection(getDb(), COLLECTIONS.ledgerEntries);
  const snap = await getDocs(ref);
  return snap.docs
    .map((d) => mapLedger(d.id, d.data()))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}
