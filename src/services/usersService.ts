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
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { LOCAL_DEMO } from '@/config/appMode';
import type { User, UserRole } from '@/types/entities';
import { COLLECTIONS, getDb, getStorageInstance } from '@/lib/firebase';
import {
  demoGetUser,
  demoListActiveUsers,
  demoListUsersForManager,
  demoUpsertUser,
  demoUpdateUserRole,
} from '@/localDemo/demoBackend';
import { parseUserRole } from '@/utils/roles';

function optionalText(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const s = String(value).trim();
  return s || undefined;
}

function mapUser(id: string, data: DocumentData): User {
  return {
    id,
    name: String(data.name ?? ''),
    role: parseUserRole(data.role),
    phone: optionalText(data.phone),
    email: optionalText(data.email),
    photoUrl: optionalText(data.photoUrl),
    address: optionalText(data.address),
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

/** Demo: keep the data URL on the user record. Live: store in Firebase Storage. */
export async function persistStaffPhoto(uid: string, dataUrl: string): Promise<string> {
  if (LOCAL_DEMO) {
    return dataUrl;
  }
  const photoRef = ref(getStorageInstance(), `staff-photos/${uid}.jpg`);
  await uploadString(photoRef, dataUrl, 'data_url');
  return getDownloadURL(photoRef);
}

export async function upsertUser(uid: string, input: Omit<User, 'id'>): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpsertUser(uid, input);
  }
  const refDoc = doc(getDb(), COLLECTIONS.users, uid);
  await setDoc(
    refDoc,
    {
      name: input.name,
      role: input.role,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      photoUrl: input.photoUrl?.trim() || null,
      address: input.address?.trim() || null,
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
  const refDoc = doc(getDb(), COLLECTIONS.users, uid);
  await updateDoc(refDoc, { role, updatedAt: serverTimestamp() });
}
