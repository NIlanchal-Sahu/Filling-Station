import type { LedgerEntry } from '@/types/entities';
import {
  roundMoney2,
  shortageFromReconciliationDifferences,
  totalCashFromMeterAndChannels,
} from '@/utils/meterSalesByFuel';

const EPS = 0.01;

/** Align with ledger sheet: missing channel → expense = cash, income = bank. */
export function effectiveLedgerChannel(entry: LedgerEntry): 'cash' | 'bank' | 'upi' {
  const ch = entry.paymentChannel;
  if (ch === 'cash' || ch === 'bank' || ch === 'upi') return ch;
  return entry.type === 'expense' ? 'cash' : 'bank';
}

function openingBalanceMatch(entry: LedgerEntry): boolean {
  if (entry.type !== 'income' || effectiveLedgerChannel(entry) !== 'cash') return false;
  const blob = `${entry.particulars} ${entry.paidToOrReceivedFrom}`.toLowerCase();
  return /\bopening\b/.test(blob);
}

/** Money leaving the physical drawer — cash paid out or deposited via bank from drawer. */
function isDrawerOutflow(entry: LedgerEntry): boolean {
  if (entry.type !== 'expense') return false;
  const ch = effectiveLedgerChannel(entry);
  return ch === 'cash' || ch === 'bank';
}

export type CashBookSummaryRow = {
  key: string;
  label: string;
  amount: number | null;
  bold?: boolean;
  alwaysShowAmount?: boolean;
};

export function fmtInrDash(amount: number | null, alwaysShow = false): string {
  if (!alwaysShow && (amount === null || Math.abs(amount) < EPS)) return '—';
  const n = amount ?? 0;
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function outflowLabel(e: LedgerEntry): string {
  return (e.paidToOrReceivedFrom.trim() || e.category || e.particulars || 'EXPENSE').toUpperCase();
}

/** Matches common Excel cash-register row order below GROSS CASH. */
function outflowSheetRank(e: LedgerEntry): number {
  const cat = e.category.trim().toUpperCase();
  if (cat === 'EXPENSES') return 10;
  if (cat === 'SALARY') return 20;
  if (cat.includes('ADVANCE')) return 30;
  if (cat === 'LOCKER') return 40;
  if (cat === 'ODD BALANCE' || cat.includes('ODD')) return 50;
  if (cat === 'TRANSFER') return 60;
  return 100;
}

export function buildCashBookSummary(params: {
  /** Sum of meter ₹ (PETROL + XP + DIESEL + other fuels) for the shift(s). */
  totalSales: number;
  paytm: number;
  icici: number;
  fleet: number;
  credit: number;
  ledgerSameDay: LedgerEntry[];
  /** Sum of saved `shortAmount` values; when positive, used for SHORT row and cash (else derived from differences). */
  explicitShortSum?: number;
  /** Sum of reconciliation `difference` values; shortfall subtracted when explicit short is not used. */
  differenceSumForShort?: number;
  /** When true, expense rows sort like Excel (EXPENSES → SALARY → ADVANCE …) then NAMES. */
  sheetStyleOutflows?: boolean;
  /**
   * If set (e.g. daily sheet carry-forward opening), replaces ledger-derived opening total.
   * Cash received still excludes lines detected as ledger “opening”.
   */
  openingBalanceOverride?: number | null;
}): CashBookSummaryRow[] {
  const {
    totalSales,
    paytm,
    icici,
    fleet,
    credit,
    ledgerSameDay,
    explicitShortSum = 0,
    differenceSumForShort = 0,
    sheetStyleOutflows = false,
    openingBalanceOverride,
  } = params;

  const explicit = roundMoney2(Math.max(0, explicitShortSum));
  const fromDiff = shortageFromReconciliationDifferences(differenceSumForShort);
  const shortageAmt = explicit > EPS ? explicit : fromDiff;
  const totalCashDerived = totalCashFromMeterAndChannels(
    totalSales,
    paytm,
    icici,
    fleet,
    credit,
    shortageAmt,
  );

  const rows: CashBookSummaryRow[] = [];

  rows.push({
    key: 'total-sales',
    label: 'TOTAL SALES AMOUNTS',
    amount: totalSales,
    bold: true,
    alwaysShowAmount: true,
  });

  rows.push({ key: 'phone-pe', label: 'PHONE PE', amount: paytm });
  rows.push({ key: 'icici', label: 'ICICI', amount: icici });
  rows.push({ key: 'fleet', label: 'FLEET CARD', amount: fleet });
  rows.push({ key: 'credit', label: 'CREDIT', amount: credit });

  rows.push({
    key: 'short',
    label: 'SHORT',
    amount: shortageAmt > EPS ? shortageAmt : null,
  });

  rows.push({
    key: 'total-cash-shift',
    label: 'TOTAL CASH',
    amount: totalCashDerived,
    bold: true,
    alwaysShowAmount: true,
  });

  let opening = 0;
  if (openingBalanceOverride != null && Number.isFinite(openingBalanceOverride)) {
    opening = openingBalanceOverride;
  } else {
    for (const e of ledgerSameDay) {
      if (e.type !== 'income' || effectiveLedgerChannel(e) !== 'cash') continue;
      if (openingBalanceMatch(e)) opening += e.amount;
    }
  }

  let cashReceived = 0;
  for (const e of ledgerSameDay) {
    if (e.type !== 'income' || effectiveLedgerChannel(e) !== 'cash') continue;
    if (openingBalanceMatch(e)) continue;
    cashReceived += e.amount;
  }

  rows.push({
    key: 'opening',
    label: 'OPENING BALANCE',
    amount: opening,
    bold: true,
    alwaysShowAmount: true,
  });
  rows.push({
    key: 'cash-received',
    label: 'CASH RECEIVED',
    amount: cashReceived,
    alwaysShowAmount: true,
  });

  const grossCash = totalCashDerived + opening + cashReceived;
  rows.push({
    key: 'gross',
    label: 'GROSS CASH',
    amount: grossCash,
    bold: true,
    alwaysShowAmount: true,
  });

  const outflows = ledgerSameDay
    .filter((e) => isDrawerOutflow(e) && e.amount > EPS)
    .sort((a, b) => {
      if (sheetStyleOutflows) {
        const ra = outflowSheetRank(a);
        const rb = outflowSheetRank(b);
        if (ra !== rb) return ra - rb;
      }
      return outflowLabel(a).localeCompare(outflowLabel(b));
    });

  let paidOutSum = 0;
  for (const e of outflows) {
    const label = outflowLabel(e);
    rows.push({ key: `out-${e.id}`, label, amount: e.amount });
    paidOutSum += e.amount;
  }

  const closing = grossCash - paidOutSum;
  rows.push({
    key: 'closing',
    label: 'CLOSING BALANCE IN CASH',
    amount: closing,
    bold: true,
    alwaysShowAmount: true,
  });

  return rows;
}
