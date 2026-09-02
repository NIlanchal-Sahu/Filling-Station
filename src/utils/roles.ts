import type { UserRole } from '@/types/entities';

/** Parse Firestore / demo role strings; unknown values become operator. */
export function parseUserRole(raw: unknown): UserRole {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'admin' || s === 'manager' || s === 'operator') {
    return s;
  }
  return 'operator';
}

/** Owner (admin) and manager share pump-management screens. */
export function isManagerLike(role: UserRole | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}

export function homePathForRole(role: UserRole | null | undefined): string {
  if (role === 'admin' || role === 'manager') {
    return '/manager';
  }
  if (role === 'operator') {
    return '/operator';
  }
  return '/';
}

export function roleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Operator';
}
