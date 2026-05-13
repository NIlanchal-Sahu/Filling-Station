import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { FuelType } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoCreateFuelType,
  demoGetFuelType,
  demoListFuelTypes,
  demoUpdateFuelRate,
} from '@/localDemo/demoBackend';

function mapFuelType(id: string, data: DocumentData): FuelType {
  return {
    id,
    name: String(data.name ?? ''),
    currentRate: Number(data.currentRate ?? 0),
    lastUpdatedAt: data.lastUpdatedAt,
  };
}

export async function listFuelTypes(): Promise<FuelType[]> {
  if (LOCAL_DEMO) {
    return demoListFuelTypes();
  }
  const snap = await getDocs(
    collection(getDb(), COLLECTIONS.fuelTypes),
  );
  return snap.docs.map((d) => mapFuelType(d.id, d.data()));
}

export async function getFuelType(id: string): Promise<FuelType | null> {
  if (LOCAL_DEMO) {
    return demoGetFuelType(id);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.fuelTypes, id));
  if (!snap.exists()) {
    return null;
  }
  return mapFuelType(snap.id, snap.data());
}

export async function createFuelType(name: string, currentRate: number): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateFuelType(name, currentRate);
  }
  const ref = await addDoc(collection(getDb(), COLLECTIONS.fuelTypes), {
    name,
    currentRate,
    lastUpdatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFuelRate(id: string, currentRate: number): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateFuelRate(id, currentRate);
  }
  const ref = doc(getDb(), COLLECTIONS.fuelTypes, id);
  await updateDoc(ref, { currentRate, lastUpdatedAt: serverTimestamp() });
}
