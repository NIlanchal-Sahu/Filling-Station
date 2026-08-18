import { eachDayOfInterval, format } from 'date-fns';
import type { LedgerEntry, Shift, ShiftReconciliation } from '@/types/entities';
import { effectiveLedgerChannel } from '@/utils/cashBookSummary';
import { latestReconciliationsPerShift, sheetDayIsoForReconciliation } from '@/utils/dailyCashBookVertical';
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

export type PartyPayout = { name: string; amount: number };

type DayReconChannels = {
  totalSales: number;
  credit: number;
  phonePe: number;
  icici: number;
  fleet: number;
  short: number;
  totalCash: number;
};

export type DailyCashSheetRow = {
  dateIso: string;
  dateLabel: string;
  openingBalance: number;
  /** Sum of meter / recon sales for shifts on this calendar date. */
  totalSales: number;
  lessCredit: number;
  phonePe: number;
  iciciBank: number;
  fleetCard: number;
  shortAmount: number;
  /** Total sales − credit − Phone Pe − ICICI − Fleet − short (latest recon per shift). */
  totalCashShift: number;
  /** Other cash receipts in ledger (excluding lines detected as opening). */
  cashReceivedLedger: number;
  expenses: number;
  salary: number;
  advanceSalary: number;
  /** Opening + shift cash + receipts − category outflows above. */
  balanceCash: number;
  /** Cash collected against credit (Receive payment, CASH). Shown as Cash received / Cash adj. */
  cashAdjustColumn: number;
  /** Same as balance in simple model (before locker breakdown). */
  totalCash2: number;
  locker: number;
  oddBalance: number;
  /** After locker & odd — before named party / bank payouts. */
  cashInHand: number;
  /** Paid-out ledger lines to a person / bank (Names column); only rows with a payout that day. */
  partyPayouts: PartyPayout[];
  /** Physical cash left for the day after party/bank columns (this is the cash-in-hand figure for the row). */
  closingBalance: number;
};

function openingIncomeMatch(entry: LedgerEntry): boolean {
  if (entry.type !== 'income' || effectiveLedgerChannel(entry) !== 'cash') return false;
  const blob = `${entry.particulars} ${entry.paidToOrReceivedFrom}`.toLowerCase();
  return /\bopening\b/.test(blob);
}

/** Credit party paid in cash (Credit → Receive payment, mode CASH). */
function isCreditCashReceived(entry: LedgerEntry): boolean {
  if (entry.type !== 'income' || effectiveLedgerChannel(entry) !== 'cash') return false;
  if (entry.relatedCreditPaymentId) return true;
  const blob = `${entry.particulars} ${entry.paidToOrReceivedFrom}`.toLowerCase();
  return blob.includes('due received');
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
  | { kind: 'party'; key: string; displayName: string }
  | { kind: 'locker' }
  | { kind: 'odd' }
  | { kind: 'salary' }
  | { kind: 'advance' }
  | { kind: 'expenses' };

function isSystemGeneratedPayee(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n.startsWith('due received:') ||
    n.startsWith('loan from') ||
    n.startsWith('loan repayment')
  );
}

const EXPENSE_ONLY_CATEGORIES = new Set(['EXPENSES', 'MAINTENANCE', 'MISC']);

function allocateExpenseBucket(
  e: LedgerEntry,
  legacyPartyKeys: readonly string[],
): ExpenseAllocation | null {
  if (!isDrawerExpense(e) || e.amount < EPS) return null;
  const c = normalizeKey(e.category);
  if (c === 'LOCKER') return { kind: 'locker' };
  if (c === 'ODD BALANCE' || c === 'ODDBALANCE') return { kind: 'odd' };
  if (c === 'SALARY') return { kind: 'salary' };
  if (c.includes('ADVANCE')) return { kind: 'advance' };

  const rawName = e.paidToOrReceivedFrom.trim();
  if (rawName && !isSystemGeneratedPayee(rawName)) {
    const legacy = matchPartyKey(rawName, legacyPartyKeys);
    if (legacy) return { kind: 'party', key: normalizeKey(legacy), displayName: legacy };
    if (!EXPENSE_ONLY_CATEGORIES.has(c) && c === 'TRANSFER') {
      return { kind: 'party', key: normalizeKey(rawName), displayName: rawName };
    }
  }

  if (EXPENSE_ONLY_CATEGORIES.has(c)) return { kind: 'expenses' };
  return { kind: 'expenses' };
}

export function bucketDayOutflows(
  dayLedger: LedgerEntry[],
  partyKeys: readonly string[] = DEFAULT_PARTY_SHEET_KEYS,
): {
  expenses: number;
  salary: number;
  advanceSalary: number;
  locker: number;
  oddBalance: number;
  partyPayouts: PartyPayout[];
  paidOutSum: number;
} {
  let expenses = 0;
  let salary = 0;
  let advanceSalary = 0;
  let locker = 0;
  let oddBalance = 0;
  const partyMap = new Map<string, PartyPayout>();

  for (const e of dayLedger) {
    const bucket = allocateExpenseBucket(e, partyKeys);
    if (!bucket) continue;
    if (bucket.kind === 'party') {
      const prev = partyMap.get(bucket.key);
      if (prev) {
        prev.amount += e.amount;
      } else {
        partyMap.set(bucket.key, { name: bucket.displayName, amount: e.amount });
      }
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

  const extras = [...partyMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const partyPayouts = extras.filter((p) => p.amount > EPS);
  const paidOutSum = roundMoney2(
    expenses + salary + advanceSalary + locker + oddBalance + partyPayouts.reduce((s, p) => s + p.amount, 0),
  );
  return { expenses, salary, advanceSalary, locker, oddBalance, partyPayouts, paidOutSum };
}

/** Build one row per calendar day between `interval.start` / `interval.end` at local dates. */
export function buildDailyCashSheet(
  interval: { start: Date; end: Date },
  ledgerAll: LedgerEntry[],
  reconciliations: ShiftReconciliation[],
  shiftByShiftId: Map<string, Shift | null | undefined>,
  partyKeys: readonly string[] = DEFAULT_PARTY_SHEET_KEYS,
  meterSalesByIso: ReadonlyMap<string, number> = new Map(),
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

  const rangeStartIso = format(interval.start, 'yyyy-MM-dd');
  const rangeEndIso = format(interval.end, 'yyyy-MM-dd');

  /** Meter-style cash: sales − PhonePe − ICICI − Fleet − credit − short (latest recon per shift). */
  const reconByCal = new Map<string, DayReconChannels>();
  for (const r of latestReconciliationsPerShift(reconciliations)) {
    const sh = shiftByShiftId.get(r.shiftId);
    const iso = sheetDayIsoForReconciliation(r, sh ?? undefined, rangeStartIso, rangeEndIso);
    if (!iso) continue;
    const meterCash = totalCashFromMeterAndChannels(
      r.totalSalesAmount,
      r.paytmOnline,
      r.iciciCard,
      r.fleetCard,
      r.creditAmount,
      r.shortAmount,
    );
    const prev = reconByCal.get(iso) ?? {
      totalSales: 0,
      credit: 0,
      phonePe: 0,
      icici: 0,
      fleet: 0,
      short: 0,
      totalCash: 0,
    };
    reconByCal.set(iso, {
      totalSales: roundMoney2(prev.totalSales + r.totalSalesAmount),
      credit: roundMoney2(prev.credit + r.creditAmount),
      phonePe: roundMoney2(prev.phonePe + r.paytmOnline),
      icici: roundMoney2(prev.icici + r.iciciCard),
      fleet: roundMoney2(prev.fleet + r.fleetCard),
      short: roundMoney2(prev.short + (r.shortAmount ?? 0)),
      totalCash: roundMoney2(prev.totalCash + meterCash),
    });
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

    const recon = reconByCal.get(iso);
    const meterSales = meterSalesByIso.get(iso) ?? 0;
    const reconSales = recon?.totalSales ?? 0;
    const totalSales = meterSales > EPS ? meterSales : reconSales;
    const lessCredit = recon?.credit ?? 0;
    const phonePe = recon?.phonePe ?? 0;
    const iciciBank = recon?.icici ?? 0;
    const fleetCard = recon?.fleet ?? 0;
    const shortAmount = recon?.short ?? 0;
    const shiftCash =
      recon?.totalCash ??
      totalCashFromMeterAndChannels(totalSales, phonePe, iciciBank, fleetCard, lessCredit, shortAmount);
    const creditCashReceived = dayLedger
      .filter(isCreditCashReceived)
      .reduce((s, e) => s + e.amount, 0);
    const cashReceivedLedger = dayLedger
      .filter(
        (e) =>
          e.type === 'income' &&
          effectiveLedgerChannel(e) === 'cash' &&
          !openingIncomeMatch(e) &&
          !isCreditCashReceived(e),
      )
      .reduce((s, e) => s + e.amount, 0);

    let expenses = 0;
    let salary = 0;
    let advanceSalary = 0;
    let locker = 0;
    let oddBalance = 0;
    const partyMap = new Map<string, PartyPayout>();

    for (const e of dayLedger) {
      const bucket = allocateExpenseBucket(e, partyKeys);
      if (!bucket) continue;
      if (bucket.kind === 'party') {
        const prev = partyMap.get(bucket.key);
        if (prev) {
          prev.amount += e.amount;
        } else {
          partyMap.set(bucket.key, { name: bucket.displayName, amount: e.amount });
        }
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

    const cashAdjustColumn = creditCashReceived;
    const grossIn = openingBalance + shiftCash + cashReceivedLedger + cashAdjustColumn;
    const categoryPaid = expenses + salary + advanceSalary;
    const balanceCash = grossIn - categoryPaid;
    const totalCash2 = balanceCash;

    const afterLockerOdd = balanceCash - locker - oddBalance;
    const partyPayouts = [...partyMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const partySum = partyPayouts.reduce((s, p) => s + p.amount, 0);
    const cashInHand = afterLockerOdd;
    const closingBalance = afterLockerOdd - partySum;

    out.push({
      dateIso: iso,
      dateLabel: format(day, 'dd-MMM'),
      openingBalance,
      totalSales,
      lessCredit,
      phonePe,
      iciciBank,
      fleetCard,
      shortAmount,
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
      partyPayouts,
      closingBalance,
    });

    carryOpening = closingBalance;
  }

  return out;
}

export function fmtSheet(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
