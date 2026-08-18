import { differenceInMinutes, format, isSameDay, parseISO } from 'date-fns';

import { getReconciliationForShift } from '@/services/reconciliationService';
import { getMachineLabelForShift } from '@/services/shiftReadingsService';
import { getUser } from '@/services/usersService';
import { listShiftsForCashSheetMerge, shiftPumpDayIso } from '@/services/shiftsService';
import type { Shift, ShiftLabel } from '@/types/entities';
import { SHIFT_LABELS } from '@/types/entities';
import {
  formatAttendantNames,
  formatClock12,
  formatDurationMinutes,
  PRIMARY_SHIFT_LABELS,
  shiftScheduleForLabel,
  type ShiftActivityStatus,
  type ShiftScheduleMeta,
} from '@/utils/shiftStatusDisplay';

export type ShiftStatusRow = {
  shiftLabel: ShiftLabel;
  displayName: string;
  shiftId: string | null;
  attendant: string;
  attendantMissing: boolean;
  /** e.g. "M1" or "M1, M2" from nozzles assigned to this shift; "—" when none. */
  machineLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  durationLabel: string;
  status: ShiftActivityStatus;
  detailPath: string | null;
  minutesSinceEnd: number | null;
};

export type ShiftStatusSummary = {
  pumpDayIso: string;
  rows: ShiftStatusRow[];
  alerts: string[];
  totals: {
    totalShifts: number;
    active: number;
    completed: number;
    pendingReconciliation: number;
  };
  hasAnyShiftRecord: boolean;
};

function localDayBounds(iso: string): { start: Date; end: Date } {
  const start = parseISO(`${iso}T00:00:00`);
  const end = parseISO(`${iso}T23:59:59.999`);
  return { start, end };
}

function scheduledStartOnPumpDay(pumpDayIso: string, meta: ShiftScheduleMeta): Date {
  return parseISO(
    `${pumpDayIso}T${String(meta.startHour).padStart(2, '0')}:${String(meta.startMinute).padStart(2, '0')}:00`,
  );
}

function scheduledEndOnPumpDay(pumpDayIso: string, meta: ShiftScheduleMeta): Date {
  const base = parseISO(`${pumpDayIso}T12:00:00`);
  if (meta.crossesMidnight) {
    base.setDate(base.getDate() + 1);
  }
  const y = base.getFullYear();
  const mo = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return parseISO(
    `${y}-${mo}-${d}T${String(meta.endHour).padStart(2, '0')}:${String(meta.endMinute).padStart(2, '0')}:00`,
  );
}

function pickShiftForLabel(shifts: Shift[], label: ShiftLabel): Shift | undefined {
  const matches = shifts.filter((s) => s.shiftLabel.trim() === label);
  if (matches.length === 0) return undefined;
  const open = matches.find((s) => s.status === 'open');
  if (open) return open;
  return matches.sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis())[0];
}

function formatShiftTime(ts: Date): string {
  return format(ts, 'hh:mm a');
}

async function resolveActivityStatus(
  shift: Shift | undefined,
  meta: ShiftScheduleMeta,
  pumpDayIso: string,
  now: Date,
  isToday: boolean,
): Promise<{ status: ShiftActivityStatus; minutesSinceEnd: number | null }> {
  const schedStart = scheduledStartOnPumpDay(pumpDayIso, meta);
  const schedEnd = scheduledEndOnPumpDay(pumpDayIso, meta);

  if (!shift) {
    if (!isToday) {
      return { status: 'not_started', minutesSinceEnd: null };
    }
    if (now.getTime() >= schedStart.getTime() && now.getTime() < schedEnd.getTime()) {
      return { status: 'overdue', minutesSinceEnd: null };
    }
    if (now.getTime() >= schedEnd.getTime()) {
      return { status: 'overdue', minutesSinceEnd: differenceInMinutes(now, schedEnd) };
    }
    return { status: 'not_started', minutesSinceEnd: null };
  }

  if (shift.status === 'open') {
    return { status: 'active', minutesSinceEnd: null };
  }

  const recon = await getReconciliationForShift(shift.id);
  if (recon?.status === 'approved') {
    return { status: 'completed', minutesSinceEnd: null };
  }

  const endAt = shift.endTime?.toDate() ?? schedEnd;
  const minutesSinceEnd = isToday && endAt ? Math.max(0, differenceInMinutes(now, endAt)) : null;
  return { status: 'reconciliation_pending', minutesSinceEnd };
}

function detailPathFor(shift: Shift | undefined, status: ShiftActivityStatus): string | null {
  if (!shift) return null;
  if (status === 'active') {
    if (!shift.readingsCompleteAt) return `/shifts/${shift.id}/meters`;
    return `/shifts/${shift.id}/reconcile`;
  }
  return `/shifts/${shift.id}/reconcile?edit=1`;
}

async function buildRow(
  label: ShiftLabel,
  shifts: Shift[],
  pumpDayIso: string,
  now: Date,
  isToday: boolean,
): Promise<ShiftStatusRow> {
  const meta = shiftScheduleForLabel(label)!;
  const shift = pickShiftForLabel(shifts, label);
  const { status, minutesSinceEnd } = await resolveActivityStatus(shift, meta, pumpDayIso, now, isToday);

  let attendant = '—';
  if (shift?.pumpAttendants?.trim()) {
    attendant = formatAttendantNames(shift.pumpAttendants);
  } else if (shift) {
    const op = await getUser(shift.operatorId);
    attendant = op?.name ?? shift.operatorId;
  }

  const schedStart = scheduledStartOnPumpDay(pumpDayIso, meta);
  const schedEnd = scheduledEndOnPumpDay(pumpDayIso, meta);

  const startTimeLabel = shift
    ? formatShiftTime(shift.startTime.toDate())
    : formatClock12(meta.startHour, meta.startMinute);
  const endTimeLabel = shift?.endTime
    ? formatShiftTime(shift.endTime.toDate())
    : formatClock12(meta.endHour, meta.endMinute);

  let durationLabel = formatDurationMinutes(differenceInMinutes(schedEnd, schedStart));
  if (shift) {
    const end = shift.endTime?.toDate() ?? (status === 'active' ? now : schedEnd);
    durationLabel = formatDurationMinutes(differenceInMinutes(end, shift.startTime.toDate()));
  }

  const machineLabel = shift ? await getMachineLabelForShift(shift.id) : '—';

  return {
    shiftLabel: label,
    displayName: meta.displayName,
    shiftId: shift?.id ?? null,
    attendant,
    attendantMissing: Boolean(shift && !shift.pumpAttendants?.trim()),
    machineLabel,
    startTimeLabel,
    endTimeLabel,
    durationLabel,
    status,
    detailPath: detailPathFor(shift, status),
    minutesSinceEnd,
  };
}

function buildAlerts(rows: ShiftStatusRow[], isToday: boolean): string[] {
  const alerts: string[] = [];
  for (const row of rows) {
    if (row.attendantMissing && row.shiftId) {
      alerts.push(`${row.displayName}: no attendant assigned.`);
    }
    if (isToday && row.status === 'not_started') {
      alerts.push(`${row.displayName} has not been started yet.`);
    }
    if (isToday && row.status === 'overdue' && !row.shiftId) {
      alerts.push(`${row.displayName} was scheduled but has not been started.`);
    }
    if (row.status === 'reconciliation_pending') {
      const mins = row.minutesSinceEnd;
      if (mins != null && mins > 0) {
        alerts.push(
          `${row.displayName} ended ${mins} minute${mins === 1 ? '' : 's'} ago. Reconciliation pending.`,
        );
      } else {
        alerts.push(`${row.displayName}: reconciliation pending.`);
      }
    }
  }
  return alerts;
}

export async function getShiftStatusForPumpDay(pumpDayIso: string, now = new Date()): Promise<ShiftStatusSummary> {
  const { start, end } = localDayBounds(pumpDayIso);
  const merged = await listShiftsForCashSheetMerge(start, end);
  const shifts = merged.filter((s) => shiftPumpDayIso(s) === pumpDayIso);
  const isToday = isSameDay(parseISO(`${pumpDayIso}T12:00:00`), now);

  const rows = await Promise.all(
    SHIFT_LABELS.map((label) => buildRow(label, shifts, pumpDayIso, now, isToday)),
  );

  const primaryRows = rows.filter((r) => PRIMARY_SHIFT_LABELS.includes(r.shiftLabel));
  const totals = {
    totalShifts: PRIMARY_SHIFT_LABELS.length,
    active: primaryRows.filter((r) => r.status === 'active').length,
    completed: primaryRows.filter((r) => r.status === 'completed').length,
    pendingReconciliation: primaryRows.filter((r) => r.status === 'reconciliation_pending').length,
  };

  return {
    pumpDayIso,
    rows,
    alerts: buildAlerts(rows, isToday),
    totals,
    hasAnyShiftRecord: shifts.length > 0,
  };
}
