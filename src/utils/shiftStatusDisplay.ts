import { SHIFT_LABELS, type ShiftLabel } from '@/types/entities';

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

export function shiftScheduleForLabel(label: string): ShiftScheduleMeta | undefined {
  return SHIFT_SCHEDULE.find((s) => s.label === label.trim());
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

export function formatAttendantNames(raw: string | undefined): string {
  if (!raw?.trim()) return '—';
  const names = raw
    .split(/[,;|\n]+/)
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : '—';
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
