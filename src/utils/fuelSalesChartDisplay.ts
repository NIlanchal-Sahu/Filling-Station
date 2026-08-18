import { endOfMonth, format, parseISO, startOfMonth, subDays } from 'date-fns';

export type SalesByFuelPeriod = 'daily' | 'weekly' | 'monthly';

export function resolveSalesByFuelRange(
  anchorIso: string,
  period: SalesByFuelPeriod,
): { fromIso: string; toIso: string; label: string } {
  const anchor = parseISO(`${anchorIso}T12:00:00`);

  if (period === 'daily') {
    return {
      fromIso: anchorIso,
      toIso: anchorIso,
      label: format(anchor, 'dd MMM yyyy'),
    };
  }

  if (period === 'weekly') {
    const from = subDays(anchor, 6);
    return {
      fromIso: format(from, 'yyyy-MM-dd'),
      toIso: anchorIso,
      label: `${format(from, 'dd MMM')} – ${format(anchor, 'dd MMM yyyy')}`,
    };
  }

  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  return {
    fromIso: format(from, 'yyyy-MM-dd'),
    toIso: format(to, 'yyyy-MM-dd'),
    label: format(anchor, 'MMMM yyyy'),
  };
}

export const FUEL_CHART_COLORS: Record<'MS' | 'HSD' | 'XP', string> = {
  MS: '#ef5350',
  HSD: '#29b6f6',
  XP: '#ffa726',
};

export function fmtChartRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtChartLiters(n: number): string {
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
}
