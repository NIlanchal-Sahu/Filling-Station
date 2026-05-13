import { eachDayOfInterval, format } from 'date-fns';
import type { LedgerEntry, Shift, ShiftReconciliation } from '@/types/entities';
import { effectiveLedgerChannel } from '@/utils/cashBookSummary';
import { calendarIsoForShift, latestReconciliationsPerShift } from '@/utils/dailyCashBookVertical';
import { roundMoney2, totalCashFromMeterAndChannels } from '@/utils/meterSalesByFuel';

const EPS = 0.01;

/** Party / payout columns aligned with typical pump cashier Excel (normalized keys). */
export const DEFAULT_PARTY_SHEET_KEYS = [
  'KALU BABU',
  'LAXMI ANNA',
  'MAITRI INFA',
  'UNION BANK',
  'SBI BANK',
  'SRI PLASTIC',
  'SWURA',
  'SUNIL TRAVELS',
] as const;

export type DailyCashSheetRow = {
  dateIso: string;
  dateLabel: string;
  openingBalance: number;
  /** Meter-style cash for shifts on this business date: sales − PhonePe − ICICI − Fleet − credit − short (latest recon per shift only). */
  totalCashShift: number;
  /** Other cash receipts in ledger (excluding lines detected as opening). */
  cashReceivedLedger: number;
  expenses: number;
  salary: number;
  advanceSalary: number;
  /** Opening + shift cash + receipts − category outflows above. */
  balanceCash: number;
  /** Matches many sheets that keep a spare “CASH” column — always zero here unless you extend import. */
  cashAdjustColumn: number;
  /** Same as balance in simple model (before locker breakdown). */
  totalCash2: number;
  locker: number;
  oddBalance: number;
  /** After locker & odd — before named party / bank payouts. */
  cashInHand: number;
  parties: Record<string, number>;
  /** Physical cash left for the day after party/bank columns (this is the cash-in-hand figure for the row). */
  closingBalance: number;
};

function openingIncomeMatch(entry: LedgerEntry): boolean {
  if (entry.type !== 'income' || effectiveLedgerChannel(entry) !== 'cash') return false;
  const blob = `${entry.particulars} ${entry.paidToOrReceivedFrom}`.toLowerCase();
  return /\bopening\b/.test(blob);
}

/** Cash / bank postings that physically move drawer cash. */
function isDrawerExpense(entry: LedgerEntry): boolean {
  if (entry.type !== 'expense') return false;
  const ch = effectiveLedgerChannel(entry);
  return ch === 'cash' || ch === 'bank';
}

function normalizeKey(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

function matchPartyKey(namesRaw: string, parties: readonly string[]): string | null {
  const n = normalizeKey(namesRaw);
  for (const p of parties) {
    const pn = normalizeKey(p);
    if (n === pn || n.includes(pn)) return p;
  }
  return null;
}

function ledgerDayIso(entry: LedgerEntry): string {
  return format(entry.date.toDate(), 'yyyy-MM-dd');
}

type ExpenseAllocation =
  | { kind: 'party'; key: string }
  | { kind: 'locker' }
  | { kind: 'odd' }
  | { kind: 'salary' }
  | { kind: 'advance' }
  | { kind: 'expenses' };

function allocateExpenseBucket(e: LedgerEntry, parties: readonly string[]): ExpenseAllocation | null {
  if (!isDrawerExpense(e) || e.amount < EPS) return null;
  const party = matchPartyKey(e.paidToOrReceivedFrom, parties);
  if (party) return { kind: 'party', key: party };
  const c = normalizeKey(e.category);
  if (c === 'LOCKER') return { kind: 'locker' };
  if (c === 'ODD BALANCE' || c === 'ODDBALANCE') return { kind: 'odd' };
  if (c === 'SALARY') return { kind: 'salary' };
  if (c.includes('ADVANCE')) return { kind: 'advance' };
  if (c === 'EXPENSES') return { kind: 'expenses' };
  /* Miscellaneous paid-out rows still reduce cash — treat as general expenses like your sheet. */
  return { kind: 'expenses' };
}

/** Build one row per calendar day between `interval.start` / `interval.end` at local dates. */
export function buildDailyCashSheet(
  interval: { start: Date; end: Date },
  ledgerAll: LedgerEntry[],
  reconciliations: ShiftReconciliation[],
  shiftByShiftId: Map<string, Shift | null | undefined>,
  partyKeys: readonly string[] = DEFAULT_PARTY_SHEET_KEYS,
): DailyCashSheetRow[] {
  const dayList = eachDayOfInterval(interval);
  if (dayList.length === 0) return [];

  const ledgerByDay = new Map<string, LedgerEntry[]>();
  for (const e of ledgerAll) {
    const iso = ledgerDayIso(e);
    let arr = ledgerByDay.get(iso);
    if (!arr) {
      arr = [];
      ledgerByDay.set(iso, arr);
    }
    arr.push(e);
  }

  /** Meter-style cash only: sales − PhonePe − ICICI − Fleet − credit − short (same as Ledger / reconciliation). */
  const reconCashByCal = new Map<string, number>();
  for (const r of latestReconciliationsPerShift(reconciliations)) {
    const sh = shiftByShiftId.get(r.shiftId);
    const iso = calendarIsoForShift(sh ?? undefined);
    if (!iso) continue;
    const meterCash = totalCashFromMeterAndChannels(
      r.totalSalesAmount,
      r.paytmOnline,
      r.iciciCard,
      r.fleetCard,
      r.creditAmount,
      r.shortAmount,
    );
    reconCashByCal.set(iso, roundMoney2((reconCashByCal.get(iso) ?? 0) + meterCash));
  }

  let carryOpening: number | undefined;

  const out: DailyCashSheetRow[] = [];

  for (const day of dayList) {
    const iso = format(day, 'yyyy-MM-dd');
    const dayLedger = ledgerByDay.get(iso) ?? [];

    let openingBalance: number;
    if (carryOpening === undefined) {
      openingBalance = dayLedger
        .filter(openingIncomeMatch)
        .reduce((s, e) => s + e.amount, 0);
    } else {
      openingBalance = carryOpening;
    }

    const shiftCash = reconCashByCal.get(iso) ?? 0;
    const cashReceivedLedger = dayLedger
      .filter((e) => e.type === 'income' && effectiveLedgerChannel(e) === 'cash' && !openingIncomeMatch(e))
      .reduce((s, e) => s + e.amount, 0);

    let expenses = 0;
    let salary = 0;
    let advanceSalary = 0;
    let locker = 0;
    let oddBalance = 0;
    const parties: Record<string, number> = {};
    for (const k of partyKeys) parties[k] = 0;

    for (const e of dayLedger) {
      const bucket = allocateExpenseBucket(e, partyKeys);
      if (!bucket) continue;
      if (bucket.kind === 'party') {
        parties[bucket.key] = (parties[bucket.key] ?? 0) + e.amount;
      } else if (bucket.kind === 'locker') {
        locker += e.amount;
      } else if (bucket.kind === 'odd') {
        oddBalance += e.amount;
      } else if (bucket.kind === 'salary') {
        salary += e.amount;
      } else if (bucket.kind === 'advance') {
        advanceSalary += e.amount;
      } else {
        expenses += e.amount;
      }
    }

    const grossIn = openingBalance + shiftCash + cashReceivedLedger;
    const categoryPaid = expenses + salary + advanceSalary;
    const balanceCash = grossIn - categoryPaid;
    const cashAdjustColumn = 0;
    const totalCash2 = balanceCash;

    const afterLockerOdd = balanceCash - locker - oddBalance;
    const partySum = Object.values(parties).reduce((a, b) => a + b, 0);
    const cashInHand = afterLockerOdd;
    const closingBalance = afterLockerOdd - partySum;

    out.push({
      dateIso: iso,
      dateLabel: format(day, 'dd-MMM'),
      openingBalance,
      totalCashShift: shiftCash,
      cashReceivedLedger,
      expenses,
      salary,
      advanceSalary,
      balanceCash,
      cashAdjustColumn,
      totalCash2,
      locker,
      oddBalance,
      cashInHand,
      parties,
      closingBalance,
    });

    carryOpening = closingBalance;
  }

  return out;
}

export function fmtSheet(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
