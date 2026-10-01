import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { CreditCustomer } from '@/types/entities';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import {
  demoCreateCustomer,
  demoGetCustomer,
  demoListCreditCustomers,
  demoRecomputeAllBalancesFromLedger,
  demoUpdateCustomer,
} from '@/localDemo/demoBackend';

type CustomerRow = {
  id: string;
  name: string | null;
  contact_person: string | null;
  phone: string | null;
  vehicle_number: string | null;
  is_active: boolean | null;
  current_balance: number | null;
};

function mapCustomer(row: CustomerRow): CreditCustomer {
  return {
    id: row.id,
    name: String(row.name ?? ''),
    contactPerson: row.contact_person ? String(row.contact_person) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    vehicleNumber: row.vehicle_number ? String(row.vehicle_number) : undefined,
    isActive: row.is_active !== false,
    currentBalance: Number(row.current_balance ?? 0),
  };
}

export async function getCustomer(id: string): Promise<CreditCustomer | null> {
  if (LOCAL_DEMO) {
    return demoGetCustomer(id);
  }
  const { data, error } = await getSupabase()
    .from('credit_customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Load credit customer');
  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function listCreditCustomers(includeInactive: boolean): Promise<CreditCustomer[]> {
  if (LOCAL_DEMO) {
    return demoListCreditCustomers(includeInactive);
  }
  let query = getSupabase().from('credit_customers').select('*');
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  throwIfError(error, 'List credit customers');
  return ((data ?? []) as CustomerRow[])
    .map(mapCustomer)
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
  const { data, error } = await getSupabase().from('credit_customers').select('id');
  throwIfError(error, 'List credit customers');
  for (const row of data ?? []) {
    const t = byC.get(row.id) ?? { sales: 0, pay: 0 };
    const bal = t.sales - t.pay;
    const { error: updateError } = await getSupabase()
      .from('credit_customers')
      .update({ current_balance: bal })
      .eq('id', row.id);
    throwIfError(updateError, 'Update credit balance');
  }
}

export async function createCustomer(
  input: Omit<CreditCustomer, 'id' | 'currentBalance'>,
): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateCustomer(input);
  }
  const id = newId();
  const { error } = await getSupabase().from('credit_customers').insert({
    id,
    name: input.name,
    contact_person: input.contactPerson ?? null,
    phone: input.phone ?? null,
    vehicle_number: input.vehicleNumber ?? null,
    is_active: input.isActive,
    current_balance: 0,
  });
  throwIfError(error, 'Create credit customer');
  return id;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<CreditCustomer, 'name' | 'contactPerson' | 'phone' | 'vehicleNumber' | 'isActive'>>,
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateCustomer(id, patch);
  }
  const clean: Record<string, unknown> = {};
  if (patch.name != null) {
    clean.name = patch.name;
  }
  if (patch.contactPerson !== undefined) {
    clean.contact_person = patch.contactPerson ?? null;
  }
  if (patch.phone !== undefined) {
    clean.phone = patch.phone ?? null;
  }
  if (patch.vehicleNumber !== undefined) {
    clean.vehicle_number = patch.vehicleNumber ?? null;
  }
  if (patch.isActive != null) {
    clean.is_active = patch.isActive;
  }
  if (Object.keys(clean).length) {
    const { error } = await getSupabase().from('credit_customers').update(clean).eq('id', id);
    throwIfError(error, 'Update credit customer');
  }
}
