import { format } from 'date-fns';
import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, newId, throwIfError } from '@/lib/supabase';
import type { Shift, ShiftAttendantPost, ShiftStatus } from '@/types/entities';
import { asTimestamp, asTimestampOrNull } from '@/types/time';
import { notifyShiftStatusUpdated } from '@/utils/shiftStatusDisplay';
import { parseAttendantPosts } from '@/utils/attendantPosts';
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

type ShiftRow = {
  id: string;
  operator_id: string | null;
  start_time: string | null;
  end_time: string | null;
  shift_label: string | null;
  status: string | null;
  readings_complete_at: string | null;
  notes: string | null;
  pump_attendants: string | null;
  attendant_posts: unknown;
  calendar_date: string | null;
};

function mapShift(row: ShiftRow): Shift {
  const posts = parseAttendantPosts(row.attendant_posts);
  const calendarDate =
    typeof row.calendar_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.calendar_date.trim())
      ? row.calendar_date.trim()
      : undefined;
  return {
    id: row.id,
    operatorId: String(row.operator_id ?? ''),
    startTime: asTimestamp(row.start_time),
    endTime: asTimestampOrNull(row.end_time),
    shiftLabel: String(row.shift_label ?? ''),
    status: (row.status === 'closed' ? 'closed' : 'open') as ShiftStatus,
    readingsCompleteAt: asTimestampOrNull(row.readings_complete_at),
    notes: row.notes ? String(row.notes) : undefined,
    pumpAttendants:
      typeof row.pump_attendants === 'string' && row.pump_attendants.trim()
        ? row.pump_attendants.trim()
        : undefined,
    attendantPosts: posts.length > 0 ? posts : undefined,
    calendarDate,
  };
}

export async function getShift(shiftId: string): Promise<Shift | null> {
  if (LOCAL_DEMO) {
    return demoGetShift(shiftId);
  }
  const { data, error } = await getSupabase().from('shifts').select('*').eq('id', shiftId).maybeSingle();
  throwIfError(error, 'Load shift');
  return data ? mapShift(data as ShiftRow) : null;
}

export async function listOpenShiftsForOperator(operatorId: string): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListOpenShiftsForOperator(operatorId);
  }
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('status', 'open');
  throwIfError(error, 'List open shifts');
  return ((data ?? []) as ShiftRow[]).map(mapShift);
}

export async function listShiftsForDateRange(from: Date, to: Date): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListShiftsForDateRange(from, to);
  }
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .gte('start_time', from.toISOString())
    .lte('start_time', to.toISOString())
    .order('start_time', { ascending: true });
  throwIfError(error, 'List shifts');
  return ((data ?? []) as ShiftRow[]).map(mapShift);
}

async function listShiftsByCalendarOverlap(fromIso: string, toIso: string): Promise<Shift[]> {
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .gte('calendar_date', fromIso)
    .lte('calendar_date', toIso);
  if (error) {
    return [];
  }
  return ((data ?? []) as ShiftRow[]).map(mapShift);
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
    : await listShiftsByCalendarOverlap(fromIso, toIso);

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

export async function listClosedShiftsInRange(from: Date, to: Date): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListClosedShiftsInRange(from, to);
  }
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .eq('status', 'closed')
    .gte('end_time', from.toISOString())
    .lte('end_time', to.toISOString());
  throwIfError(error, 'List closed shifts');
  return ((data ?? []) as ShiftRow[]).map(mapShift).filter((s) => s.endTime);
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
  attendantPosts?: ShiftAttendantPost[];
}): Promise<string> {
  if (LOCAL_DEMO) {
    const id = await demoCreateShift(input);
    notifyShiftStatusUpdated();
    return id;
  }
  const posts = parseAttendantPosts(input.attendantPosts);
  const id = newId();
  const { error } = await getSupabase().from('shifts').insert({
    id,
    operator_id: input.operatorId,
    shift_label: input.shiftLabel,
    calendar_date: input.calendarDate,
    status: 'open',
    start_time: new Date().toISOString(),
    end_time: null,
    readings_complete_at: null,
    notes: input.notes ?? null,
    pump_attendants: input.pumpAttendants?.trim() || null,
    attendant_posts: posts.length > 0 ? posts : null,
  });
  throwIfError(error, 'Create shift');
  notifyShiftStatusUpdated();
  return id;
}

export async function setShiftReadingsComplete(shiftId: string): Promise<void> {
  if (LOCAL_DEMO) {
    return demoSetShiftReadingsComplete(shiftId);
  }
  const { error } = await getSupabase()
    .from('shifts')
    .update({ readings_complete_at: new Date().toISOString() })
    .eq('id', shiftId);
  throwIfError(error, 'Mark readings complete');
}

export async function closeShift(shiftId: string): Promise<void> {
  if (LOCAL_DEMO) {
    return demoCloseShift(shiftId);
  }
  const { error } = await getSupabase()
    .from('shifts')
    .update({ status: 'closed', end_time: new Date().toISOString() })
    .eq('id', shiftId);
  throwIfError(error, 'Close shift');
}

export async function listRecentShifts(limitN: number): Promise<Shift[]> {
  if (LOCAL_DEMO) {
    return demoListRecentShifts(limitN);
  }
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(limitN);
  throwIfError(error, 'List recent shifts');
  return ((data ?? []) as ShiftRow[]).map(mapShift);
}
