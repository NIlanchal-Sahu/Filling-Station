import { format } from 'date-fns';
import type { UserRole } from '@/types/entities';

/** Pump business day as yyyy-MM-dd (local). */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export const PUMP_DAY_QUERY_KEY = 'day';

const ADMIN_PUMP_DAY_STORAGE = 'pumpstock-admin-pump-day';

export function parsePumpDayParam(raw: string | null | undefined): string | null {
  const iso = raw?.trim() ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

export function withPumpDayQuery(path: string, iso: string): string {
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutHash.indexOf('?');
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const existing = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : '';
  const params = new URLSearchParams(existing);
  params.set(PUMP_DAY_QUERY_KEY, iso);
  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
}

export function rememberAdminPumpDay(iso: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    try {
      sessionStorage.setItem(ADMIN_PUMP_DAY_STORAGE, iso);
      localStorage.setItem(ADMIN_PUMP_DAY_STORAGE, iso);
    } catch {
      /* ignore quota / private mode */
    }
  }
}

export function recalledAdminPumpDay(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return (
      parsePumpDayParam(sessionStorage.getItem(ADMIN_PUMP_DAY_STORAGE)) ??
      parsePumpDayParam(localStorage.getItem(ADMIN_PUMP_DAY_STORAGE))
    );
  } catch {
    return null;
  }
}

/**
 * Owner and admin may enter or edit data for past pump days.
 * Managers and workers are locked to today.
 */
export function canBackdateEntries(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
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
    throw new Error('Only the owner or admin can enter or edit data for past dates.');
  }
}
