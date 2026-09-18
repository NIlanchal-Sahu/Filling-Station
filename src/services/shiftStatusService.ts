import { differenceInMinutes, format, isSameDay, parseISO } from 'date-fns';

import { getReconciliationForShift } from '@/services/reconciliationService';
import { getMachineLabelForShift } from '@/services/shiftReadingsService';
import { getUser } from '@/services/usersService';
import { listShiftsForCashSheetMerge, shiftPumpDayIso } from '@/services/shiftsService';
import type { Shift, ShiftLabel } from '@/types/entities';
import { SHIFT_LABELS } from '@/types/entities';
import {
  machineTag,
  parseAttendantPosts,
  postsFromNamesAndMachineLabel,
} from '@/utils/attendantPosts';
import { formatMachineNumbers } from '@/utils/machineDisplay';
import {
  attendantNameList,
  formatAttendantNames,
  formatClock12,
  formatDurationMinutes,
  PRIMARY_SHIFT_LABELS,
  shiftActivitySlotForLabel,
  shiftLabelForActivitySlot,
  shiftScheduleForLabel,
  type ShiftActivitySlot,
  type ShiftActivityStatus,
  type ShiftScheduleMeta,
} from '@/utils/shiftStatusDisplay';

export type ShiftMachineHolder = {
  name: string;
  machineNumber: string;
  machineLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  durationLabel: string;
};

export type ShiftStatusRow = {
  slot: ShiftActivitySlot;
  shiftLabel: ShiftLabel;
  displayName: string;
  shiftId: string | null;
  /** Who started the shift; "—" when it has not been started. */
  operatorName: string;
  /** Pump staff recorded on this shift only (never the starter fallback). */
  presentNames: string[];
  attendant: string;
  attendantMissing: boolean;
  /** e.g. "M1" or "M1, M2" from nozzles assigned to this shift; "—" when none. */
  machineLabel: string;
  machineHolders: ShiftMachineHolder[];
  startTimeLabel: string;
  endTimeLabel: string;
  durationLabel: string;
  scheduledStartLabel: string;
  scheduledEndLabel: string;
  scheduledDurationLabel: string;
  status: ShiftActivityStatus;
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

function shiftsForLabel(shifts: Shift[], label: ShiftLabel): Shift[] {
  return shifts
    .filter((s) => s.shiftLabel.trim() === label)
    .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
}

function pickShiftForLabel(shifts: Shift[], label: ShiftLabel): Shift | undefined {
  const matches = shiftsForLabel(shifts, label);
  if (matches.length === 0) return undefined;
  const byNewest = [...matches].sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis());
  return byNewest.find((s) => s.status === 'open') ?? byNewest[0];
}

function pushUniqueName(out: string[], seen: Set<string>, raw: string): void {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return;
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(name);
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

function namesRecordedOnShift(shift: Shift): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of attendantNameList(shift.pumpAttendants)) {
    pushUniqueName(out, seen, n);
  }
  for (const post of parseAttendantPosts(shift.attendantPosts)) {
    pushUniqueName(out, seen, post.name);
  }
  return out;
}

async function presentNamesFromShifts(shifts: Shift[]): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const shift of shifts) {
    const recorded = namesRecordedOnShift(shift);
    if (recorded.length > 0) {
      for (const n of recorded) pushUniqueName(out, seen, n);
      continue;
    }
    const op = await getUser(shift.operatorId);
    pushUniqueName(out, seen, op?.name?.trim() || shift.operatorId);
  }
  return out;
}

function clockTimesForShift(shift: Shift, now: Date): Pick<ShiftMachineHolder, 'startTimeLabel' | 'endTimeLabel' | 'durationLabel'> {
  const startAt = shift.startTime.toDate();
  const endAt = shift.endTime?.toDate() ?? (shift.status === 'open' ? now : startAt);
  return {
    startTimeLabel: formatShiftTime(startAt),
    endTimeLabel: shift.endTime ? formatShiftTime(shift.endTime.toDate()) : '—',
    durationLabel: formatDurationMinutes(differenceInMinutes(endAt, startAt)),
  };
}

function withShiftTimes(holders: ShiftMachineHolder[], shift: Shift, now: Date): ShiftMachineHolder[] {
  const times = clockTimesForShift(shift, now);
  return holders.map((h) => ({ ...h, ...times }));
}

function machineHoldersForShift(shift: Shift | undefined, machineLabel: string): ShiftMachineHolder[] {
  if (!shift) return [];
  const posts = parseAttendantPosts(shift.attendantPosts);
  const names = namesRecordedOnShift(shift);
  const resolved =
    posts.length > 0 ? posts : postsFromNamesAndMachineLabel(names, machineLabel);
  return resolved.map((post) => ({
    name: post.name,
    machineNumber: post.machineNumber,
    machineLabel: machineTag(post.machineNumber),
    startTimeLabel: '—',
    endTimeLabel: '—',
    durationLabel: '—',
  }));
}

function uniqueHolders(holders: ShiftMachineHolder[]): ShiftMachineHolder[] {
  const seen = new Set<string>();
  const out: ShiftMachineHolder[] = [];
  for (const h of holders) {
    const key = `${h.name.toLowerCase()}|${h.machineNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

async function mergedMachinesForShifts(
  shifts: Shift[],
  now: Date,
): Promise<{ machineLabel: string; machineHolders: ShiftMachineHolder[] }> {
  const holders: ShiftMachineHolder[] = [];
  const machineNums: string[] = [];
  for (const shift of shifts) {
    const label = await getMachineLabelForShift(shift.id);
    if (label !== '—') {
      machineNums.push(
        ...label
          .split(/[,;]+/)
          .map((x) => x.trim().replace(/^M/i, ''))
          .filter(Boolean),
      );
    }
    let list = machineHoldersForShift(shift, label);
    if (list.length === 0 && label !== '—') {
      const recorded = namesRecordedOnShift(shift);
      let who = recorded;
      if (who.length === 0) {
        const op = await getUser(shift.operatorId);
        const opName = op?.name?.trim() || shift.operatorId;
        if (opName) who = [opName];
      }
      list = machineHoldersForShift({ ...shift, pumpAttendants: who.join(', ') }, label);
    }
    holders.push(...withShiftTimes(list, shift, now));
  }
  return {
    machineLabel: formatMachineNumbers(machineNums),
    machineHolders: uniqueHolders(holders),
  };
}

async function resolveSlotStatus(
  slotShifts: Shift[],
  label: ShiftLabel,
  meta: ShiftScheduleMeta,
  pumpDayIso: string,
  now: Date,
  isToday: boolean,
): Promise<{ status: ShiftActivityStatus; minutesSinceEnd: number | null; primary: Shift | undefined }> {
  const primary = pickShiftForLabel(slotShifts, label);
  if (slotShifts.length === 0) {
    return { ...(await resolveActivityStatus(undefined, meta, pumpDayIso, now, isToday)), primary: undefined };
  }
  if (slotShifts.some((s) => s.status === 'open')) {
    return { status: 'active', minutesSinceEnd: null, primary };
  }
  let pending = false;
  let minutesSinceEnd: number | null = null;
  for (const shift of slotShifts) {
    const next = await resolveActivityStatus(shift, meta, pumpDayIso, now, isToday);
    if (next.status === 'reconciliation_pending') {
      pending = true;
      if (next.minutesSinceEnd != null) {
        minutesSinceEnd =
          minutesSinceEnd == null ? next.minutesSinceEnd : Math.min(minutesSinceEnd, next.minutesSinceEnd);
      }
    }
  }
  if (pending) {
    return { status: 'reconciliation_pending', minutesSinceEnd, primary };
  }
  return { status: 'completed', minutesSinceEnd: null, primary };
}

async function buildRow(
  label: ShiftLabel,
  shifts: Shift[],
  pumpDayIso: string,
  now: Date,
  isToday: boolean,
): Promise<ShiftStatusRow> {
  const meta = shiftScheduleForLabel(label)!;
  const slotShifts = shiftsForLabel(shifts, label);
  const liveShifts = slotShifts.filter((s) => s.status === 'open');
  const { status, minutesSinceEnd, primary: shift } = await resolveSlotStatus(
    slotShifts,
    label,
    meta,
    pumpDayIso,
    now,
    isToday,
  );

  const presentNames = await presentNamesFromShifts(liveShifts);
  const attendant = presentNames.length > 0 ? formatAttendantNames(presentNames.join(', ')) : '—';

  let operatorName = '—';
  if (shift) {
    const op = await getUser(shift.operatorId);
    operatorName = op?.name?.trim() || shift.operatorId;
  }

  const schedStart = scheduledStartOnPumpDay(pumpDayIso, meta);
  const schedEnd = scheduledEndOnPumpDay(pumpDayIso, meta);

  const earliest = slotShifts[0];
  const startTimeLabel = earliest
    ? formatShiftTime(earliest.startTime.toDate())
    : formatClock12(meta.startHour, meta.startMinute);
  const ended = [...slotShifts].reverse().find((s) => s.endTime);
  const endTimeLabel = ended?.endTime
    ? formatShiftTime(ended.endTime.toDate())
    : formatClock12(meta.endHour, meta.endMinute);

  let durationLabel = formatDurationMinutes(differenceInMinutes(schedEnd, schedStart));
  if (earliest) {
    const end = ended?.endTime?.toDate() ?? (status === 'active' ? now : schedEnd);
    durationLabel = formatDurationMinutes(differenceInMinutes(end, earliest.startTime.toDate()));
  }

  const { machineLabel, machineHolders } = await mergedMachinesForShifts(liveShifts, now);
  const slot = shiftActivitySlotForLabel(label) ?? 'morning';
  const scheduledStartLabel = formatClock12(meta.startHour, meta.startMinute);
  const scheduledEndLabel = formatClock12(meta.endHour, meta.endMinute);
  const scheduledDurationLabel = formatDurationMinutes(differenceInMinutes(schedEnd, schedStart));

  return {
    slot,
    shiftLabel: label,
    displayName: meta.displayName,
    shiftId: shift?.id ?? null,
    operatorName,
    presentNames,
    attendant,
    attendantMissing: liveShifts.length > 0 && presentNames.length === 0,
    machineLabel,
    machineHolders,
    startTimeLabel,
    endTimeLabel,
    durationLabel,
    scheduledStartLabel,
    scheduledEndLabel,
    scheduledDurationLabel,
    status,
    minutesSinceEnd,
  };
}

export async function getShiftActivityForSlot(
  pumpDayIso: string,
  slot: ShiftActivitySlot,
  now = new Date(),
): Promise<ShiftStatusRow> {
  const summary = await getShiftStatusForPumpDay(pumpDayIso, now);
  const label = shiftLabelForActivitySlot(slot);
  return summary.rows.find((row) => row.shiftLabel === label) ?? summary.rows[0];
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
