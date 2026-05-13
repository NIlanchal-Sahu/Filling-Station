import { format } from 'date-fns';
import type { LedgerEntry, Shift, ShiftReconciliation } from '@/types/entities';
import {
  buildCashBookSummary,
  fmtInrDash,
  type CashBookSummaryRow,
} from '@/utils/cashBookSummary';
import { roundMoney2, summarizeMeterSalesForShifts } from '@/utils/meterSalesByFuel';

export function calendarIsoForShift(shift: Shift | null | undefined): string {
  if (!shift) return '';
  const cal = shift.calendarDate?.trim();
  if (cal && /^\d{4}-\d{2}-\d{2}$/.test(cal)) return cal;
  return format(shift.startTime.toDate(), 'yyyy-MM-dd');
}

/** One reconciliation per shift (latest non-rejected by created time). */
export function latestReconciliationsPerShift(recons: ShiftReconciliation[]): ShiftReconciliation[] {
  const byShift = new Map<string, ShiftReconciliation>();
  for (const r of recons) {
    if (r.status === 'rejected') continue;
    const prev = byShift.get(r.shiftId);
    if (!prev || r.createdAt.toMillis() > prev.createdAt.toMillis()) {
      byShift.set(r.shiftId, r);
    }
  }
  return [...byShift.values()];
}

export function reconsForCalendarDay(
  iso: string,
  recons: ShiftReconciliation[],
  shiftByShiftId: Map<string, Shift | null | undefined>,
): ShiftReconciliation[] {
  const latest = latestReconciliationsPerShift(recons);
  return latest.filter(
    (r) => calendarIsoForShift(shiftByShiftId.get(r.shiftId) ?? undefined) === iso,
  );
}

export function ledgerEntriesForCalendarDay(iso: string, ledger: LedgerEntry[]): LedgerEntry[] {
  return ledger.filter((e) => format(e.date.toDate(), 'yyyy-MM-dd') === iso);
}

const SALES_EPS = 0.01;

/** Shifts whose business calendar day matches `iso` (keys from the merged shift map). */
export function shiftIdsForCalendarIso(
  iso: string,
  shiftByShiftId: Map<string, Shift | null | undefined>,
): string[] {
  const out: string[] = [];
  for (const id of shiftByShiftId.keys()) {
    const sh = shiftByShiftId.get(id);
    if (calendarIsoForShift(sh ?? undefined) === iso) {
      out.push(id);
    }
  }
  return out;
}

/** Two-column cash book block (like Excel) for one calendar day. */
export async function buildVerticalCashBookForDay(
  dateIso: string,
  ledgerAll: LedgerEntry[],
  recons: ShiftReconciliation[],
  shiftByShiftId: Map<string, Shift | null | undefined>,
  options?: { openingBalanceOverride?: number },
): Promise<CashBookSummaryRow[]> {
  const dayLedger = ledgerEntriesForCalendarDay(dateIso, ledgerAll);
  const dayRecons = reconsForCalendarDay(dateIso, recons, shiftByShiftId);

  const shiftIdsOnDay = shiftIdsForCalendarIso(dateIso, shiftByShiftId);
  const meter = await summarizeMeterSalesForShifts(shiftIdsOnDay);
  const reconTotalSales = dayRecons.reduce((s, r) => s + r.totalSalesAmount, 0);
  const totalSales =
    meter.total > SALES_EPS ? meter.total : roundMoney2(reconTotalSales);

  const paytm = dayRecons.reduce((s, r) => s + r.paytmOnline, 0);
  const icici = dayRecons.reduce((s, r) => s + r.iciciCard, 0);
  const fleet = dayRecons.reduce((s, r) => s + r.fleetCard, 0);
  const credit = dayRecons.reduce((s, r) => s + r.creditAmount, 0);
  const differenceSumForShort = dayRecons.reduce((s, r) => s + r.difference, 0);
  const explicitShortSum = dayRecons.reduce((s, r) => s + (r.shortAmount ?? 0), 0);

  return buildCashBookSummary({
    totalSales,
    paytm,
    icici,
    fleet,
    credit,
    explicitShortSum,
    differenceSumForShort,
    ledgerSameDay: dayLedger,
    sheetStyleOutflows: true,
    openingBalanceOverride: options?.openingBalanceOverride,
  });
}

export function cashBookAmtDisplay(r: CashBookSummaryRow): string {
  const t = fmtInrDash(r.amount, r.alwaysShowAmount ?? false);
  return t === '—' ? '—' : `₹ ${t}`;
}
