import { isSameDay, parseISO } from 'date-fns';

import { SHIFT_LABELS, type ShiftLabel } from '@/types/entities';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

export const SHIFT_ACTIVITY_SLOTS = ['morning', 'evening', 'night'] as const;
export type ShiftActivitySlot = (typeof SHIFT_ACTIVITY_SLOTS)[number];

export type ShiftActivityStatus =
  | 'not_started'
  | 'active'
  | 'completed'
  | 'overdue'
  | 'reconciliation_pending';

export const SHIFT_STATUS_UPDATED_EVENT = 'pumpstock:shift-status-updated';

export function notifyShiftStatusUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHIFT_STATUS_UPDATED_EVENT));
  }
}

export type ShiftScheduleMeta = {
  label: ShiftLabel;
  displayName: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight: boolean;
};

export const SHIFT_SCHEDULE: ShiftScheduleMeta[] = [
  {
    label: '6 AM – 2 PM',
    displayName: 'Morning Shift',
    startHour: 6,
    startMinute: 0,
    endHour: 14,
    endMinute: 0,
    crossesMidnight: false,
  },
  {
    label: '2 PM – 10 PM',
    displayName: 'Evening Shift',
    startHour: 14,
    startMinute: 0,
    endHour: 22,
    endMinute: 0,
    crossesMidnight: false,
  },
  {
    label: '10 PM – 6 AM',
    displayName: 'Night Shift',
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
    crossesMidnight: true,
  },
];

/** Primary day shifts shown in summary (morning + evening). */
export const PRIMARY_SHIFT_LABELS: ShiftLabel[] = [SHIFT_LABELS[0], SHIFT_LABELS[1]];

export function shiftActivitySlotForLabel(label: string): ShiftActivitySlot | null {
  const trimmed = label.trim();
  if (trimmed === SHIFT_LABELS[0]) return 'morning';
  if (trimmed === SHIFT_LABELS[1]) return 'evening';
  if (trimmed === SHIFT_LABELS[2]) return 'night';
  return null;
}

export function shiftLabelForActivitySlot(slot: ShiftActivitySlot): ShiftLabel {
  if (slot === 'evening') return SHIFT_LABELS[1];
  if (slot === 'night') return SHIFT_LABELS[2];
  return SHIFT_LABELS[0];
}

export function parseShiftActivitySlot(raw: string | null | undefined): ShiftActivitySlot {
  const s = raw?.trim().toLowerCase();
  if (s === 'evening' || s === 'night' || s === 'morning') return s;
  return 'morning';
}

export function shiftActivityPath(opts: {
  owner: boolean;
  pumpDayIso: string;
  slot: ShiftActivitySlot;
}): string {
  const base = opts.owner ? '/owner/shift-activity' : '/manager/shift-activity';
  return withPumpDayQuery(`${base}?slot=${opts.slot}`, opts.pumpDayIso);
}

export function shiftScheduleForLabel(label: string): ShiftScheduleMeta | undefined {
  return SHIFT_SCHEDULE.find((s) => s.label === label.trim());
}

export function shiftOptionLabel(label: string): string {
  const meta = shiftScheduleForLabel(label);
  if (!meta) {
    return label;
  }
  return `${meta.displayName} (${meta.label})`;
}

export function shiftStatusLabel(status: ShiftActivityStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'not_started') return 'Not Started';
  if (status === 'completed') return 'Completed';
  if (status === 'overdue') return 'Shift Overdue';
  return 'Reconciliation Pending';
}

export function shiftStatusEmoji(status: ShiftActivityStatus): string {
  if (status === 'active') return '🟢';
  if (status === 'not_started') return '⚪';
  if (status === 'completed') return '🔵';
  if (status === 'overdue') return '🔴';
  return '🟠';
}

export function shiftStatusChipColor(
  status: ShiftActivityStatus,
): 'default' | 'success' | 'info' | 'error' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'completed') return 'info';
  if (status === 'overdue') return 'error';
  if (status === 'reconciliation_pending') return 'warning';
  return 'default';
}

export type ShiftUiPhase = 'upcoming' | 'live' | 'overdue' | 'ended' | 'recon_pending' | 'idle';

function scheduledStartOnPumpDay(pumpDayIso: string, meta: ShiftScheduleMeta): Date {
  return parseISO(
    `${pumpDayIso}T${String(meta.startHour).padStart(2, '0')}:${String(meta.startMinute).padStart(2, '0')}:00`,
  );
}

export function shiftUiPhase(
  status: ShiftActivityStatus,
  pumpDayIso: string,
  shiftLabel: string,
  shiftId: string | null,
  now = new Date(),
): ShiftUiPhase {
  if (status === 'active') return 'live';
  if (status === 'overdue') return 'overdue';
  if (status === 'reconciliation_pending') return 'recon_pending';
  if (status === 'completed') return 'ended';

  const meta = shiftScheduleForLabel(shiftLabel);
  if (!meta) return 'idle';

  const pumpDay = parseISO(`${pumpDayIso}T12:00:00`);
  const isToday = isSameDay(pumpDay, now);
  if (!isToday) {
    return shiftId ? 'ended' : 'idle';
  }

  const schedStart = scheduledStartOnPumpDay(pumpDayIso, meta);
  if (now.getTime() < schedStart.getTime()) {
    return 'upcoming';
  }

  return 'idle';
}

export type ShiftUiSurface = {
  bg: string;
  border: string;
  accent: string;
  chipLabel: string;
};

export function shiftUiSurface(phase: ShiftUiPhase): ShiftUiSurface {
  switch (phase) {
    case 'upcoming':
      return {
        bg: 'rgba(22, 163, 74, 0.1)',
        border: 'rgba(22, 163, 74, 0.38)',
        accent: '#16a34a',
        chipLabel: 'Upcoming',
      };
    case 'live':
      return {
        bg: 'rgba(14, 165, 233, 0.12)',
        border: 'rgba(14, 165, 233, 0.42)',
        accent: '#0284c7',
        chipLabel: 'Live',
      };
    case 'overdue':
      return {
        bg: 'rgba(234, 88, 12, 0.14)',
        border: 'rgba(234, 88, 12, 0.48)',
        accent: '#ea580c',
        chipLabel: 'Overdue',
      };
    case 'ended':
      return {
        bg: 'rgba(100, 116, 139, 0.1)',
        border: 'rgba(100, 116, 139, 0.32)',
        accent: '#64748b',
        chipLabel: 'Ended',
      };
    case 'recon_pending':
      return {
        bg: 'rgba(217, 119, 6, 0.12)',
        border: 'rgba(217, 119, 6, 0.42)',
        accent: '#d97706',
        chipLabel: 'Recon pending',
      };
    default:
      return {
        bg: 'rgba(100, 116, 139, 0.08)',
        border: 'rgba(100, 116, 139, 0.22)',
        accent: '#64748b',
        chipLabel: 'Not started',
      };
  }
}

export function shiftLifecycleLabel(status: ShiftActivityStatus, shiftId: string | null): string {
  if (status === 'active') return 'Live — shift started';
  if (status === 'overdue') {
    return shiftId ? 'Overdue — action needed' : 'Overdue — not started on time';
  }
  if (status === 'completed') return 'Ended — reconciled and closed';
  if (status === 'reconciliation_pending') return 'Ended — reconciliation pending';
  return 'Not started';
}

export function formatAttendantNames(raw: string | undefined): string {
  const names = attendantNameList(raw);
  return names.length > 0 ? names.join(', ') : '—';
}

export function attendantNameList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|\n]+/)
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/** Persist selected roster names on one shift (same format reports already parse). */
export function joinAttendantNames(names: string[]): string {
  return names
    .map((n) => n.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ');
}

export function formatClock12(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
}

export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}
