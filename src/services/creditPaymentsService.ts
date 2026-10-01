import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { CreditPayment, CreditPaymentMode, LedgerType } from '@/types/entities';
import {
  creditPaymentModeLabel,
  creditPaymentModeLedgerChannel,
  normalizeCreditPaymentMode,
} from '@/types/entities';
import { asTimestamp } from '@/types/time';
import { createLedgerEntry } from '@/services/ledgerService';
import {
  demoListAllCreditPayments,
  demoListPaymentsForCustomer,
  demoListPaymentsInRange,
  demoRecordPayment,
} from '@/localDemo/demoBackend';

type PaymentRow = {
  id: string;
  customer_id: string | null;
  date: string | null;
  amount_received: number | null;
  mode: string | null;
  notes: string | null;
};

function mapPayment(row: PaymentRow): CreditPayment {
  return {
    id: row.id,
    customerId: String(row.customer_id ?? ''),
    date: asTimestamp(row.date),
    amountReceived: Number(row.amount_received ?? 0),
    mode: normalizeCreditPaymentMode(row.mode),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export async function listPaymentsForCustomer(customerId: string): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListPaymentsForCustomer(customerId);
  }
  const { data, error } = await getSupabase()
    .from('credit_payments')
    .select('*')
    .eq('customer_id', customerId);
  throwIfError(error, 'List credit payments');
  return ((data ?? []) as PaymentRow[])
    .map(mapPayment)
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

export async function listAllCreditPayments(): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListAllCreditPayments();
  }
  const { data, error } = await getSupabase().from('credit_payments').select('*');
  throwIfError(error, 'List credit payments');
  return ((data ?? []) as PaymentRow[]).map(mapPayment);
}

export async function listPaymentsInRange(from: Date, to: Date): Promise<CreditPayment[]> {
  if (LOCAL_DEMO) {
    return demoListPaymentsInRange(from, to);
  }
  const { data, error } = await getSupabase()
    .from('credit_payments')
    .select('*')
    .gte('date', from.toISOString())
    .lte('date', to.toISOString());
  throwIfError(error, 'List credit payments');
  return ((data ?? []) as PaymentRow[])
    .map(mapPayment)
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
  const id = newId();
  const { error } = await getSupabase().from('credit_payments').insert({
    id,
    customer_id: input.customerId,
    date: input.date.toISOString(),
    amount_received: input.amountReceived,
    mode: input.mode,
    notes: input.notes ?? null,
  });
  throwIfError(error, 'Record credit payment');

  const { data: customer, error: customerError } = await getSupabase()
    .from('credit_customers')
    .select('current_balance')
    .eq('id', input.customerId)
    .maybeSingle();
  throwIfError(customerError, 'Load credit customer');
  if (customer) {
    const cur = Number(customer.current_balance ?? 0);
    const { error: updateError } = await getSupabase()
      .from('credit_customers')
      .update({ current_balance: cur - input.amountReceived })
      .eq('id', input.customerId);
    throwIfError(updateError, 'Update credit balance');
  }
  await createLedgerEntry({
    date: input.date,
    type: 'income' as LedgerType,
    paymentChannel: creditPaymentModeLedgerChannel(input.mode),
    paidToOrReceivedFrom: `Due received: ${input.customerName}`,
    particulars: `Due Received from ${input.customerName} (${creditPaymentModeLabel(input.mode)})`,
    category: 'SALES',
    amount: input.amountReceived,
    relatedCreditPaymentId: id,
    createdBy: input.createdBy,
  });
  return id;
}
