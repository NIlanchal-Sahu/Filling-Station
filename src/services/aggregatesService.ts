import { listReadingsForShift, getMachineLabelForShift } from '@/services/shiftReadingsService';
import { getNozzle, listNozzles } from '@/services/nozzlesService';
import { getFuelType, listFuelTypes } from '@/services/fuelTypesService';
import { getReconciliationForShift } from '@/services/reconciliationService';
import {
  listClosedShiftsByPumpDayRange,
  listClosedShiftsInEndTimeWindow,
  listShiftsForCashSheetMerge,
  shiftPumpDayIso,
} from '@/services/shiftsService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import { getUser } from '@/services/usersService';
import { listAllReconciliations, listReconciliationsInWindow } from '@/services/reportsHelpers';
import { listAllLedgerForBalance } from '@/services/ledgerService';
import type { LedgerEntry, Shift } from '@/types/entities';
import { SHIFT_LABELS } from '@/types/entities';
import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';
import { latestReconciliationsPerShift } from '@/utils/dailyCashBookVertical';
import { totalCashFromMeterAndChannels, roundMoney2 } from '@/utils/meterSalesByFuel';
import { machineTag, parseAttendantPosts } from '@/utils/attendantPosts';
import { compareNozzleOrder } from '@/utils/nozzleSort';
import { shiftScheduleForLabel } from '@/utils/shiftStatusDisplay';
import { eachDayOfInterval, format, parseISO } from 'date-fns';

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

/** Parties with a balance who have not paid in this many days. */
export const CREDIT_OVERDUE_DAYS = 15;

export type OverdueCreditSummary = {
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
};

export async function getOverdueCreditSummary(now = new Date()): Promise<OverdueCreditSummary> {
  const [customers, payments] = await Promise.all([listCreditCustomers(false), listAllCreditPayments()]);
  const lastPayByCustomer = new Map<string, number>();
  for (const p of payments) {
    const ms = p.date.toMillis();
    const prev = lastPayByCustomer.get(p.customerId) ?? 0;
    if (ms > prev) {
      lastPayByCustomer.set(p.customerId, ms);
    }
  }
  const cutoff = now.getTime() - CREDIT_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
  let outstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const c of customers) {
    const bal = Number(c.currentBalance ?? 0);
    outstanding += bal;
    if (bal <= 0.005) {
      continue;
    }
    const lastPay = lastPayByCustomer.get(c.id);
    if (lastPay == null || lastPay < cutoff) {
      overdueAmount += bal;
      overdueCount += 1;
    }
  }
  return {
    outstanding: roundMoney2(outstanding),
    overdueAmount: roundMoney2(overdueAmount),
    overdueCount,
  };
}

/** Meter sales for a pump day including open shifts, plus recon cash / shortage. */
export type PumpDaySalesOverview = {
  meterSalesAmount: number;
  reconciledSalesAmount: number;
  cashCollected: number;
  shortageAmount: number;
};

export async function getPumpDaySalesOverview(pumpDayIso: string): Promise<PumpDaySalesOverview> {
  const start = parseISO(`${pumpDayIso}T00:00:00`);
  const end = parseISO(`${pumpDayIso}T23:59:59.999`);
  const shifts = (await listShiftsForCashSheetMerge(start, end)).filter(
    (s) => shiftPumpDayIso(s) === pumpDayIso,
  );

  let meterSalesAmount = 0;
  let reconciledSalesAmount = 0;
  let cashCollected = 0;
  let shortageAmount = 0;

  for (const sh of shifts) {
    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      meterSalesAmount += Number(r.totalAmount ?? 0);
    }
    const recon = await getReconciliationForShift(sh.id);
    if (!recon || recon.status === 'rejected') {
      continue;
    }
    cashCollected += Number(recon.cashAmount ?? 0);
    const short = Number(recon.shortAmount ?? 0);
    const diff = Math.abs(Number(recon.difference ?? 0));
    shortageAmount += short > 0.005 ? short : diff > 0.02 ? diff : 0;
    if (recon.status === 'approved') {
      reconciledSalesAmount += Number(recon.totalSalesAmount ?? 0);
    }
  }

  return {
    meterSalesAmount: roundMoney2(meterSalesAmount),
    reconciledSalesAmount: roundMoney2(reconciledSalesAmount),
    cashCollected: roundMoney2(cashCollected),
    shortageAmount: roundMoney2(shortageAmount),
  };
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
  machineLabel: string;
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
    const machineLabel = await getMachineLabelForShift(sh.id);

    const posts = parseAttendantPosts(sh.attendantPosts);
    if (posts.length > 0) {
      const sortedPosts = [...posts].sort((a, b) => {
        const byMachine = a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true });
        if (byMachine !== 0) return byMachine;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      for (const post of sortedPosts) {
        rows.push({
          pumpDayIso,
          dateLabel,
          pumpBoyGirl: post.name,
          shiftLabel,
          operatorName,
          machineLabel: machineTag(post.machineNumber),
          startAt,
          endAt,
          remarks,
        });
      }
      continue;
    }

    const names = parsePumpAttendants(sh.pumpAttendants ?? '');
    if (names.length === 0) {
      rows.push({
        pumpDayIso,
        dateLabel,
        pumpBoyGirl: '—',
        shiftLabel,
        operatorName,
        machineLabel,
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
        machineLabel,
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
  petrolRate: number;
  petrolAmount: number;
  dieselLiters: number;
  dieselRate: number;
  dieselAmount: number;
  xpLiters: number;
  xpRate: number;
  xpAmount: number;
  otherLiters: number;
  otherRate: number;
  otherAmount: number;
  /** Sum of PETROL+DIESEL+XP+other ₹ for the day */
  totalAmount: number;
};

async function catalogRateByBucket(): Promise<Record<'petrol' | 'diesel' | 'xp' | 'other', number>> {
  const fuels = await listFuelTypes();
  const catalog: Record<'petrol' | 'diesel' | 'xp' | 'other', number> = {
    petrol: 0,
    diesel: 0,
    xp: 0,
    other: 0,
  };
  for (const f of fuels) {
    const b = fuelSalesBucket(f.name);
    if (catalog[b] <= 0 && Number(f.currentRate) > 0) {
      catalog[b] = Number(f.currentRate);
    }
  }
  return catalog;
}

function readingSaleRate(rateAtSale: number, currentRate: number): number {
  if (Number.isFinite(rateAtSale) && rateAtSale > 0) return rateAtSale;
  if (Number.isFinite(currentRate) && currentRate > 0) return currentRate;
  return 0;
}

/** RATE shown so PETROL × RATE = AMOUNTS (weighted if mixed rates that day). */
function displayRate(liters: number, amount: number, fallback: number): number {
  if (liters > 0) return pivotRound(amount / liters);
  return pivotRound(fallback);
}

/**
 * Rows for **each calendar day** in `[from, to]` (inclusive local dates).
 * Meter sales sit on the shift **pump day** (Start shift date), not the clock day the shift was closed.
 */
export async function getDailySalesFuelPivot(from: Date, to: Date): Promise<DailySalesPivotRow[]> {
  const intervalStart = startOfDay(from);
  const intervalEnd = startOfDay(to);
  if (intervalStart.getTime() > intervalEnd.getTime()) {
    return [];
  }
  const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
  const [closed, catalog] = await Promise.all([
    listClosedShiftsByPumpDayRange(intervalStart, endOfDay(to)),
    catalogRateByBucket(),
  ]);

  type DayAcc = {
    petrolL: number;
    petrolAmt: number;
    dieselL: number;
    dieselAmt: number;
    xpL: number;
    xpAmt: number;
    otherL: number;
    otherAmt: number;
  };
  const emptyAcc = (): DayAcc => ({
    petrolL: 0,
    petrolAmt: 0,
    dieselL: 0,
    dieselAmt: 0,
    xpL: 0,
    xpAmt: 0,
    otherL: 0,
    otherAmt: 0,
  });
  const byDay = new Map<string, DayAcc>();

  for (const sh of closed) {
    const dayIso = shiftPumpDayIso(sh);
    let acc = byDay.get(dayIso);
    if (!acc) {
      acc = emptyAcc();
      byDay.set(dayIso, acc);
    }
    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      const n = await getNozzle(r.nozzleId);
      if (!n) continue;
      const ft = await getFuelType(n.fuelTypeId);
      const nm = ft?.name ?? 'Unknown';
      const b = fuelSalesBucket(nm);
      const liters = Number(r.finalSalesLiters ?? 0);
      const rate = readingSaleRate(Number(r.rateAtSale ?? 0), Number(ft?.currentRate ?? 0));
      const amt = liters * rate;
      if (b === 'petrol') {
        acc.petrolL += liters;
        acc.petrolAmt += amt;
      } else if (b === 'diesel') {
        acc.dieselL += liters;
        acc.dieselAmt += amt;
      } else if (b === 'xp') {
        acc.xpL += liters;
        acc.xpAmt += amt;
      } else {
        acc.otherL += liters;
        acc.otherAmt += amt;
      }
    }
  }

  const out: DailySalesPivotRow[] = [];
  for (const day of days) {
    const acc = byDay.get(format(day, 'yyyy-MM-dd')) ?? emptyAcc();
    const petrolLiters = pivotRound(acc.petrolL);
    const petrolAmount = pivotRound(acc.petrolAmt);
    const dieselLiters = pivotRound(acc.dieselL);
    const dieselAmount = pivotRound(acc.dieselAmt);
    const xpLiters = pivotRound(acc.xpL);
    const xpAmount = pivotRound(acc.xpAmt);
    const otherLiters = pivotRound(acc.otherL);
    const otherAmount = pivotRound(acc.otherAmt);
    const totalAmount = pivotRound(petrolAmount + dieselAmount + xpAmount + otherAmount);

    out.push({
      dateIso: format(day, 'yyyy-MM-dd'),
      dateLabel: format(day, 'dd-MMM'),
      petrolLiters,
      petrolRate: displayRate(petrolLiters, petrolAmount, catalog.petrol),
      petrolAmount,
      dieselLiters,
      dieselRate: displayRate(dieselLiters, dieselAmount, catalog.diesel),
      dieselAmount,
      xpLiters,
      xpRate: displayRate(xpLiters, xpAmount, catalog.xp),
      xpAmount,
      otherLiters,
      otherRate: displayRate(otherLiters, otherAmount, catalog.other),
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
  const closed = await listClosedShiftsByPumpDayRange(fromD, toD);
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

const SALES_EPS = 0.01;

export type ShiftSalesBucket = {
  shiftKey: 'shift1' | 'shift2';
  displayName: string;
  shiftLabel: string;
  totalAmount: number;
  totalLiters: number;
  transactionCount: number;
  /** Closed shift to open for detail (highest sales in bucket). */
  shiftId: string | null;
};

export type FuelShiftSalesRow = {
  shortCode: 'MS' | 'HSD' | 'XP';
  shift1Liters: number;
  shift1Amount: number;
  shift2Liters: number;
  shift2Amount: number;
  totalLiters: number;
  totalAmount: number;
};

export type TodaySalesByShiftSummary = {
  pumpDayIso: string;
  shift1: ShiftSalesBucket;
  shift2: ShiftSalesBucket;
  todayTotal: {
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
  };
  fuelRows: FuelShiftSalesRow[];
};

function shiftSlot(label: string): 'shift1' | 'shift2' | 'other' {
  const t = label.trim();
  if (t === SHIFT_LABELS[0]) return 'shift1';
  if (t === SHIFT_LABELS[1]) return 'shift2';
  return 'other';
}

function emptyShiftBucket(key: 'shift1' | 'shift2'): ShiftSalesBucket {
  const shiftLabel = key === 'shift1' ? SHIFT_LABELS[0] : SHIFT_LABELS[1];
  return {
    shiftKey: key,
    displayName: key === 'shift1' ? 'Shift 1' : 'Shift 2',
    shiftLabel,
    totalAmount: 0,
    totalLiters: 0,
    transactionCount: 0,
    shiftId: null,
  };
}

function pickPrimaryShift(current: { shiftId: string | null; leadAmt: number }, shiftId: string, amt: number): void {
  if (amt > current.leadAmt) {
    current.leadAmt = amt;
    current.shiftId = shiftId;
  }
}

/** Closed-shift meter sales grouped into Shift 1 / Shift 2 for a pump business day. */
export async function getTodaySalesByShift(pumpDay: Date): Promise<TodaySalesByShiftSummary> {
  const pumpDayIso = format(pumpDay, 'yyyy-MM-dd');
  const shifts = await listClosedShiftsByPumpDayRange(pumpDay, pumpDay);

  const shift1 = emptyShiftBucket('shift1');
  const shift2 = emptyShiftBucket('shift2');

  const fuelAcc: Record<'MS' | 'HSD' | 'XP', { s1L: number; s1A: number; s2L: number; s2A: number }> = {
    MS: { s1L: 0, s1A: 0, s2L: 0, s2A: 0 },
    HSD: { s1L: 0, s1A: 0, s2L: 0, s2A: 0 },
    XP: { s1L: 0, s1A: 0, s2L: 0, s2A: 0 },
  };

  let totalAmount = 0;
  let totalLiters = 0;
  let totalTx = 0;
  const shift1Lead = { shiftId: null as string | null, leadAmt: 0 };
  const shift2Lead = { shiftId: null as string | null, leadAmt: 0 };

  for (const sh of shifts) {
    const slot = shiftSlot(sh.shiftLabel);
    const readings = await listReadingsForShift(sh.id);
    let shiftAmount = 0;
    let shiftLiters = 0;
    let shiftTx = 0;

    for (const r of readings) {
      const liters = Number(r.finalSalesLiters ?? 0);
      const amt = Number(r.totalAmount ?? 0);
      if (liters <= SALES_EPS && amt <= SALES_EPS) continue;

      shiftTx += 1;
      shiftLiters += liters;
      shiftAmount += amt;

      const nozzle = await getNozzle(r.nozzleId);
      const ft = nozzle ? await getFuelType(nozzle.fuelTypeId) : null;
      const code = fuelStockDisplayMeta(ft?.name ?? '').shortCode;
      if (code === 'MS' || code === 'HSD' || code === 'XP') {
        if (slot === 'shift1') {
          fuelAcc[code].s1L += liters;
          fuelAcc[code].s1A += amt;
        } else if (slot === 'shift2') {
          fuelAcc[code].s2L += liters;
          fuelAcc[code].s2A += amt;
        }
      }
    }

    totalAmount += shiftAmount;
    totalLiters += shiftLiters;
    totalTx += shiftTx;

    if (slot === 'shift1') {
      shift1.totalAmount += shiftAmount;
      shift1.totalLiters += shiftLiters;
      shift1.transactionCount += shiftTx;
      pickPrimaryShift(shift1Lead, sh.id, shiftAmount);
    } else if (slot === 'shift2') {
      shift2.totalAmount += shiftAmount;
      shift2.totalLiters += shiftLiters;
      shift2.transactionCount += shiftTx;
      pickPrimaryShift(shift2Lead, sh.id, shiftAmount);
    }
  }

  shift1.shiftId = shift1Lead.shiftId;
  shift2.shiftId = shift2Lead.shiftId;

  shift1.totalAmount = pivotRound(shift1.totalAmount);
  shift1.totalLiters = pivotRound(shift1.totalLiters);
  shift2.totalAmount = pivotRound(shift2.totalAmount);
  shift2.totalLiters = pivotRound(shift2.totalLiters);

  const fuelRows: FuelShiftSalesRow[] = (['MS', 'HSD', 'XP'] as const).map((shortCode) => {
    const f = fuelAcc[shortCode];
    const shift1Liters = pivotRound(f.s1L);
    const shift1Amount = pivotRound(f.s1A);
    const shift2Liters = pivotRound(f.s2L);
    const shift2Amount = pivotRound(f.s2A);
    return {
      shortCode,
      shift1Liters,
      shift1Amount,
      shift2Liters,
      shift2Amount,
      totalLiters: pivotRound(shift1Liters + shift2Liters),
      totalAmount: pivotRound(shift1Amount + shift2Amount),
    };
  });

  return {
    pumpDayIso,
    shift1,
    shift2,
    todayTotal: {
      totalAmount: pivotRound(totalAmount),
      totalLiters: pivotRound(totalLiters),
      transactionCount: totalTx,
    },
    fuelRows,
  };
}

export type FuelSalesChartRow = {
  shortCode: 'MS' | 'HSD' | 'XP';
  displayName: string;
  liters: number;
  amount: number;
  contributionPercent: number;
};

export type SalesByFuelChartData = {
  fromIso: string;
  toIso: string;
  rows: FuelSalesChartRow[];
  totalLiters: number;
  totalAmount: number;
  reconciledShiftCount: number;
};

const CHART_FUEL_CODES = ['MS', 'HSD', 'XP'] as const;

/** Meter sales by MS/HSD/XP from closed shifts with submitted reconciliation. */
export async function getSalesByFuelForRange(fromIso: string, toIso: string): Promise<SalesByFuelChartData> {
  const from = parseISO(`${fromIso}T12:00:00`);
  const to = parseISO(`${toIso}T12:00:00`);
  if (from.getTime() > to.getTime()) {
    return {
      fromIso,
      toIso,
      rows: CHART_FUEL_CODES.map((code) => ({
        shortCode: code,
        displayName: fuelStockDisplayMeta(code).displayName,
        liters: 0,
        amount: 0,
        contributionPercent: 0,
      })),
      totalLiters: 0,
      totalAmount: 0,
      reconciledShiftCount: 0,
    };
  }

  const shifts = await listClosedShiftsByPumpDayRange(from, to);
  const acc: Record<(typeof CHART_FUEL_CODES)[number], { liters: number; amount: number }> = {
    MS: { liters: 0, amount: 0 },
    HSD: { liters: 0, amount: 0 },
    XP: { liters: 0, amount: 0 },
  };
  let reconciledShiftCount = 0;

  for (const sh of shifts) {
    const recon = await getReconciliationForShift(sh.id);
    if (!recon) continue;
    reconciledShiftCount += 1;

    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      const liters = Number(r.finalSalesLiters ?? 0);
      const amt = Number(r.totalAmount ?? 0);
      if (liters <= SALES_EPS && amt <= SALES_EPS) continue;

      const nozzle = await getNozzle(r.nozzleId);
      const ft = nozzle ? await getFuelType(nozzle.fuelTypeId) : null;
      const code = fuelStockDisplayMeta(ft?.name ?? '').shortCode;
      if (code === 'MS' || code === 'HSD' || code === 'XP') {
        acc[code].liters += liters;
        acc[code].amount += amt;
      }
    }
  }

  const totalLiters = pivotRound(acc.MS.liters + acc.HSD.liters + acc.XP.liters);
  const totalAmount = pivotRound(acc.MS.amount + acc.HSD.amount + acc.XP.amount);

  const rows: FuelSalesChartRow[] = CHART_FUEL_CODES.map((code) => {
    const liters = pivotRound(acc[code].liters);
    const amount = pivotRound(acc[code].amount);
    const contributionPercent =
      totalAmount > 0 ? Math.round((amount / totalAmount) * 1000) / 10 : 0;
    return {
      shortCode: code,
      displayName: fuelStockDisplayMeta(code).displayName,
      liters,
      amount,
      contributionPercent,
    };
  });

  return {
    fromIso,
    toIso,
    rows,
    totalLiters,
    totalAmount,
    reconciledShiftCount,
  };
}

export type MeterRegisterRow = {
  dateIso: string;
  dateLabel: string;
  machine: string;
  nozzle: string;
  pumpBoyGirls: string;
  /** Stored shift slot, e.g. `6 AM – 2 PM`. */
  timeInOut: string;
  /** Morning Shift / Evening Shift / Night Shift. */
  shiftName: string;
  fuelType: string;
  opening: number;
  closing: number;
  total: number;
  tas: number;
  sales: number;
  rate: number;
  amount: number;
};

function meterRegisterAttendantLabel(sh: Shift): string {
  const names = parsePumpAttendants(sh.pumpAttendants ?? '');
  if (names.length > 0) {
    return names.join(', ');
  }
  const posts = parseAttendantPosts(sh.attendantPosts);
  if (posts.length === 0) {
    return '—';
  }
  const unique = [...new Set(posts.map((p) => p.name))];
  return unique.length > 0 ? unique.join(', ') : '—';
}

function shiftSlotSortIndex(label: string): number {
  const i = SHIFT_LABELS.indexOf(label as (typeof SHIFT_LABELS)[number]);
  return i >= 0 ? i : 99;
}

/**
 * Cashier Excel meter register: one row per nozzle reading whose shift pump day is in range.
 * Uses saved shiftReadings (open or closed). Empty attendants show "—".
 */
export async function getMeterRegisterRowsInRange(from: Date, to: Date): Promise<MeterRegisterRow[]> {
  const fromIso = format(from, 'yyyy-MM-dd');
  const toIso = format(to, 'yyyy-MM-dd');
  const [merged, nozzles, fuels] = await Promise.all([
    listShiftsForCashSheetMerge(from, to),
    listNozzles(false),
    listFuelTypes(),
  ]);
  const nozzleById = new Map(nozzles.map((n) => [n.id, n]));
  const fuelById = new Map(fuels.map((f) => [f.id, f]));

  const shifts = merged.filter((s) => {
    const day = shiftPumpDayIso(s);
    return day >= fromIso && day <= toIso;
  });

  const rows: MeterRegisterRow[] = [];

  for (const sh of shifts) {
    const readings = await listReadingsForShift(sh.id);
    if (readings.length === 0) {
      continue;
    }
    const dateIso = shiftPumpDayIso(sh);
    const dateLabel = formatDateDdMmYyyy(new Date(`${dateIso}T12:00:00`));
    const pumpBoyGirls = meterRegisterAttendantLabel(sh);
    const timeInOut = sh.shiftLabel?.trim() || '—';
    const shiftName = shiftScheduleForLabel(timeInOut)?.displayName ?? timeInOut;

    for (const r of readings) {
      const n = nozzleById.get(r.nozzleId);
      const fuelName = n ? (fuelById.get(n.fuelTypeId)?.name ?? '') : '';
      const opening = Number(r.openingReading ?? 0);
      const closing = Number(r.closingReading ?? 0);
      rows.push({
        dateIso,
        dateLabel,
        machine: n?.machineNumber ?? '—',
        nozzle: n?.nozzleNumber ?? '—',
        pumpBoyGirls,
        timeInOut,
        shiftName,
        fuelType: fuelName.trim() ? fuelName.trim().toUpperCase() : '—',
        opening,
        closing,
        total: closing - opening,
        tas: Number(r.testLiters ?? 0),
        sales: Number(r.finalSalesLiters ?? 0),
        rate: Number(r.rateAtSale ?? 0),
        amount: Number(r.totalAmount ?? 0),
      });
    }
  }

  rows.sort((a, b) => {
    const byDay = a.dateIso.localeCompare(b.dateIso);
    if (byDay !== 0) return byDay;
    const byShift = shiftSlotSortIndex(a.timeInOut) - shiftSlotSortIndex(b.timeInOut);
    if (byShift !== 0) return byShift;
    return compareNozzleOrder(
      { machineNumber: a.machine, nozzleNumber: a.nozzle },
      { machineNumber: b.machine, nozzleNumber: b.nozzle },
    );
  });

  return rows;
}
