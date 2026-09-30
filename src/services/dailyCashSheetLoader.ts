import { listLedgerInRange } from '@/services/ledgerService';
import { listAllReconciliations } from '@/services/reportsHelpers';
import { getShift, listShiftsForCashSheetMerge } from '@/services/shiftsService';
import type { Shift } from '@/types/entities';
import { buildDailyCashSheet, type DailyCashSheetRow } from '@/utils/dailyCashSheet';
import { calendarIsoForShift } from '@/utils/dailyCashBookVertical';
import { roundMoney2, summarizeMeterSalesForShift } from '@/utils/meterSalesByFuel';

/** Same single-day row as Daily Cash Sheet for `iso` (yyyy-MM-dd). */
export async function getDailyCashSheetRowForIso(iso: string): Promise<DailyCashSheetRow | null> {
  const fromD = new Date(`${iso}T00:00:00`);
  const toD = new Date(`${iso}T23:59:59.999`);

  const [ledger, recons] = await Promise.all([
    listLedgerInRange(fromD, toD),
    listAllReconciliations(),
  ]);

  const shiftIds = [...new Set(recons.map((r) => r.shiftId))];
  const pairs = await Promise.all(shiftIds.map(async (id) => [id, await getShift(id)] as const));
  const shiftByShiftId = new Map<string, Shift | null>();
  for (const [id, sh] of pairs) {
    shiftByShiftId.set(id, sh);
  }

  const shiftsInReportRange = await listShiftsForCashSheetMerge(fromD, toD);
  for (const s of shiftsInReportRange) {
    if (!shiftByShiftId.has(s.id)) {
      shiftByShiftId.set(s.id, s);
    }
  }

  const meterSalesByIso = new Map<string, number>();
  for (const [id, sh] of shiftByShiftId) {
    if (!sh) continue;
    const calIso = calendarIsoForShift(sh);
    if (!calIso) continue;
    const meter = await summarizeMeterSalesForShift(id);
    if (meter.total <= 0) continue;
    meterSalesByIso.set(calIso, roundMoney2((meterSalesByIso.get(calIso) ?? 0) + meter.total));
  }

  const built = buildDailyCashSheet(
    { start: fromD, end: toD },
    ledger,
    recons,
    shiftByShiftId,
    undefined,
    meterSalesByIso,
  );

  return built.find((r) => r.dateIso === iso) ?? built[0] ?? null;
}
