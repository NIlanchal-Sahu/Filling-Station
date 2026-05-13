import { listReadingsForShift } from '@/services/shiftReadingsService';
import { getNozzle } from '@/services/nozzlesService';
import { getFuelType } from '@/services/fuelTypesService';
import { getReconciliationForShift } from '@/services/reconciliationService';
import {
  listClosedShiftsByPumpDayRange,
  listClosedShiftsInEndTimeWindow,
  shiftPumpDayIso,
} from '@/services/shiftsService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { getUser } from '@/services/usersService';
import { listAllReconciliations, listReconciliationsInWindow } from '@/services/reportsHelpers';
import { listAllLedgerForBalance } from '@/services/ledgerService';
import type { LedgerEntry } from '@/types/entities';
import { latestReconciliationsPerShift } from '@/utils/dailyCashBookVertical';
import { totalCashFromMeterAndChannels, roundMoney2 } from '@/utils/meterSalesByFuel';
import { eachDayOfInterval, format } from 'date-fns';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type FuelTotals = { fuelTypeName: string; liters: number; amount: number };

export async function getTodaySalesByFuelType(now = new Date()): Promise<FuelTotals[]> {
  const s = startOfDay(now);
  const e = endOfDay(now);
  const closed = await listClosedShiftsInEndTimeWindow(s, e);
  const map = new Map<string, { liters: number; amount: number }>();
  for (const sh of closed) {
    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      const n = await getNozzle(r.nozzleId);
      if (!n) {
        continue;
      }
      const ft = await getFuelType(n.fuelTypeId);
      const name = ft?.name ?? 'Unknown';
      const o = map.get(name) ?? { liters: 0, amount: 0 };
      o.liters += r.finalSalesLiters;
      o.amount += r.totalAmount;
      map.set(name, o);
    }
  }
  return Array.from(map.entries()).map(([fuelTypeName, v]) => ({
    fuelTypeName,
    ...v,
  }));
}

/** Sums declared payment columns across reconciliations **created today** (local calendar day). */
export type TodayReconciliationPaymentTotals = {
  cash: number;
  paytmOnline: number;
  iciciCard: number;
  fleetCard: number;
};

export async function getTodayReconciliationPaymentTotals(
  now = new Date(),
): Promise<TodayReconciliationPaymentTotals> {
  const s = startOfDay(now);
  const e = endOfDay(now);
  const recons = await listReconciliationsInWindow(s, e);
  return recons.reduce(
    (acc, r) => ({
      cash: acc.cash + r.cashAmount,
      paytmOnline: acc.paytmOnline + r.paytmOnline,
      iciciCard: acc.iciciCard + r.iciciCard,
      fleetCard: acc.fleetCard + r.fleetCard,
    }),
    { cash: 0, paytmOnline: 0, iciciCard: 0, fleetCard: 0 },
  );
}

export async function getTotalOutstandingCredit(): Promise<number> {
  const customers = await listCreditCustomers(false);
  return customers.reduce((acc, c) => acc + c.currentBalance, 0);
}

/** Matches Ledger page: cash drawer vs bank/UPI settlement. */
function ledgerEntryAffectsCashDrawer(e: LedgerEntry): boolean {
  return e.paymentChannel === 'cash';
}

/**
 * Estimated physical cash drawer:
 *
 * **From shifts:** for each reconciliation that is not **rejected**, meter-style cash =
 * total sales − PhonePe − ICICI − Fleet − credit − short (same Excel rule as reconciliation).
 *
 * **From ledger:** net movement on rows marked **Cash** only (received adds, paid out subtracts).
 * Bank/UPI ledger lines do not change this figure.
 *
 * Pending and approved reconciliations both count so the drawer matches what operators declared.
 * Only the **latest** reconciliation per shift is used (older resubmissions are ignored), same as the daily sheet.
 */
export async function getCashInHandAfterReconciliations(): Promise<number> {
  const [recons, ledger] = await Promise.all([listAllReconciliations(), listAllLedgerForBalance()]);

  const fromMeterFormula = latestReconciliationsPerShift(recons).reduce(
    (sum, r) =>
      sum +
      totalCashFromMeterAndChannels(
        r.totalSalesAmount,
        r.paytmOnline,
        r.iciciCard,
        r.fleetCard,
        r.creditAmount,
        r.shortAmount,
      ),
    0,
  );

  let ledgerCashNet = 0;
  for (const e of ledger) {
    if (!ledgerEntryAffectsCashDrawer(e)) {
      continue;
    }
    ledgerCashNet += e.type === 'income' ? e.amount : -e.amount;
  }

  return roundMoney2(fromMeterFormula + ledgerCashNet);
}

/** Roster row: pump staff named on **Start shift** — shift timing and operator/cashier; no payment split. */
export type PumpAttendantAttendanceRow = {
  /** Pump business day (yyyy-MM-dd) from shift */
  pumpDayIso: string;
  /** DD-MM-YYYY */
  dateLabel: string;
  pumpBoyGirl: string;
  shiftLabel: string;
  operatorName: string;
  /** Local `yyyy-MM-dd HH:mm` */
  startAt: string;
  endAt: string;
  remarks: string;
};

function formatDateDdMmYyyy(localDate: Date): string {
  const dd = String(localDate.getDate()).padStart(2, '0');
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const yyyy = localDate.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function parsePumpAttendants(raw: string): string[] {
  return raw
    .split(/[,;|\n]+/)
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/**
 * **Attendance-style** sheet: one row per name per **closed** shift in the pump-day range.
 * Pump day is **calendar date** chosen on Start shift (falls back to local start date).
 * Shifts with no attendant names emit one row with “—” in the name column.
 */
export async function getPumpAttendantAttendanceRowsInRange(
  from: Date,
  to: Date,
): Promise<PumpAttendantAttendanceRow[]> {
  const shifts = await listClosedShiftsByPumpDayRange(from, to);
  shifts.sort((a, b) => {
    const cmpDay = shiftPumpDayIso(a).localeCompare(shiftPumpDayIso(b));
    if (cmpDay !== 0) return cmpDay;
    return a.startTime.toMillis() - b.startTime.toMillis();
  });

  const rows: PumpAttendantAttendanceRow[] = [];

  for (const sh of shifts) {
    if (!sh.endTime) {
      continue;
    }
    const pumpDayIso = shiftPumpDayIso(sh);
    const dateLabel = formatDateDdMmYyyy(new Date(`${pumpDayIso}T12:00:00`));
    const op = await getUser(sh.operatorId);
    const operatorName = op?.name ?? sh.operatorId;
    const startAt = format(sh.startTime.toDate(), 'yyyy-MM-dd HH:mm');
    const endAt = format(sh.endTime.toDate(), 'yyyy-MM-dd HH:mm');
    const remarks = (sh.notes ?? '').trim().replace(/\s+/g, ' ');
    const shiftLabel = sh.shiftLabel?.trim() || '—';

    const names = parsePumpAttendants(sh.pumpAttendants ?? '');
    if (names.length === 0) {
      rows.push({
        pumpDayIso,
        dateLabel,
        pumpBoyGirl: '—',
        shiftLabel,
        operatorName,
        startAt,
        endAt,
        remarks,
      });
      continue;
    }
    const sortedNames = [...names].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
    for (const nm of sortedNames) {
      rows.push({
        pumpDayIso,
        dateLabel,
        pumpBoyGirl: nm,
        shiftLabel,
        operatorName,
        startAt,
        endAt,
        remarks,
      });
    }
  }

  return rows;
}

function fuelSalesBucket(name: string): 'petrol' | 'diesel' | 'xp' | 'other' {
  const u = name.trim().toUpperCase();
  if (u === 'PETROL' || u.includes('PETROL')) return 'petrol';
  if (u === 'DIESEL' || u.includes('DIESEL')) return 'diesel';
  if (u === 'XP' || u.includes('XP')) return 'xp';
  return 'other';
}

function pivotRound(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** One calendar day × PETROL/DIESEL/XP (± other fuels) litres and ₹ — matches cashier Excel layout. */
export type DailySalesPivotRow = {
  dateIso: string;
  /** e.g. 01-Apr */
  dateLabel: string;
  petrolLiters: number;
  petrolAmount: number;
  dieselLiters: number;
  dieselAmount: number;
  xpLiters: number;
  xpAmount: number;
  otherLiters: number;
  otherAmount: number;
  /** Sum of PETROL+DIESEL+XP+other ₹ for the day */
  totalAmount: number;
};

/**
 * Rows for **each calendar day** in `[from, to]` (inclusive local dates).
 * Meter sales come from readings on shifts **closed with endTime** on that day.
 */
export async function getDailySalesFuelPivot(from: Date, to: Date): Promise<DailySalesPivotRow[]> {
  const intervalStart = startOfDay(from);
  const intervalEnd = startOfDay(to);
  if (intervalStart.getTime() > intervalEnd.getTime()) {
    return [];
  }
  const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
  const out: DailySalesPivotRow[] = [];

  for (const day of days) {
    const s = startOfDay(day);
    const e = endOfDay(day);
    const closed = await listClosedShiftsInEndTimeWindow(s, e);
    let petrolL = 0;
    let petrolAmt = 0;
    let dieselL = 0;
    let dieselAmt = 0;
    let xpL = 0;
    let xpAmt = 0;
    let otherL = 0;
    let otherAmt = 0;

    for (const sh of closed) {
      const readings = await listReadingsForShift(sh.id);
      for (const r of readings) {
        const n = await getNozzle(r.nozzleId);
        if (!n) continue;
        const ft = await getFuelType(n.fuelTypeId);
        const nm = ft?.name ?? 'Unknown';
        const b = fuelSalesBucket(nm);
        const liters = Number(r.finalSalesLiters ?? 0);
        const amt = Number(r.totalAmount ?? 0);
        if (b === 'petrol') {
          petrolL += liters;
          petrolAmt += amt;
        } else if (b === 'diesel') {
          dieselL += liters;
          dieselAmt += amt;
        } else if (b === 'xp') {
          xpL += liters;
          xpAmt += amt;
        } else {
          otherL += liters;
          otherAmt += amt;
        }
      }
    }

    const petrolLiters = pivotRound(petrolL);
    const petrolAmount = pivotRound(petrolAmt);
    const dieselLiters = pivotRound(dieselL);
    const dieselAmount = pivotRound(dieselAmt);
    const xpLiters = pivotRound(xpL);
    const xpAmount = pivotRound(xpAmt);
    const otherLiters = pivotRound(otherL);
    const otherAmount = pivotRound(otherAmt);
    const totalAmount = pivotRound(petrolAmount + dieselAmount + xpAmount + otherAmount);

    out.push({
      dateIso: format(day, 'yyyy-MM-dd'),
      dateLabel: format(day, 'dd-MMM'),
      petrolLiters,
      petrolAmount,
      dieselLiters,
      dieselAmount,
      xpLiters,
      xpAmount,
      otherLiters,
      otherAmount,
      totalAmount,
    });
  }

  return out;
}

export type OperatorPerf = {
  operatorId: string;
  operatorName: string;
  totalLiters: number;
  totalAmount: number;
  shortOverCount: { short: number; over: number; zero: number };
  shortOverSum: number;
};

export async function getOperatorPerformanceInRange(
  from: Date,
  to: Date,
): Promise<OperatorPerf[]> {
  const fromD = startOfDay(from);
  const toD = endOfDay(to);
  const closed = await listClosedShiftsInEndTimeWindow(fromD, toD);
  const byOp = new Map<string, OperatorPerf>();

  for (const sh of closed) {
    const u = await getUser(sh.operatorId);
    const name = u?.name ?? sh.operatorId;
    let p = byOp.get(sh.operatorId);
    if (!p) {
      p = {
        operatorId: sh.operatorId,
        operatorName: name,
        totalLiters: 0,
        totalAmount: 0,
        shortOverCount: { short: 0, over: 0, zero: 0 },
        shortOverSum: 0,
      };
      byOp.set(sh.operatorId, p);
    }
    p.operatorName = name;
    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      p.totalLiters += r.finalSalesLiters;
      p.totalAmount += r.totalAmount;
    }
    const recon = await getReconciliationForShift(sh.id);
    if (recon) {
      const d = recon.difference;
      p.shortOverSum += d;
      if (d < 0) {
        p.shortOverCount.short += 1;
      } else if (d > 0) {
        p.shortOverCount.over += 1;
      } else {
        p.shortOverCount.zero += 1;
      }
    }
  }
  return Array.from(byOp.values());
}
