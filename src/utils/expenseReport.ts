import { format } from 'date-fns';
import type { LedgerEntry } from '@/types/entities';

export type ExpenseReportFilter =
  | 'all'
  | 'EXPENSES'
  | 'SALARY'
  | 'ADVANCE SALARY'
  | 'MAINTENANCE'
  | 'MISC';

export const EXPENSE_REPORT_FILTERS: { value: ExpenseReportFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'EXPENSES', label: 'EXPENSES' },
  { value: 'SALARY', label: 'SALARY' },
  { value: 'ADVANCE SALARY', label: 'ADVANCE SALARY' },
  { value: 'MAINTENANCE', label: 'MAINTENANCE' },
  { value: 'MISC', label: 'MISC' },
];

const CHIP_ORDER: readonly Exclude<ExpenseReportFilter, 'all'>[] = [
  'EXPENSES',
  'MAINTENANCE',
  'MISC',
  'SALARY',
  'ADVANCE SALARY',
];

export type ExpenseReportRow = {
  id: string;
  dateIso: string;
  dateLabel: string;
  name: string;
  particular: string;
  category: string;
  categoryKey: Exclude<ExpenseReportFilter, 'all'>;
  amount: number;
};

function normalizeCat(category: string): string {
  return category.trim().toUpperCase().replace(/\s+/g, ' ');
}

function dashIfBlank(raw: string): string {
  const t = raw.trim();
  return t.length > 0 ? t : '—';
}

export function stationOutgoCategoryKey(
  category: string,
): Exclude<ExpenseReportFilter, 'all'> | null {
  const c = normalizeCat(category);
  if (c.includes('ADVANCE')) return 'ADVANCE SALARY';
  if (c === 'SALARY') return 'SALARY';
  if (c === 'EXPENSES') return 'EXPENSES';
  if (c === 'MAINTENANCE') return 'MAINTENANCE';
  if (c === 'MISC') return 'MISC';
  return null;
}

export function buildExpenseReportRows(entries: LedgerEntry[]): ExpenseReportRow[] {
  return entries
    .map((e) => {
      const categoryKey = stationOutgoCategoryKey(e.category);
      if (!categoryKey) return null;
      const d = e.date.toDate();
      return {
        id: e.id,
        dateIso: format(d, 'yyyy-MM-dd'),
        dateLabel: format(d, 'dd-MMM-yyyy'),
        name: dashIfBlank(e.paidToOrReceivedFrom),
        particular: dashIfBlank(e.particulars),
        category: e.category.trim() || categoryKey,
        categoryKey,
        amount: e.amount,
      };
    })
    .filter((r): r is ExpenseReportRow => r != null)
    .sort((a, b) => {
      const byDate = a.dateIso.localeCompare(b.dateIso);
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

export function filterExpenseReportRows(
  rows: ExpenseReportRow[],
  filter: ExpenseReportFilter,
): ExpenseReportRow[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => r.categoryKey === filter);
}

export function expenseCategoryTotals(
  rows: ExpenseReportRow[],
): { key: Exclude<ExpenseReportFilter, 'all'>; amount: number }[] {
  const t: Partial<Record<Exclude<ExpenseReportFilter, 'all'>, number>> = {};
  for (const r of rows) {
    t[r.categoryKey] = (t[r.categoryKey] ?? 0) + r.amount;
  }
  return CHIP_ORDER.filter((k) => (t[k] ?? 0) > 0).map((k) => ({
    key: k,
    amount: t[k]!,
  }));
}

export function expenseGrandTotal(rows: ExpenseReportRow[]): number {
  return rows.reduce((s, r) => s + r.amount, 0);
}

export function expenseRangeLabel(fromIso: string, toIso: string): string {
  const a = format(new Date(`${fromIso}T00:00:00`), 'dd-MMM-yyyy');
  const b = format(new Date(`${toIso}T00:00:00`), 'dd-MMM-yyyy');
  return `${a} – ${b}`;
}
