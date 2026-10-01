import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import type { StaffPayMode, User, UserRole } from '@/types/entities';
import {
  demoGetUser,
  demoListActiveUsers,
  demoListUsersForManager,
  demoUpsertUser,
  demoUpdateUserRole,
} from '@/localDemo/demoBackend';
import { parseUserRole } from '@/utils/roles';

const STAFF_BUCKET = 'staff-photos';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  address: string | null;
  is_active: boolean | null;
  staff_pay_mode: string | null;
  shift_pay_rate_inr: number | null;
  monthly_salary_inr: number | null;
};

function optionalText(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const s = String(value).trim();
  return s || undefined;
}

function parseStaffPayMode(raw: unknown): StaffPayMode | undefined {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'monthly') return 'monthly';
  if (s === 'per_shift' || s === 'per shift') return 'per_shift';
  return undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isStoredPhotoPath(value: string): boolean {
  return !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('data:');
}

function mapUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: String(row.name ?? ''),
    role: parseUserRole(row.role),
    phone: optionalText(row.phone),
    email: optionalText(row.email),
    photoUrl: optionalText(row.photo_url),
    address: optionalText(row.address),
    isActive: row.is_active !== false,
    staffPayMode: parseStaffPayMode(row.staff_pay_mode),
    shiftPayRateInr: optionalPositiveNumber(row.shift_pay_rate_inr),
    monthlySalaryInr: optionalPositiveNumber(row.monthly_salary_inr),
  };
}

async function withSignedPhotos(users: User[]): Promise<User[]> {
  const paths = [
    ...new Set(
      users
        .map((u) => u.photoUrl)
        .filter((p): p is string => !!p && isStoredPhotoPath(p)),
    ),
  ];
  if (paths.length === 0) {
    return users;
  }
  const { data, error } = await getSupabase()
    .storage.from(STAFF_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) {
    return users.map((u) =>
      u.photoUrl && isStoredPhotoPath(u.photoUrl) ? { ...u, photoUrl: undefined } : u,
    );
  }
  const byPath = new Map(data.map((row) => [row.path, row.signedUrl]));
  return users.map((u) => {
    if (!u.photoUrl || !isStoredPhotoPath(u.photoUrl)) {
      return u;
    }
    return { ...u, photoUrl: byPath.get(u.photoUrl) || undefined };
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function getUser(uid: string): Promise<User | null> {
  if (LOCAL_DEMO) {
    return demoGetUser(uid);
  }
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  throwIfError(error, 'Load profile');
  if (!data) {
    return null;
  }
  const [user] = await withSignedPhotos([mapUser(data as ProfileRow)]);
  return user ?? null;
}

export async function listActiveUsers(): Promise<User[]> {
  if (LOCAL_DEMO) {
    return demoListActiveUsers();
  }
  const { data, error } = await getSupabase().from('profiles').select('*');
  throwIfError(error, 'List profiles');
  const users = ((data ?? []) as ProfileRow[]).map(mapUser).filter((u) => u.isActive);
  return withSignedPhotos(users);
}

export async function listUsersForManager(): Promise<User[]> {
  if (LOCAL_DEMO) {
    return demoListUsersForManager();
  }
  const { data, error } = await getSupabase().from('profiles').select('*');
  throwIfError(error, 'List profiles');
  return withSignedPhotos(((data ?? []) as ProfileRow[]).map(mapUser));
}

/** Demo: keep the data URL on the user record. Live: store in the staff-photos bucket and return the object path. */
export async function persistStaffPhoto(uid: string, dataUrl: string): Promise<string> {
  if (LOCAL_DEMO) {
    return dataUrl;
  }
  const path = `${uid}.jpg`;
  const { error } = await getSupabase()
    .storage.from(STAFF_BUCKET)
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: 'image/jpeg' });
  throwIfError(error, 'Upload staff photo');
  return path;
}

export async function upsertUser(uid: string, input: Omit<User, 'id'>): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpsertUser(uid, input);
  }
  const row: Record<string, unknown> = {
    id: uid,
    name: input.name,
    role: input.role,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    is_active: input.isActive,
    staff_pay_mode: input.staffPayMode ?? null,
    shift_pay_rate_inr:
      input.shiftPayRateInr != null && Number.isFinite(input.shiftPayRateInr)
        ? input.shiftPayRateInr
        : null,
    monthly_salary_inr:
      input.monthlySalaryInr != null && Number.isFinite(input.monthlySalaryInr)
        ? input.monthlySalaryInr
        : null,
    updated_at: new Date().toISOString(),
  };
  const photo = input.photoUrl?.trim() ?? '';
  if (!photo) {
    row.photo_url = null;
  } else if (isStoredPhotoPath(photo)) {
    row.photo_url = photo;
  }
  const { error } = await getSupabase().from('profiles').upsert(row, { onConflict: 'id' });
  throwIfError(error, 'Save profile');
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  if (LOCAL_DEMO) {
    return demoUpdateUserRole(uid, role);
  }
  const { error } = await getSupabase()
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', uid);
  throwIfError(error, 'Update role');
}
