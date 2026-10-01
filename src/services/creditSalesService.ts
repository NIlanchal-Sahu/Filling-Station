import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { CreditSale, ReconciliationCreditLine } from '@/types/entities';
import { AppTimestamp } from '@/types/time';
import {
  demoCreateCreditSalesForReconciliation,
  demoCreateManualCreditSale,
  demoDeleteCreditSale,
  demoListAllCreditSales,
  demoListSalesForCustomer,
  demoReplaceCreditSalesForShift,
  demoUpdateCreditSale,
} from '@/localDemo/demoBackend';
import { getShift, shiftPumpDayIso } from '@/services/shiftsService';

/** Sentinel shift id for credit lines posted from customer detail (not tied to shift recon). */
export const MANAGER_CREDIT_SHIFT_ID = '__mgr_credit__';

type SaleRow = {
  id: string;
  customer_id: string | null;
  shift_id: string | null;
  date: string | null;
  amount: number | null;
  fuel_type_id: string | null;
  liters: number | null;
  rate_at_sale: number | null;
  reference: string | null;
};

function roundMoney2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function localNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

async function creditSaleDateForShift(shiftId: string): Promise<Date> {
  const shift = await getShift(shiftId);
  if (!shift) {
    return new Date();
  }
  return localNoon(shiftPumpDayIso(shift));
}

async function applyShiftPumpDayDates(sales: CreditSale[]): Promise<CreditSale[]> {
  const ids = [
    ...new Set(
      sales
        .map((s) => s.shiftId)
        .filter((id) => id && id !== MANAGER_CREDIT_SHIFT_ID),
    ),
  ];
  if (ids.length === 0) {
    return sales;
  }
  const shifts = await Promise.all(ids.map((id) => getShift(id)));
  const byId = new Map(ids.map((id, i) => [id, shifts[i]]));
  return sales.map((s) => {
    const sh = byId.get(s.shiftId);
    if (!sh) {
      return s;
    }
    return { ...s, date: AppTimestamp.fromDate(localNoon(shiftPumpDayIso(sh))) };
  });
}

function mapCreditSale(row: SaleRow): CreditSale {
  return {
    id: row.id,
    customerId: String(row.customer_id ?? ''),
    shiftId: String(row.shift_id ?? ''),
    date: AppTimestamp.fromDate(row.date ? new Date(row.date) : new Date(0)),
    amount: Number(row.amount ?? 0),
    fuelTypeId: row.fuel_type_id ? String(row.fuel_type_id) : undefined,
    liters: row.liters != null ? Number(row.liters) : undefined,
    rateAtSale: row.rate_at_sale != null ? Number(row.rate_at_sale) : undefined,
    reference: row.reference ? String(row.reference) : undefined,
  };
}

export async function replaceCreditSalesForShift(
  shiftId: string,
  lines: ReconciliationCreditLine[],
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoReplaceCreditSalesForShift(shiftId, lines);
  }
  const saleDate = await creditSaleDateForShift(shiftId);
  const { error } = await getSupabase().rpc('replace_shift_credit_sales', {
    p_shift_id: shiftId,
    p_lines: lines,
    p_sale_date: saleDate.toISOString(),
  });
  throwIfError(error, 'Replace shift credit sales');
}

export async function createCreditSalesForReconciliation(
  _reconciliationId: string,
  shiftId: string,
  lines: ReconciliationCreditLine[],
): Promise<void> {
  if (LOCAL_DEMO) {
    return demoCreateCreditSalesForReconciliation(_reconciliationId, shiftId, lines);
  }
  const saleDate = (await creditSaleDateForShift(shiftId)).toISOString();
  const rows = lines
    .filter((line) => line.amount > 0)
    .map((line) => ({
      id: newId(),
      customer_id: line.customerId,
      shift_id: shiftId,
      date: saleDate,
      amount: roundMoney2(line.amount),
      fuel_type_id: line.fuelTypeId ?? null,
      liters: line.liters != null && Number.isFinite(line.liters) ? line.liters : null,
      rate_at_sale:
        line.rateAtSale != null && Number.isFinite(line.rateAtSale) ? roundMoney2(line.rateAtSale) : null,
      reference: `SHIFT_RECON:${shiftId}`,
    }));
  if (rows.length > 0) {
    const { error } = await getSupabase().from('credit_sales').insert(rows);
    throwIfError(error, 'Create reconciliation credit sales');
  }
  for (const line of lines) {
    if (line.amount > 0) {
      await bumpCustomerBalance(line.customerId, line.amount);
    }
  }
}

async function bumpCustomerBalance(customerId: string, deltaCredit: number): Promise<void> {
  const { data, error } = await getSupabase()
    .from('credit_customers')
    .select('current_balance')
    .eq('id', customerId)
    .maybeSingle();
  throwIfError(error, 'Load credit customer');
  if (!data) {
    return;
  }
  const cur = Number(data.current_balance ?? 0);
  const { error: updateError } = await getSupabase()
    .from('credit_customers')
    .update({ current_balance: cur + deltaCredit })
    .eq('id', customerId);
  throwIfError(updateError, 'Update credit balance');
}

/** Manager-only: log credit sale like a cashbook line (fuel, liters × rate → amount). */
export async function createManualCreditSale(input: {
  customerId: string;
  date: Date;
  fuelTypeId: string;
  liters: number;
  rateAtSale: number;
}): Promise<string> {
  const amount = roundMoney2(input.liters * input.rateAtSale);
  if (amount <= 0 || input.liters <= 0 || input.rateAtSale < 0) {
    throw new Error('Liters and rate must produce a positive amount.');
  }

  if (LOCAL_DEMO) {
    return demoCreateManualCreditSale({
      customerId: input.customerId,
      date: input.date,
      fuelTypeId: input.fuelTypeId,
      liters: input.liters,
      rateAtSale: roundMoney2(input.rateAtSale),
      amount,
    });
  }

  const id = newId();
  const { error } = await getSupabase().from('credit_sales').insert({
    id,
    customer_id: input.customerId,
    shift_id: MANAGER_CREDIT_SHIFT_ID,
    date: input.date.toISOString(),
    amount,
    fuel_type_id: input.fuelTypeId,
    liters: input.liters,
    rate_at_sale: roundMoney2(input.rateAtSale),
    reference: 'MANAGER_ENTRY',
  });
  throwIfError(error, 'Create credit sale');
  await bumpCustomerBalance(input.customerId, amount);
  return id;
}

export async function deleteCreditSale(id: string): Promise<void> {
  if (LOCAL_DEMO) {
    return demoDeleteCreditSale(id);
  }
  const { data, error } = await getSupabase().from('credit_sales').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load credit sale');
  if (!data) {
    throw new Error('Credit sale not found.');
  }
  const row = data as SaleRow;
  const customerId = String(row.customer_id ?? '');
  const amount = Number(row.amount ?? 0);
  const { error: deleteError } = await getSupabase().from('credit_sales').delete().eq('id', id);
  throwIfError(deleteError, 'Delete credit sale');
  if (customerId && amount) {
    await bumpCustomerBalance(customerId, -amount);
  }
}

export async function updateCreditSale(
  id: string,
  input: {
    customerId: string;
    date: Date;
    fuelTypeId: string;
    liters: number;
    rateAtSale: number;
  },
): Promise<void> {
  const amount = roundMoney2(input.liters * input.rateAtSale);
  if (amount <= 0 || input.liters <= 0 || input.rateAtSale < 0) {
    throw new Error('Liters and rate must produce a positive amount.');
  }
  if (LOCAL_DEMO) {
    return demoUpdateCreditSale(id, { ...input, amount });
  }
  const { data, error } = await getSupabase().from('credit_sales').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load credit sale');
  if (!data) {
    throw new Error('Credit sale not found.');
  }
  const prev = data as SaleRow;
  const prevCustomer = String(prev.customer_id ?? '');
  const prevAmount = Number(prev.amount ?? 0);
  const shiftId = String(prev.shift_id ?? '');
  const shiftLockedDate = Boolean(shiftId && shiftId !== MANAGER_CREDIT_SHIFT_ID);
  const patch: Record<string, unknown> = {
    customer_id: input.customerId,
    amount,
    fuel_type_id: input.fuelTypeId,
    liters: input.liters,
    rate_at_sale: roundMoney2(input.rateAtSale),
  };
  if (!shiftLockedDate) {
    patch.date = input.date.toISOString();
  }
  const { error: updateError } = await getSupabase().from('credit_sales').update(patch).eq('id', id);
  throwIfError(updateError, 'Update credit sale');
  if (prevCustomer === input.customerId) {
    const delta = amount - prevAmount;
    if (delta !== 0 && prevCustomer) {
      await bumpCustomerBalance(prevCustomer, delta);
    }
  } else {
    if (prevCustomer && prevAmount) {
      await bumpCustomerBalance(prevCustomer, -prevAmount);
    }
    await bumpCustomerBalance(input.customerId, amount);
  }
}

export async function listSalesForCustomer(customerId: string): Promise<CreditSale[]> {
  if (LOCAL_DEMO) {
    return applyShiftPumpDayDates(await demoListSalesForCustomer(customerId));
  }
  const { data, error } = await getSupabase()
    .from('credit_sales')
    .select('*')
    .eq('customer_id', customerId);
  throwIfError(error, 'List credit sales');
  const sales = ((data ?? []) as SaleRow[])
    .map(mapCreditSale)
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
  return applyShiftPumpDayDates(sales);
}

export async function listAllCreditSales(): Promise<CreditSale[]> {
  if (LOCAL_DEMO) {
    return applyShiftPumpDayDates(await demoListAllCreditSales());
  }
  const { data, error } = await getSupabase().from('credit_sales').select('*');
  throwIfError(error, 'List credit sales');
  return applyShiftPumpDayDates(((data ?? []) as SaleRow[]).map(mapCreditSale));
}
