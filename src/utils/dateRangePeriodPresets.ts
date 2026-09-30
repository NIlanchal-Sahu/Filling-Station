import { format, startOfMonth, startOfWeek, subDays } from 'date-fns';

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export function formatDateRangeLabel(fromIso: string, toIso: string): string {
  try {
    const fromDate = new Date(`${fromIso}T00:00:00`);
    const toDate = new Date(`${toIso}T00:00:00`);
    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      return `${fromIso} — ${toIso}`;
    }
    if (fromIso === toIso) {
      return format(fromDate, 'dd MMM yyyy');
    }
    return `${format(fromDate, 'dd MMM yyyy')} — ${format(toDate, 'dd MMM yyyy')}`;
  } catch {
    return `${fromIso} — ${toIso}`;
  }
}

export function getPresetDates(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'yesterday': {
      const yStr = format(subDays(now, 1), 'yyyy-MM-dd');
      return { from: yStr, to: yStr };
    }
    case 'this_week': {
      const wStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return { from: wStr, to: todayStr };
    }
    case 'this_month': {
      const mStr = format(startOfMonth(now), 'yyyy-MM-dd');
      return { from: mStr, to: todayStr };
    }
    case 'custom':
    default:
      return null;
  }
}

export function detectPreset(fromIso: string, toIso: string): DatePreset {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  if (fromIso === todayStr && toIso === todayStr) return 'today';
  const yStr = format(subDays(now, 1), 'yyyy-MM-dd');
  if (fromIso === yStr && toIso === yStr) return 'yesterday';
  const wStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (fromIso === wStr && toIso === todayStr) return 'this_week';
  const mStr = format(startOfMonth(now), 'yyyy-MM-dd');
  if (fromIso === mStr && toIso === todayStr) return 'this_month';
  return 'custom';
}

export function applyPeriodPreset(
  preset: DatePreset,
  current: { from: string; to: string },
): { preset: DatePreset; from: string; to: string } {
  if (preset === 'custom') {
    return { preset, from: current.from, to: current.to };
  }
  const dates = getPresetDates(preset);
  if (!dates) {
    return { preset, from: current.from, to: current.to };
  }
  return { preset, from: dates.from, to: dates.to };
}
