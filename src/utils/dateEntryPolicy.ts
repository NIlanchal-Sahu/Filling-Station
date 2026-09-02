import { format } from 'date-fns';
import type { UserRole } from '@/types/entities';

/** Pump business day as yyyy-MM-dd (local). */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Only the owner (admin) may enter or edit data for past pump days.
 * Managers and operators are locked to today.
 */
export function canBackdateEntries(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/** HTML date input bounds for data-entry fields (not report filters). */
export function dateInputBoundsForRole(role: UserRole | null | undefined): {
  min?: string;
  max: string;
} {
  const today = todayIso();
  if (canBackdateEntries(role)) {
    return { max: today };
  }
  return { min: today, max: today };
}

/**
 * Force non-admins to today. Admins keep any valid date (clamped to not exceed today).
 */
export function clampEntryDateForRole(
  role: UserRole | null | undefined,
  iso: string,
): string {
  const today = todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return today;
  }
  if (iso > today) {
    return today;
  }
  if (canBackdateEntries(role)) {
    return iso;
  }
  return today;
}

/** Throw if a non-admin tries to save a non-today entry date. */
export function assertEntryDateAllowed(
  role: UserRole | null | undefined,
  pumpDayIso: string,
): void {
  const today = todayIso();
  if (pumpDayIso > today) {
    throw new Error('Cannot enter data for a future date.');
  }
  if (canBackdateEntries(role)) {
    return;
  }
  if (pumpDayIso !== today) {
    throw new Error('Only the owner (admin) can enter or edit data for past dates.');
  }
}
