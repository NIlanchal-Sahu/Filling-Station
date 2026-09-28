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
  demoDeactivateNozzlesForMachine,
  demoGetNozzle,
  demoListNozzles,
  demoSetNozzleActive,
  demoUpdateNozzle,
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

export type NozzleUpdateInput = {
  machineNumber?: string;
  nozzleNumber?: string;
  fuelTypeId?: string;
};

export async function updateNozzle(id: string, patch: NozzleUpdateInput): Promise<void> {
  const payload: Record<string, string> = {};
  if (patch.machineNumber !== undefined) {
    payload.machineNumber = patch.machineNumber.trim();
  }
  if (patch.nozzleNumber !== undefined) {
    payload.nozzleNumber = patch.nozzleNumber.trim();
  }
  if (patch.fuelTypeId !== undefined) {
    payload.fuelTypeId = patch.fuelTypeId;
  }
  if (Object.keys(payload).length === 0) {
    return;
  }
  if (LOCAL_DEMO) {
    return demoUpdateNozzle(id, payload);
  }
  const ref = doc(getDb(), COLLECTIONS.nozzles, id);
  await updateDoc(ref, payload);
}

export async function deactivateNozzlesForMachine(machineNumber: string): Promise<void> {
  const key = machineNumber.trim();
  if (!key) {
    return;
  }
  if (LOCAL_DEMO) {
    return demoDeactivateNozzlesForMachine(key);
  }
  const all = await listNozzles(false);
  await Promise.all(
    all
      .filter((n) => n.machineNumber.trim() === key && n.isActive)
      .map((n) => setNozzleActive(n.id, false)),
  );
}

/** True if another active nozzle already uses this machine + nozzle pair. */
export async function activeNozzleSlotTaken(
  machineNumber: string,
  nozzleNumber: string,
  excludeId?: string,
): Promise<boolean> {
  const m = machineNumber.trim();
  const n = nozzleNumber.trim();
  const all = await listNozzles(true);
  return all.some(
    (row) =>
      row.id !== excludeId &&
      row.machineNumber.trim() === m &&
      row.nozzleNumber.trim() === n,
  );
}
