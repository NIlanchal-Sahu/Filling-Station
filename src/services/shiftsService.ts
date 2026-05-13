import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import type { Shift, ShiftStatus } from '@/types/entities';
import { COLLECTIONS, getDb } from '@/lib/firebase';
import { format } from 'date-fns';
import {
  demoCloseShift,
  demoCreateShift,
  demoGetShift,
  demoListClosedShiftsInEndTimeWindow,
  demoListClosedShiftsInRange,
  demoListOpenShiftsForOperator,
  demoListRecentShifts,
  demoListShiftsForCalendarDateRange,
  demoListShiftsForDateRange,
  demoSetShiftReadingsComplete,
} from '@/localDemo/demoBackend';

function mapShift(id: string, data: DocumentData): Shift {
  return {
    id,
    operatorId: String(data.operatorId ?? ''),
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    shiftLabel: String(data.shiftLabel ?? ''),
    status: (data.status === 'closed' ? 'closed' : 'open') as ShiftStatus,
    readingsCompleteAt: data.readingsCompleteAt ?? null,
    notes: data.notes ? String(data.notes) : undefined,
    pumpAttendants:
      typeof data.pumpAttendants === 'string' && data.pumpAttendants.trim()
        ? String(data.pumpAttendants).trim()
        : undefined,
    calendarDate:
      typeof data.calendarDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.calendarDate.trim())
        ? data.calendarDate.trim()
        : undefined,
  };
}

export async function getShift(shiftId: string): Promise<Shift | null> {
  if (LOCAL_DEMO) {
    return demoGetShift(shiftId);
  }
  const snap = await getDoc(doc(getDb(), COLLECTIONS.shifts, shiftId));
  if (!snap.exists()) {
    return null;
  }
  return mapShift(snap.id, snap.data());
}

export async function listOpenShiftsForOperator(operatorId: string): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListOpenShiftsForOperator(operatorId);
  }
  const ref = collection(getDb(), COLLECTIONS.shifts);
  const qy = query(
    ref,
    where('operatorId', '==', operatorId),
    where('status', '==', 'open'),
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapShift(d.id, d.data()));
}

export async function listShiftsForDateRange(
  from: Date,
  to: Date,
): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListShiftsForDateRange(from, to);
  }
  const ref = collection(getDb(), COLLECTIONS.shifts);
  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);
  const qy = query(
    ref,
    where('startTime', '>=', fromTs),
    where('startTime', '<=', toTs),
    orderBy('startTime', 'asc'),
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapShift(d.id, d.data()));
}

async function listShiftsByFirestoreCalendarOverlap(
  fromIso: string,
  toIso: string,
): Promise<Shift[]> {
  try {
    const ref = collection(getDb(), COLLECTIONS.shifts);
    const qy = query(
      ref,
      where('calendarDate', '>=', fromIso),
      where('calendarDate', '<=', toIso),
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => mapShift(d.id, d.data()));
  } catch {
    return [];
  }
}

/** Local calendar pump day: **calendarDate** from Start shift, else local date of **startTime**. */
export function shiftPumpDayIso(s: Shift): string {
  if (s.calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(s.calendarDate)) {
    return s.calendarDate;
  }
  return format(s.startTime.toDate(), 'yyyy-MM-dd');
}

function localStartOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localEndOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Closed shifts whose pump day falls in **[from … to]** (local `yyyy-MM-dd`, inclusive). */
export async function listClosedShiftsByPumpDayRange(from: Date, to: Date): Promise<Shift[]> {
  const fromIso = format(localStartOfDay(from), 'yyyy-MM-dd');
  const toIso = format(localStartOfDay(to), 'yyyy-MM-dd');
  const merged = await listShiftsForCashSheetMerge(localStartOfDay(from), localEndOfDay(to));
  const closed = merged.filter((s) => s.status === 'closed' && s.endTime);
  return closed.filter((s) => {
    const day = shiftPumpDayIso(s);
    return day >= fromIso && day <= toIso;
  });
}

/** Merge shifts that started in the window with shifts whose **calendarDate** falls in the same yyyy-MM-dd range. */
export async function listShiftsForCashSheetMerge(from: Date, to: Date): Promise<Shift[]> {
  const fromIso = format(from, 'yyyy-MM-dd');
  const toIso = format(to, 'yyyy-MM-dd');
  const byStartMs = await listShiftsForDateRange(from, to);
  const byCalendar = LOCAL_DEMO
    ? await demoListShiftsForCalendarDateRange(fromIso, toIso)
    : await listShiftsByFirestoreCalendarOverlap(fromIso, toIso);

  const map = new Map<string, Shift>();
  for (const s of byStartMs) {
    map.set(s.id, s);
  }
  for (const s of byCalendar) {
    if (!map.has(s.id)) {
      map.set(s.id, s);
    }
  }
  return [...map.values()];
}

export async function listClosedShiftsInRange(
  from: Date,
  to: Date,
): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListClosedShiftsInRange(from, to);
  }
  const ref = collection(getDb(), COLLECTIONS.shifts);
  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);
  const qy = query(
    ref,
    where('status', '==', 'closed'),
    where('endTime', '>=', fromTs),
    where('endTime', '<=', toTs),
  );
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => mapShift(d.id, d.data()))
    .filter((s) => s.endTime);
}

/**
 * Shifts that closed in calendar day in local time — caller passes start/end of day in local timezone.
 */
export async function listClosedShiftsInEndTimeWindow(
  windowStart: Date,
  windowEnd: Date,
): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListClosedShiftsInEndTimeWindow(windowStart, windowEnd);
  }
  return listClosedShiftsInRange(windowStart, windowEnd);
}

export async function createShift(input: {
  operatorId: string;
  shiftLabel: string;
  calendarDate: string;
  notes?: string;
  pumpAttendants?: string;
}): Promise<string> {
  if (LOCAL_DEMO) {
    return demoCreateShift(input);
  }
  const ref = await addDoc(collection(getDb(), COLLECTIONS.shifts), {
    operatorId: input.operatorId,
    shiftLabel: input.shiftLabel,
    calendarDate: input.calendarDate,
    status: 'open' as const,
    startTime: serverTimestamp(),
    endTime: null,
    readingsCompleteAt: null,
    notes: input.notes ?? null,
    pumpAttendants: input.pumpAttendants?.trim() || null,
  });
  return ref.id;
}

export async function setShiftReadingsComplete(shiftId: string): Promise<void> {
  if (LOCAL_DEMO) {
    return demoSetShiftReadingsComplete(shiftId);
  }
  const r = doc(getDb(), COLLECTIONS.shifts, shiftId);
  await updateDoc(r, { readingsCompleteAt: serverTimestamp() });
}

export async function closeShift(shiftId: string): Promise<void> {
  if (LOCAL_DEMO) {
    return demoCloseShift(shiftId);
  }
  const r = doc(getDb(), COLLECTIONS.shifts, shiftId);
  await updateDoc(r, {
    status: 'closed' as const,
    endTime: serverTimestamp(),
  });
}

export async function listRecentShifts(limitN: number): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListRecentShifts(limitN);
  }
  const ref = collection(getDb(), COLLECTIONS.shifts);
  const qy = query(ref, orderBy('startTime', 'desc'), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => mapShift(d.id, d.data()));
}
