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
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { CreditPayment, CreditPaymentMode, LedgerType } from '@/types/entities';
import {
  creditPaymentModeLabel,
  creditPaymentModeLedgerChannel,
  normalizeCreditPaymentMode,
} from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import { createLedgerEntry } from '@/services/ledgerService';
import {
  demoListAllCreditPayments,
  demoListPaymentsForCustomer,
  demoListPaymentsInRange,
  demoRecordPayment,
} from '@/localDemo/demoBackend';

function mapPayment(id: string, data: DocumentData): CreditPayment {
  return {
    id,
    customerId: String(data.customerId ?? ''),
    date: data.date,
    amountReceived: Number(data.amountReceived ?? 0),
    mode: normalizeCreditPaymentMode(data.mode),
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function listPaymentsForCustomer(customerId: string): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListPaymentsForCustomer(customerId);
  }
  const ref = collection(getDb(), COLLECTIONS.creditPayments);
  const qy = query(ref, where('customerId', '==', customerId));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapPayment(d.id, d.data()))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

export async function listAllCreditPayments(): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListAllCreditPayments();
  }
  const snap = await getDocs(collection(getDb(), COLLECTIONS.creditPayments));
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}

export async function listPaymentsInRange(from: Date, to: Date): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListPaymentsInRange(from, to);
  }
  const ref = collection(getDb(), COLLECTIONS.creditPayments);
  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);
  const qy = query(ref, where('date', '>=', fromTs), where('date', '<=', toTs));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapPayment(d.id, d.data()))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

export async function recordPayment(input: {
  customerId: string;
  amountReceived: number;
  date: Date;
  mode: CreditPaymentMode;
  notes?: string;
  customerName: string;
  createdBy: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    return demoRecordPayment(input);
  }
  const payRef = await addDoc(collection(getDb(), COLLECTIONS.creditPayments), {
    customerId: input.customerId,
    date: Timestamp.fromDate(input.date),
    amountReceived: input.amountReceived,
    mode: input.mode,
    notes: input.notes ?? null,
  });
  const cust = doc(getDb(), COLLECTIONS.creditCustomers, input.customerId);
  const cSnap = await getDoc(cust);
  if (cSnap.exists()) {
    const cur = Number(cSnap.data()?.currentBalance ?? 0);
    await updateDoc(cust, { currentBalance: cur - input.amountReceived });
  }
  await createLedgerEntry({
    date: input.date,
    type: 'income' as LedgerType,
    paymentChannel: creditPaymentModeLedgerChannel(input.mode),
    paidToOrReceivedFrom: `Due received: ${input.customerName}`,
    particulars: `Due Received from ${input.customerName} (${creditPaymentModeLabel(input.mode)})`,
    category: 'SALES',
    amount: input.amountReceived,
    relatedCreditPaymentId: payRef.id,
    createdBy: input.createdBy,
  });
  return payRef.id;
}
