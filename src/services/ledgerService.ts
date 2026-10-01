import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { LedgerEntry, LedgerPaymentChannel, LedgerType } from '@/types/entities';
import { resolveLedgerPaymentChannel } from '@/types/entities';
import { asTimestamp } from '@/types/time';
import {
  demoCreateLedgerEntry,
  demoDeleteLedgerEntry,
  demoListAllLedgerForBalance,
  demoListExpensesInRange,
  demoListLedgerInRange,
  demoUpdateLedgerEntry,
} from '@/localDemo/demoBackend';

type LedgerRow = {
  id: string;
  date: string | null;
  type: string | null;
  payment_channel: string | null;
  paid_to_or_received_from: string | null;
  particulars: string | null;
  category: string | null;
  amount: number | null;
  related_credit_payment_id: string | null;
  related_loan_id: string | null;
  related_loan_repayment_id: string | null;
  created_by: string | null;
  created_at: string | null;
};

function mapLedger(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    date: asTimestamp(row.date),
    type: (row.type as LedgerType) ?? 'expense',
    paymentChannel: resolveLedgerPaymentChannel(row.payment_channel),
    paidToOrReceivedFrom: String(row.paid_to_or_received_from ?? ''),
    particulars: String(row.particulars ?? ''),
    category: String(row.category ?? ''),
    amount: Number(row.amount ?? 0),
    relatedCreditPaymentId: row.related_credit_payment_id
      ? String(row.related_credit_payment_id)
      : undefined,
    relatedLoanId: row.related_loan_id ? String(row.related_loan_id) : undefined,
    relatedLoanRepaymentId: row.related_loan_repayment_id
      ? String(row.related_loan_repayment_id)
      : undefined,
    createdBy: String(row.created_by ?? ''),
    createdAt: asTimestamp(row.created_at),
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
  const id = newId();
  const { error } = await getSupabase().from('ledger_entries').insert({
    id,
    date: input.date.toISOString(),
    type: input.type,
    payment_channel: input.paymentChannel ?? null,
    paid_to_or_received_from: input.paidToOrReceivedFrom,
    particulars: input.particulars,
    category: input.category,
    amount: input.amount,
    related_credit_payment_id: input.relatedCreditPaymentId ?? null,
    related_loan_id: input.relatedLoanId ?? null,
    related_loan_repayment_id: input.relatedLoanRepaymentId ?? null,
    created_by: input.createdBy,
    created_at: new Date().toISOString(),
  });
  throwIfError(error, 'Create ledger entry');
  return id;
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  if (LOCAL_DEMO) {
    await demoDeleteLedgerEntry(id);
    return;
  }
  const { error } = await getSupabase().from('ledger_entries').delete().eq('id', id);
  throwIfError(error, 'Delete ledger entry');
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
  const { error } = await getSupabase()
    .from('ledger_entries')
    .update({
      date: input.date.toISOString(),
      type: input.type,
      payment_channel: input.paymentChannel,
      paid_to_or_received_from: input.paidToOrReceivedFrom,
      particulars: input.particulars,
      category: input.category,
      amount: input.amount,
    })
    .eq('id', id);
  throwIfError(error, 'Update ledger entry');
}

export async function listLedgerInRange(
  from: Date,
  to: Date,
  typeFilter?: LedgerType,
): Promise<LedgerEntry[]> {
  if (LOCAL_DEMO) {
    return demoListLedgerInRange(from, to, typeFilter);
  }
  let query = getSupabase()
    .from('ledger_entries')
    .select('*')
    .gte('date', from.toISOString())
    .lte('date', to.toISOString());
  if (typeFilter) {
    query = query.eq('type', typeFilter);
  }
  const { data, error } = await query;
  throwIfError(error, 'List ledger');
  return ((data ?? []) as LedgerRow[])
    .map(mapLedger)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
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
  const { data, error } = await getSupabase().from('ledger_entries').select('*');
  throwIfError(error, 'List ledger');
  return ((data ?? []) as LedgerRow[])
    .map(mapLedger)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}
