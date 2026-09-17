import type { UserRole } from '@/types/entities';
import { hasPermission, isOpsWriter } from '@/utils/permissions';

/** Parse Firestore / demo role strings; unknown values become operator. */
export function parseUserRole(raw: unknown): UserRole {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'admin' || s === 'owner' || s === 'manager' || s === 'operator') {
    return s;
  }
  return 'operator';
}

/** Pump-floor staff shown on Start shift roster (Team operators who are active). */
export function isPumpRosterUser(user: { role: UserRole; isActive: boolean }): boolean {
  return user.isActive && user.role === 'operator';
}

/** Manager or admin with operational write access. */
export function isManagerLike(role: UserRole | null | undefined): boolean {
  return isOpsWriter(role);
}

/** Manager, owner, or admin — can view operational pages. */
export function isOpsViewerRole(role: UserRole | null | undefined): boolean {
  return (
    role === 'manager' ||
    role === 'admin' ||
    role === 'owner' ||
    hasPermission(role, 'view:operations')
  );
}

export function homePathForRole(role: UserRole | null | undefined): string {
  if (role === 'admin') {
    return '/admin';
  }
  if (role === 'owner') {
    return '/owner';
  }
  if (role === 'manager') {
    return '/manager';
  }
  if (role === 'operator') {
    return '/operator';
  }
  return '/';
}

export function roleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  return 'Worker';
}
