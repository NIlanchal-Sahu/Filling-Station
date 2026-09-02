import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { User, UserRole } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import {
  demoGetUser,
  demoListActiveUsers,
  demoListUsersForManager,
  demoUpsertUser,
  demoUpdateUserRole,
} from '@/localDemo/demoBackend';
import { parseUserRole } from '@/utils/roles';

function mapUser(id: string, data: DocumentData): User {
  return {
    id,
    name: String(data.name ?? ''),
    role: parseUserRole(data.role),
    phone: data.phone ? String(data.phone) : undefined,
    isActive: data.isActive !== false,
  };
}

export async function getUser(uid: string): Promise<User | null> {
  if (LOCAL_DEMO) {
    return demoGetUser(uid);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
  if (!snap.exists()) {
    return null;
  }
  return mapUser(snap.id, snap.data());
}

export async function listActiveUsers(): Promise<User[]> {
  if (LOCAL_DEMO) {
    return demoListActiveUsers();
  }
  const q = collection(getDb(), COLLECTIONS.users);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapUser(d.id, d.data()))
    .filter((u) => u.isActive);
}

export async function listUsersForManager(): Promise<User[]> {
  if (LOCAL_DEMO) {
    return demoListUsersForManager();
  }
  const q = collection(getDb(), COLLECTIONS.users);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUser(d.id, d.data()));
}

export async function upsertUser(uid: string, input: Omit<User, 'id'>): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpsertUser(uid, input);
  }
  const ref = doc(getDb(), COLLECTIONS.users, uid);
  await setDoc(
    ref,
    {
      name: input.name,
      role: input.role,
      phone: input.phone ?? null,
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateUserRole(uid, role);
  }
  const ref = doc(getDb(), COLLECTIONS.users, uid);
  await updateDoc(ref, { role, updatedAt: serverTimestamp() });
}
