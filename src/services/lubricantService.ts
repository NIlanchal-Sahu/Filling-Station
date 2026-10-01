import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { Lubricant, LubricantSale, LubricantStockEntry } from '@/types/entities';
import { asTimestamp } from '@/types/time';
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

type LubricantRow = {
  id: string;
  name: string | null;
  brand: string | null;
  grade: string | null;
  unit: string | null;
  selling_price: number | null;
  purchase_price: number | null;
  current_stock: number | null;
  min_stock_alert: number | null;
  is_active: boolean | null;
};

type StockRow = {
  id: string;
  lubricant_id: string | null;
  pump_day_iso: string | null;
  quantity: number | null;
  purchase_price_per_unit: number | null;
  supplier: string | null;
  invoice_no: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
};

type SaleRow = {
  id: string;
  lubricant_id: string | null;
  pump_day_iso: string | null;
  quantity: number | null;
  selling_price_per_unit: number | null;
  total_amount: number | null;
  customer_name: string | null;
  vehicle_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
};

function mapLubricant(row: LubricantRow): Lubricant {
  return {
    id: row.id,
    name: String(row.name ?? ''),
    brand: String(row.brand ?? ''),
    grade: String(row.grade ?? ''),
    unit: String(row.unit ?? 'litre'),
    sellingPrice: Number(row.selling_price ?? 0),
    purchasePrice: Number(row.purchase_price ?? 0),
    currentStock: Number(row.current_stock ?? 0),
    minStockAlert: Number(row.min_stock_alert ?? 0),
    isActive: row.is_active !== false,
  };
}

function mapStockEntry(row: StockRow): LubricantStockEntry {
  return {
    id: row.id,
    lubricantId: String(row.lubricant_id ?? ''),
    pumpDayIso: String(row.pump_day_iso ?? ''),
    quantity: Number(row.quantity ?? 0),
    purchasePricePerUnit: Number(row.purchase_price_per_unit ?? 0),
    supplier: row.supplier ?? undefined,
    invoiceNo: row.invoice_no ?? undefined,
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    recordedAt: asTimestamp(row.recorded_at),
  };
}

function mapSale(row: SaleRow): LubricantSale {
  return {
    id: row.id,
    lubricantId: String(row.lubricant_id ?? ''),
    pumpDayIso: String(row.pump_day_iso ?? ''),
    quantity: Number(row.quantity ?? 0),
    sellingPricePerUnit: Number(row.selling_price_per_unit ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    customerName: row.customer_name ?? undefined,
    vehicleNumber: row.vehicle_number ?? undefined,
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    recordedAt: asTimestamp(row.recorded_at),
  };
}

export async function listLubricants(activeOnly = true): Promise<Lubricant[]> {
  if (LOCAL_DEMO) return demoListLubricants(activeOnly);
  let query = getSupabase().from('lubricants').select('*');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  throwIfError(error, 'List lubricants');
  return ((data ?? []) as LubricantRow[])
    .map(mapLubricant)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLubricant(id: string): Promise<Lubricant | null> {
  if (LOCAL_DEMO) return demoGetLubricant(id);
  const { data, error } = await getSupabase().from('lubricants').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Load lubricant');
  return data ? mapLubricant(data as LubricantRow) : null;
}

export async function createLubricant(
  input: Omit<Lubricant, 'id' | 'currentStock'>,
): Promise<string> {
  if (LOCAL_DEMO) return demoCreateLubricant(input);
  const id = newId();
  const { error } = await getSupabase().from('lubricants').insert({
    id,
    name: input.name,
    brand: input.brand,
    grade: input.grade,
    unit: input.unit,
    selling_price: input.sellingPrice,
    purchase_price: input.purchasePrice,
    current_stock: 0,
    min_stock_alert: input.minStockAlert,
    is_active: input.isActive,
  });
  throwIfError(error, 'Create lubricant');
  return id;
}

export async function updateLubricant(
  id: string,
  patch: Partial<Omit<Lubricant, 'id'>>,
): Promise<void> {
  if (LOCAL_DEMO) return demoUpdateLubricant(id, patch);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.grade !== undefined) row.grade = patch.grade;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.sellingPrice !== undefined) row.selling_price = patch.sellingPrice;
  if (patch.purchasePrice !== undefined) row.purchase_price = patch.purchasePrice;
  if (patch.currentStock !== undefined) row.current_stock = patch.currentStock;
  if (patch.minStockAlert !== undefined) row.min_stock_alert = patch.minStockAlert;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (Object.keys(row).length === 0) return;
  const { error } = await getSupabase().from('lubricants').update(row).eq('id', id);
  throwIfError(error, 'Update lubricant');
}

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
  const id = newId();
  const { error } = await getSupabase().from('lubricant_stock_entries').insert({
    id,
    lubricant_id: input.lubricantId,
    pump_day_iso: input.pumpDayIso,
    quantity: input.quantity,
    purchase_price_per_unit: input.purchasePricePerUnit,
    supplier: input.supplier ?? null,
    invoice_no: input.invoiceNo ?? null,
    notes: input.notes ?? null,
    recorded_by: input.recordedBy ?? null,
    recorded_at: new Date().toISOString(),
  });
  throwIfError(error, 'Add lubricant stock');
  const { data, error: loadError } = await getSupabase()
    .from('lubricants')
    .select('current_stock')
    .eq('id', input.lubricantId)
    .maybeSingle();
  throwIfError(loadError, 'Load lubricant');
  if (data) {
    const cur = Number(data.current_stock ?? 0);
    const { error: updateError } = await getSupabase()
      .from('lubricants')
      .update({ current_stock: cur + input.quantity })
      .eq('id', input.lubricantId);
    throwIfError(updateError, 'Update lubricant stock');
  }
  return id;
}

export async function listLubricantStockEntries(lubricantId?: string): Promise<LubricantStockEntry[]> {
  if (LOCAL_DEMO) return demoListLubricantStock(lubricantId);
  let query = getSupabase().from('lubricant_stock_entries').select('*').order('recorded_at', { ascending: false });
  if (lubricantId) {
    query = query.eq('lubricant_id', lubricantId);
  }
  const { data, error } = await query;
  throwIfError(error, 'List lubricant stock');
  return ((data ?? []) as StockRow[]).map(mapStockEntry);
}

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
  const totalAmount = Math.round(input.quantity * input.sellingPricePerUnit * 100) / 100;
  const id = newId();
  const { error } = await getSupabase().from('lubricant_sales').insert({
    id,
    lubricant_id: input.lubricantId,
    pump_day_iso: input.pumpDayIso,
    quantity: input.quantity,
    selling_price_per_unit: input.sellingPricePerUnit,
    total_amount: totalAmount,
    customer_name: input.customerName ?? null,
    vehicle_number: input.vehicleNumber ?? null,
    notes: input.notes ?? null,
    recorded_by: input.recordedBy ?? null,
    recorded_at: new Date().toISOString(),
  });
  throwIfError(error, 'Add lubricant sale');
  const { data, error: loadError } = await getSupabase()
    .from('lubricants')
    .select('current_stock')
    .eq('id', input.lubricantId)
    .maybeSingle();
  throwIfError(loadError, 'Load lubricant');
  if (data) {
    const cur = Number(data.current_stock ?? 0);
    const { error: updateError } = await getSupabase()
      .from('lubricants')
      .update({ current_stock: Math.max(0, cur - input.quantity) })
      .eq('id', input.lubricantId);
    throwIfError(updateError, 'Update lubricant stock');
  }
  return id;
}

export async function listLubricantSales(
  fromIso?: string,
  toIso?: string,
): Promise<LubricantSale[]> {
  if (LOCAL_DEMO) return demoListLubricantSales(fromIso, toIso);
  let query = getSupabase().from('lubricant_sales').select('*');
  if (fromIso && toIso) {
    query = query.gte('pump_day_iso', fromIso).lte('pump_day_iso', toIso).order('pump_day_iso', { ascending: false });
  } else if (fromIso) {
    query = query.gte('pump_day_iso', fromIso).order('pump_day_iso', { ascending: false });
  } else {
    query = query.order('recorded_at', { ascending: false });
  }
  const { data, error } = await query;
  throwIfError(error, 'List lubricant sales');
  return ((data ?? []) as SaleRow[]).map(mapSale);
}
