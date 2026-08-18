import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { Nozzle } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoCreateNozzle,
  demoGetNozzle,
  demoListNozzles,
  demoSetNozzleActive,
} from '@/localDemo/demoBackend';
import { compareNozzleOrder } from '@/utils/nozzleSort';

function mapNozzle(id: string, data: DocumentData): Nozzle {
  return {
    id,
    machineNumber: String(data.machineNumber ?? ''),
    nozzleNumber: String(data.nozzleNumber ?? ''),
    fuelTypeId: String(data.fuelTypeId ?? ''),
    isActive: data.isActive !== false,
  };
}

export async function listNozzles(activeOnly = true): Promise<Nozzle[]> {
  if (LOCAL_DEMO) {
    return demoListNozzles(activeOnly);
  }
  const ref = collection(getDb(), COLLECTIONS.nozzles);
  const qy = activeOnly ? query(ref, where('isActive', '==', true)) : ref;
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapNozzle(d.id, d.data()))
    .sort((a, b) => compareNozzleOrder(a, b));
}

export async function getNozzle(id: string): Promise<Nozzle | null> {
  if (LOCAL_DEMO) {
    return demoGetNozzle(id);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.nozzles, id));
  if (!snap.exists()) {
    return null;
  }
  return mapNozzle(snap.id, snap.data());
}

export async function createNozzle(input: {
  machineNumber: string;
  nozzleNumber: string;
  fuelTypeId: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateNozzle(input);
  }
  const ref = await addDoc(collection(getDb(), COLLECTIONS.nozzles), {
    machineNumber: input.machineNumber,
    nozzleNumber: input.nozzleNumber,
    fuelTypeId: input.fuelTypeId,
    isActive: true,
  });
  return ref.id;
}

export async function setNozzleActive(id: string, isActive: boolean): Promise<void> {
  if (LOCAL_DEMO) {
    return demoSetNozzleActive(id, isActive);
  }
  const ref = doc(getDb(), COLLECTIONS.nozzles, id);
  await updateDoc(ref, { isActive });
}
