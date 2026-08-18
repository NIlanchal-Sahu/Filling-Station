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

/** Credit party paid in cash (Credit → Receive payment, mode CASH). */
export function isCreditCashReceived(entry: LedgerEntry): boolean {
  if (entry.type !== 'income' || effectiveLedgerChannel(entry) !== 'cash') return false;
  if (entry.relatedCreditPaymentId) return true;
  const blob = `${entry.particulars} ${entry.paidToOrReceivedFrom}`.toLowerCase();
  return blob.includes('due received');
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

const EXCEL_PARTY_ROWS = [
  'KALU BABU',
  'LAXMI ANNA',
  'MAITRI INFA',
  'UNION BANK',
  'SBI BANK',
  'SRI PLASTIC',
  'SWURA',
  'SUNIL TRAVELS',
] as const;

function dashOr(n: number): number | null {
  return Math.abs(n) > EPS ? n : null;
}

function matchExcelParty(namesRaw: string): string | null {
  const n = namesRaw.trim().toUpperCase().replace(/\s+/g, ' ');
  for (const p of EXCEL_PARTY_ROWS) {
    if (n === p || n.includes(p)) return p;
  }
  return null;
}

function excelOutflowBuckets(ledgerSameDay: LedgerEntry[]) {
  let expenses = 0;
  let salary = 0;
  let advanceSalary = 0;
  let locker = 0;
  let oddBalance = 0;
  const parties: Record<string, number> = {};
  for (const p of EXCEL_PARTY_ROWS) parties[p] = 0;
  const extras: Record<string, number> = {};

  for (const e of ledgerSameDay) {
    if (!isDrawerOutflow(e) || e.amount < EPS) continue;
    const cat = e.category.trim().toUpperCase();
    if (cat === 'LOCKER') {
      locker += e.amount;
      continue;
    }
    if (cat === 'ODD BALANCE' || cat.includes('ODD')) {
      oddBalance += e.amount;
      continue;
    }
    if (cat === 'SALARY') {
      salary += e.amount;
      continue;
    }
    if (cat.includes('ADVANCE')) {
      advanceSalary += e.amount;
      continue;
    }
    const party = matchExcelParty(e.paidToOrReceivedFrom);
    if (party) {
      parties[party] += e.amount;
      continue;
    }
    const name = e.paidToOrReceivedFrom.trim().toUpperCase().replace(/\s+/g, ' ');
    if (name && cat === 'TRANSFER') {
      extras[name] = (extras[name] ?? 0) + e.amount;
      continue;
    }
    expenses += e.amount;
  }

  const paidOutSum = roundMoney2(
    expenses +
      salary +
      advanceSalary +
      locker +
      oddBalance +
      Object.values(parties).reduce((s, n) => s + n, 0) +
      Object.values(extras).reduce((s, n) => s + n, 0),
  );
  return { expenses, salary, advanceSalary, locker, oddBalance, parties, extras, paidOutSum };
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
   */
  openingBalanceOverride?: number | null;
  /**
   * When false, TOTAL CASH = sales − credit − Phone Pe − ICICI − Fleet (short is shown but not deducted).
   * Default true (includes short).
   */
  subtractShortageFromTotalCash?: boolean;
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
    openingBalanceOverride,
    subtractShortageFromTotalCash = true,
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
    subtractShortageFromTotalCash ? shortageAmt : 0,
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
    if (isCreditCashReceived(e)) cashReceived += e.amount;
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
    amount: cashReceived > EPS ? cashReceived : null,
  });

  const grossCash = totalCashDerived + opening + cashReceived;
  rows.push({
    key: 'gross',
    label: 'GROSS CASH',
    amount: grossCash,
    bold: true,
    alwaysShowAmount: true,
  });

  const buckets = excelOutflowBuckets(ledgerSameDay);

  rows.push({ key: 'expenses', label: 'EXPENSES', amount: dashOr(buckets.expenses) });
  rows.push({ key: 'salary', label: 'SALARY', amount: dashOr(buckets.salary) });
  rows.push({ key: 'advance', label: 'ADVANCE SALARY', amount: dashOr(buckets.advanceSalary) });
  rows.push({ key: 'locker', label: 'LOCKER', amount: dashOr(buckets.locker) });
  rows.push({ key: 'odd', label: 'ODD BALANCE', amount: dashOr(buckets.oddBalance) });
  for (const p of EXCEL_PARTY_ROWS) {
    const amt = buckets.parties[p] ?? 0;
    if (amt > EPS) {
      rows.push({ key: `party-${p}`, label: p, amount: amt });
    }
  }
  for (const [name, amt] of Object.entries(buckets.extras).sort(([a], [b]) => a.localeCompare(b))) {
    if (amt > EPS) {
      rows.push({ key: `party-x-${name}`, label: name, amount: amt });
    }
  }

  const closing = grossCash - buckets.paidOutSum;
  rows.push({
    key: 'closing',
    label: 'CLOSING BALANCE IN CASH',
    amount: closing,
    bold: true,
    alwaysShowAmount: true,
  });

  return rows;
}
