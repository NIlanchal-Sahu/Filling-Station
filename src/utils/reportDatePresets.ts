import { endOfMonth, format, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';

export type DateRangeIso = { from: string; to: string };

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Local calendar day for preset anchors. */
function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function presetToday(): DateRangeIso {
  const t = todayLocal();
  const iso = toIso(t);
  return { from: iso, to: iso };
}

/** First day of current month through last day of current month. */
export function presetThisMonth(): DateRangeIso {
  const t = todayLocal();
  return {
    from: toIso(startOfMonth(t)),
    to: toIso(endOfMonth(t)),
  };
}

/** Full previous calendar month. */
export function presetLastMonth(): DateRangeIso {
  const t = todayLocal();
  const prev = subMonths(t, 1);
  return {
    from: toIso(startOfMonth(prev)),
    to: toIso(endOfMonth(prev)),
  };
}

export function presetYesterday(): DateRangeIso {
  const t = todayLocal();
  const iso = toIso(subDays(t, 1));
  return { from: iso, to: iso };
}

/** Monday-start week through today. */
export function presetThisWeek(): DateRangeIso {
  const t = todayLocal();
  return {
    from: toIso(startOfWeek(t, { weekStartsOn: 1 })),
    to: toIso(t),
  };
}

export type DateRangePresetId =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month';

export function applyDateRangePreset(id: DateRangePresetId): DateRangeIso {
  if (id === 'today') return presetToday();
  if (id === 'yesterday') return presetYesterday();
  if (id === 'this_week') return presetThisWeek();
  if (id === 'last_month') return presetLastMonth();
  return presetThisMonth();
}

/** Clamp so from <= to (ISO yyyy-MM-dd). */
export function syncDateRange(from: string, to: string, changed: 'from' | 'to'): DateRangeIso {
  if (!from.trim() || !to.trim()) {
    return { from, to };
  }
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { from, to };
  }
  if (a <= b) {
    return { from, to };
  }
  if (changed === 'from') {
    return { from, to: from };
  }
  return { from: to, to };
}

export function formatRangeCaption(fromIso: string, toIso: string): string | null {
  if (!fromIso.trim() || !toIso.trim()) return null;
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const left = format(a, 'dd-MMM-yyyy');
  const right = format(b, 'dd-MMM-yyyy');
  const days =
    Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (fromIso === toIso) {
    return `${left} · 1 day`;
  }
  return `${left} – ${right} · ${days} days`;
}
