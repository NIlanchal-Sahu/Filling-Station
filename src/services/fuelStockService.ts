import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoGetFuelStockOverview,
  demoListFuelTankDips,
  demoListFuelTankDipsInRange,
  demoRecordFuelTankDip,
  demoUpsertFuelTankDipForDay,
} from '@/localDemo/demoBackend';
import type { DipKind, FuelStockOverview, FuelTankDipReading, FuelType } from '@/types/entities';
import { buildFuelStockItem, notifyFuelStockUpdated, sortFuelStockItems } from '@/utils/fuelStockDisplay';
import { canonicalDipCm, dipCmFromLiters, litersFromDipCm } from '@/utils/fuelTankCalibration';
import { listFuelTypes, getFuelType } from '@/services/fuelTypesService';

function mapDip(id: string, data: DocumentData, fuelName = ''): FuelTankDipReading {
  const dipLiters = Number(data.dipLiters ?? 0);
  const dipCmRaw = data.dipCm;
  const dipCm =
    dipCmRaw != null ? canonicalDipCm(Number(dipCmRaw)) : (dipCmFromLiters(dipLiters, fuelName) ?? 0);
  const pumpDayIso =
    typeof data.pumpDayIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.pumpDayIso)
      ? data.pumpDayIso
      : data.recordedAt?.toDate
        ? format(data.recordedAt.toDate(), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');
  const dipKind: DipKind = data.dipKind === 'opening' ? 'opening' : 'closing';

  return {
    id,
    fuelTypeId: String(data.fuelTypeId ?? ''),
    dipCm,
    dipLiters,
    pumpDayIso,
    dipKind,
    recordedAt: data.recordedAt,
    recordedBy: data.recordedBy ? String(data.recordedBy) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

function isUpdatedToday(lastDipAt: FuelType['lastDipAt']): boolean {
  if (!lastDipAt) return false;
  return isSameDay(lastDipAt.toDate(), new Date());
}

function buildOverviewFromFuels(fuels: FuelType[]): FuelStockOverview {
  const items = sortFuelStockItems(
    fuels
      .map((f) => buildFuelStockItem(f, { updatedToday: isUpdatedToday(f.lastDipAt) }))
      .filter((item): item is NonNullable<typeof item> => item != null),
  );

  const totalStockLiters = items.reduce((sum, i) => sum + i.currentStockLiters, 0);
  const totalCapacityLiters = items.reduce((sum, i) => sum + i.tankCapacityLiters, 0);
  const overallUtilizationPercent =
    totalCapacityLiters > 0 ? Math.min(100, (totalStockLiters / totalCapacityLiters) * 100) : 0;

  return {
    items,
    totalStockLiters,
    totalCapacityLiters,
    overallUtilizationPercent,
    hasData: items.length > 0,
  };
}

export async function getFuelStockOverview(): Promise<FuelStockOverview> {
  if (LOCAL_DEMO) {
    return demoGetFuelStockOverview();
  }

  const fuels = await listFuelTypes();
  return buildOverviewFromFuels(fuels);
}

export async function listFuelTankDips(fuelTypeId: string): Promise<FuelTankDipReading[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTankDips(fuelTypeId);
  }

  const fuel = await listFuelTypes().then((rows) => rows.find((f) => f.id === fuelTypeId));
  const fuelName = fuel?.name ?? '';

  const q = query(
    collection(getDb(), COLLECTIONS.fuelTankDips),
    where('fuelTypeId', '==', fuelTypeId),
    orderBy('recordedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDip(d.id, d.data(), fuelName));
}

export async function listFuelTankDipsInRange(
  fromIso: string,
  toIso: string,
): Promise<FuelTankDipReading[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTankDipsInRange(fromIso, toIso);
  }

  const fuels = await listFuelTypes();
  const nameById = new Map(fuels.map((f) => [f.id, f.name]));
  const q = query(collection(getDb(), COLLECTIONS.fuelTankDips), orderBy('recordedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapDip(d.id, d.data(), nameById.get(String(d.data().fuelTypeId)) ?? ''))
    .filter((d) => d.pumpDayIso >= fromIso && d.pumpDayIso <= toIso);
}

export async function listFuelTankDipsForDay(pumpDayIso: string): Promise<FuelTankDipReading[]> {
  const dips = await listFuelTankDipsInRange(pumpDayIso, pumpDayIso);
  return dips.filter((d) => d.pumpDayIso === pumpDayIso);
}

/** Preview stock liters from a dip-stick reading before saving (135.8 → 136 cm chart). */
export function previewStockFromDipCm(dipCm: number, fuelName: string): number {
  return litersFromDipCm(dipCm, fuelName);
}

export async function recordFuelTankDip(input: {
  fuelTypeId: string;
  dipCm: number;
  pumpDayIso?: string;
  dipKind?: DipKind;
  recordedBy?: string;
  notes?: string;
}): Promise<string> {
  const fuel = await getFuelType(input.fuelTypeId);
  if (!fuel) {
    throw new Error('Fuel type not found');
  }
  const dipCm = canonicalDipCm(input.dipCm);
  const dipLiters = litersFromDipCm(dipCm, fuel.name);
  const pumpDayIso = input.pumpDayIso ?? format(new Date(), 'yyyy-MM-dd');
  const dipKind = input.dipKind ?? 'closing';

  if (LOCAL_DEMO) {
    const id = await demoRecordFuelTankDip({ ...input, dipLiters, pumpDayIso, dipKind });
    notifyFuelStockUpdated();
    return id;
  }

  const ref = await addDoc(collection(getDb(), COLLECTIONS.fuelTankDips), {
    fuelTypeId: input.fuelTypeId,
    dipCm,
    dipLiters,
    pumpDayIso,
    dipKind,
    recordedAt: serverTimestamp(),
    recordedBy: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });

  if (dipKind === 'closing') {
    const fuelRef = doc(getDb(), COLLECTIONS.fuelTypes, input.fuelTypeId);
    const fuelSnap = await getDoc(fuelRef);
    if (fuelSnap.exists()) {
      await updateDoc(fuelRef, {
        currentStockLiters: dipLiters,
        lastDipCm: dipCm,
        lastDipAt: serverTimestamp(),
      });
    }
  }

  notifyFuelStockUpdated();
  return ref.id;
}

/** Replace opening or closing dip for a fuel × pump day. */
export async function upsertFuelTankDipForDay(input: {
  fuelTypeId: string;
  pumpDayIso: string;
  dipKind: DipKind;
  dipCm: number;
  recordedBy?: string;
  notes?: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    const id = await demoUpsertFuelTankDipForDay(input);
    notifyFuelStockUpdated();
    return id;
  }

  const fuel = await getFuelType(input.fuelTypeId);
  if (!fuel) throw new Error('Fuel type not found');
  const dipCm = canonicalDipCm(input.dipCm);
  const dipLiters = litersFromDipCm(dipCm, fuel.name);

  const ref = await addDoc(collection(getDb(), COLLECTIONS.fuelTankDips), {
    fuelTypeId: input.fuelTypeId,
    dipCm,
    dipLiters,
    pumpDayIso: input.pumpDayIso,
    dipKind: input.dipKind,
    recordedAt: serverTimestamp(),
    recordedBy: input.recordedBy ?? null,
    notes: input.notes ?? null,
  });

  if (input.dipKind === 'closing' && input.pumpDayIso === format(new Date(), 'yyyy-MM-dd')) {
    await updateDoc(doc(getDb(), COLLECTIONS.fuelTypes, input.fuelTypeId), {
      currentStockLiters: dipLiters,
      lastDipCm: dipCm,
      lastDipAt: serverTimestamp(),
    });
  }

  notifyFuelStockUpdated();
  return ref.id;
}

export function formatFuelLiters(value: number): string {
  return `${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`;
}

export function formatFuelPercent(value: number): string {
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

