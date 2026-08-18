import { eachDayOfInterval, format, parseISO } from 'date-fns';

import { getTotalOutstandingCredit } from '@/services/aggregatesService';
import { getReconciliationForShift } from '@/services/reconciliationService';
import { listClosedShiftsByPumpDayRange, shiftPumpDayIso } from '@/services/shiftsService';
import { getUser } from '@/services/usersService';
import { SHIFT_LABELS, type Shift } from '@/types/entities';
import {
  CASH_COLLECTION_ALERT_LIMIT,
  DAILY_CREDIT_SALES_ALERT_LIMIT,
} from '@/utils/collectionSummaryConstants';

const EPS = 0.01;

export type PaymentBucket = {
  amount: number;
  transactionCount: number;
};

export type ShiftChannelTotals = {
  cash: number;
  upi: number;
  card: number;
  credit: number;
  fleet: number;
};

export type CollectionModeKey = 'cash' | 'upi' | 'card' | 'credit' | 'fleet';

export type ShiftCollectionRow = {
  mode: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Fleet';
  key: CollectionModeKey;
  shift1: number;
  shift2: number;
  total: number;
};

export type CashBankCollectionSummary = {
  fromIso: string;
  toIso: string;
  cash: PaymentBucket;
  upi: PaymentBucket;
  card: PaymentBucket;
  credit: PaymentBucket;
  fleet: PaymentBucket;
  totalSales: number;
  totalCollection: number;
  creditSalesInPeriod: number;
  creditOutstanding: number;
  collectionEfficiencyPercent: number;
  shiftRows: ShiftCollectionRow[];
  donutPercents: Record<CollectionModeKey, number>;
  alerts: string[];
  pendingReconciliationShifts: string[];
  reconciledShiftCount: number;
};

export type CashBankCollectionDailyRow = {
  pumpDayIso: string;
  dateLabel: string;
  cash: number;
  upi: number;
  card: number;
  credit: number;
  fleet: number;
  totalCollection: number;
  totalSales: number;
  collectionEfficiencyPercent: number;
  reconciledShiftCount: number;
};

export type CashBankCollectionShiftDetailRow = {
  pumpDayIso: string;
  dateLabel: string;
  shiftLabel: string;
  operatorName: string;
  cash: number;
  upi: number;
  card: number;
  credit: number;
  fleet: number;
  totalCollection: number;
  totalSales: number;
  reconStatus: string;
};

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function emptyBucket(): PaymentBucket {
  return { amount: 0, transactionCount: 0 };
}

function addBucket(bucket: PaymentBucket, amount: number): void {
  if (amount <= EPS) return;
  bucket.amount = roundMoney(bucket.amount + amount);
  bucket.transactionCount += 1;
}

function shiftSlot(label: string): 'shift1' | 'shift2' | 'other' {
  const t = label.trim();
  if (t === SHIFT_LABELS[0]) return 'shift1';
  if (t === SHIFT_LABELS[1]) return 'shift2';
  return 'other';
}

function emptyShiftChannels(): ShiftChannelTotals {
  return { cash: 0, upi: 0, card: 0, credit: 0, fleet: 0 };
}

function inPumpDayRange(shift: Shift, fromIso: string, toIso: string): boolean {
  const day = shiftPumpDayIso(shift);
  return day >= fromIso && day <= toIso;
}

export async function getCashBankCollectionSummary(
  fromIso: string,
  toIso: string,
): Promise<CashBankCollectionSummary> {
  const from = parseISO(`${fromIso}T12:00:00`);
  const to = parseISO(`${toIso}T12:00:00`);

  const cash = emptyBucket();
  const upi = emptyBucket();
  const card = emptyBucket();
  const credit = emptyBucket();
  const fleet = emptyBucket();

  const shift1 = emptyShiftChannels();
  const shift2 = emptyShiftChannels();

  let totalSales = 0;
  let reconciledShiftCount = 0;
  const pendingReconciliationShifts: string[] = [];

  const closedShifts = await listClosedShiftsByPumpDayRange(from, to);

  for (const sh of closedShifts) {
    if (!inPumpDayRange(sh, fromIso, toIso)) continue;

    const recon = await getReconciliationForShift(sh.id);
    if (!recon) {
      pendingReconciliationShifts.push(sh.shiftLabel || sh.id);
      continue;
    }

    if (recon.status === 'pending') {
      pendingReconciliationShifts.push(sh.shiftLabel || sh.id);
    }

    reconciledShiftCount += 1;
    totalSales = roundMoney(totalSales + recon.totalSalesAmount);

    addBucket(cash, recon.cashAmount);
    addBucket(upi, recon.paytmOnline);
    addBucket(card, recon.iciciCard);
    addBucket(credit, recon.creditAmount);
    addBucket(fleet, recon.fleetCard);

    const slot = shiftSlot(sh.shiftLabel);
    if (slot === 'shift1') {
      shift1.cash = roundMoney(shift1.cash + recon.cashAmount);
      shift1.upi = roundMoney(shift1.upi + recon.paytmOnline);
      shift1.card = roundMoney(shift1.card + recon.iciciCard);
      shift1.credit = roundMoney(shift1.credit + recon.creditAmount);
      shift1.fleet = roundMoney(shift1.fleet + recon.fleetCard);
    } else if (slot === 'shift2') {
      shift2.cash = roundMoney(shift2.cash + recon.cashAmount);
      shift2.upi = roundMoney(shift2.upi + recon.paytmOnline);
      shift2.card = roundMoney(shift2.card + recon.iciciCard);
      shift2.credit = roundMoney(shift2.credit + recon.creditAmount);
      shift2.fleet = roundMoney(shift2.fleet + recon.fleetCard);
    }
  }

  const totalCollection = roundMoney(cash.amount + upi.amount + card.amount + fleet.amount);
  const creditSalesInPeriod = credit.amount;
  const creditOutstanding = await getTotalOutstandingCredit();

  const computedSales = roundMoney(totalCollection + creditSalesInPeriod);
  const totalSalesFinal = totalSales > EPS ? totalSales : computedSales;

  const collectionEfficiencyPercent =
    totalSalesFinal > EPS ? Math.round((totalCollection / totalSalesFinal) * 10000) / 100 : 0;

  const shiftRows: ShiftCollectionRow[] = [
    { mode: 'Cash', key: 'cash', shift1: shift1.cash, shift2: shift2.cash, total: cash.amount },
    { mode: 'UPI', key: 'upi', shift1: shift1.upi, shift2: shift2.upi, total: upi.amount },
    { mode: 'Card', key: 'card', shift1: shift1.card, shift2: shift2.card, total: card.amount },
    { mode: 'Credit', key: 'credit', shift1: shift1.credit, shift2: shift2.credit, total: credit.amount },
    { mode: 'Fleet', key: 'fleet', shift1: shift1.fleet, shift2: shift2.fleet, total: fleet.amount },
  ];

  const donutBase = totalSalesFinal > EPS ? totalSalesFinal : totalCollection + creditSalesInPeriod;
  const pct = (part: number) => (donutBase > EPS ? Math.round((part / donutBase) * 1000) / 10 : 0);

  const donutPercents: Record<CollectionModeKey, number> = {
    cash: pct(cash.amount),
    upi: pct(upi.amount),
    card: pct(card.amount),
    credit: pct(credit.amount),
    fleet: pct(fleet.amount),
  };

  const alerts: string[] = [];
  if (cash.amount > CASH_COLLECTION_ALERT_LIMIT) {
    alerts.push(`Cash collection exceeds ₹${CASH_COLLECTION_ALERT_LIMIT.toLocaleString('en-IN')}.`);
  }
  if (creditSalesInPeriod > DAILY_CREDIT_SALES_ALERT_LIMIT) {
    alerts.push(
      `Credit sales exceed daily threshold of ₹${DAILY_CREDIT_SALES_ALERT_LIMIT.toLocaleString('en-IN')}.`,
    );
  }
  for (const label of pendingReconciliationShifts) {
    alerts.push(`${label} reconciliation pending.`);
  }
  if (totalCollection + creditSalesInPeriod < totalSalesFinal - 1) {
    alerts.push('Collected amount is less than declared total sales for the period.');
  }

  return {
    fromIso,
    toIso,
    cash,
    upi,
    card,
    credit,
    fleet,
    totalSales: totalSalesFinal,
    totalCollection,
    creditSalesInPeriod,
    creditOutstanding,
    collectionEfficiencyPercent,
    shiftRows,
    donutPercents,
    alerts,
    pendingReconciliationShifts,
    reconciledShiftCount,
  };
}

type MutableDailyRow = CashBankCollectionDailyRow;

function emptyDailyRow(pumpDayIso: string, dateLabel: string): MutableDailyRow {
  return {
    pumpDayIso,
    dateLabel,
    cash: 0,
    upi: 0,
    card: 0,
    credit: 0,
    fleet: 0,
    totalCollection: 0,
    totalSales: 0,
    collectionEfficiencyPercent: 0,
    reconciledShiftCount: 0,
  };
}

function finalizeDailyRow(row: MutableDailyRow): CashBankCollectionDailyRow {
  row.cash = roundMoney(row.cash);
  row.upi = roundMoney(row.upi);
  row.card = roundMoney(row.card);
  row.credit = roundMoney(row.credit);
  row.fleet = roundMoney(row.fleet);
  row.totalCollection = roundMoney(row.cash + row.upi + row.card + row.fleet);
  row.totalSales = roundMoney(row.totalSales);
  const salesBase =
    row.totalSales > EPS ? row.totalSales : roundMoney(row.totalCollection + row.credit);
  row.collectionEfficiencyPercent =
    salesBase > EPS ? Math.round((row.totalCollection / salesBase) * 10000) / 100 : 0;
  return row;
}

export async function getCashBankCollectionDailyRows(
  fromIso: string,
  toIso: string,
): Promise<CashBankCollectionDailyRow[]> {
  const from = parseISO(`${fromIso}T12:00:00`);
  const to = parseISO(`${toIso}T12:00:00`);
  const dayMap = new Map<string, MutableDailyRow>();

  for (const d of eachDayOfInterval({ start: from, end: to })) {
    const iso = format(d, 'yyyy-MM-dd');
    dayMap.set(iso, emptyDailyRow(iso, format(d, 'dd MMM yyyy')));
  }

  const closedShifts = await listClosedShiftsByPumpDayRange(from, to);

  for (const sh of closedShifts) {
    const day = shiftPumpDayIso(sh);
    if (day < fromIso || day > toIso) continue;

    let row = dayMap.get(day);
    if (!row) {
      row = emptyDailyRow(day, format(parseISO(`${day}T12:00:00`), 'dd MMM yyyy'));
      dayMap.set(day, row);
    }

    const recon = await getReconciliationForShift(sh.id);
    if (!recon) continue;

    row.cash = roundMoney(row.cash + recon.cashAmount);
    row.upi = roundMoney(row.upi + recon.paytmOnline);
    row.card = roundMoney(row.card + recon.iciciCard);
    row.credit = roundMoney(row.credit + recon.creditAmount);
    row.fleet = roundMoney(row.fleet + recon.fleetCard);
    row.totalSales = roundMoney(row.totalSales + recon.totalSalesAmount);
    row.reconciledShiftCount += 1;
  }

  return Array.from(dayMap.values())
    .sort((a, b) => a.pumpDayIso.localeCompare(b.pumpDayIso))
    .map(finalizeDailyRow);
}

export async function getCashBankCollectionShiftDetails(
  fromIso: string,
  toIso: string,
): Promise<CashBankCollectionShiftDetailRow[]> {
  const from = parseISO(`${fromIso}T12:00:00`);
  const to = parseISO(`${toIso}T12:00:00`);
  const out: CashBankCollectionShiftDetailRow[] = [];

  const closedShifts = await listClosedShiftsByPumpDayRange(from, to);

  for (const sh of closedShifts) {
    const day = shiftPumpDayIso(sh);
    if (day < fromIso || day > toIso) continue;

    const recon = await getReconciliationForShift(sh.id);
    const cash = recon?.cashAmount ?? 0;
    const upi = recon?.paytmOnline ?? 0;
    const card = recon?.iciciCard ?? 0;
    const credit = recon?.creditAmount ?? 0;
    const fleet = recon?.fleetCard ?? 0;
    const totalCollection = roundMoney(cash + upi + card + fleet);
    const totalSales = recon?.totalSalesAmount ?? roundMoney(totalCollection + credit);
    const op = await getUser(sh.operatorId);
    const operatorName = op?.name ?? sh.operatorId;

    out.push({
      pumpDayIso: day,
      dateLabel: format(parseISO(`${day}T12:00:00`), 'dd MMM yyyy'),
      shiftLabel: sh.shiftLabel,
      operatorName,
      cash: roundMoney(cash),
      upi: roundMoney(upi),
      card: roundMoney(card),
      credit: roundMoney(credit),
      fleet: roundMoney(fleet),
      totalCollection,
      totalSales: roundMoney(totalSales),
      reconStatus: recon ? recon.status : 'missing',
    });
  }

  return out.sort((a, b) => {
    const d = a.pumpDayIso.localeCompare(b.pumpDayIso);
    return d !== 0 ? d : a.shiftLabel.localeCompare(b.shiftLabel);
  });
}
