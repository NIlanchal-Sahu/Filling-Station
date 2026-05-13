import { format } from 'date-fns';
import type { CreditSale } from '@/types/entities';

export function particularsForLedgerCreditSale(sale: CreditSale): string {
  return sale.fuelTypeId == null ? 'Credit sale (shift / amount only)' : 'Fuel sale on credit';
}

/** One payment row as already mapped for the UI. */
export type PartyLedgerPayment = {
  id: string;
  dateMs: number;
  dateLabel: string;
  amount: number;
  mode: string;
};

export type PartyCreditLedgerBfRow = {
  kind: 'broughtForward';
  balanceAfter: number;
};

export type PartyCreditLedgerSaleRow = {
  kind: 'sale';
  id: string;
  dateMs: number;
  dateLabel: string;
  sale: CreditSale;
  debitRupees: number;
  balanceAfter: number;
};

export type PartyCreditLedgerPayRow = {
  kind: 'payment';
  id: string;
  dateMs: number;
  dateLabel: string;
  mode: string;
  creditRupees: number;
  balanceAfter: number;
};

export type PartyCreditLedgerDisplayRow =
  | PartyCreditLedgerBfRow
  | PartyCreditLedgerSaleRow
  | PartyCreditLedgerPayRow;

function roundMoney2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function formatDdMmYyyyFromDate(d: Date): string {
  return format(d, 'dd-MM-yyyy');
}

type InternalEv =
  | { kind: 'sale'; sortId: string; dateMs: number; sale: CreditSale }
  | { kind: 'payment'; sortId: string; dateMs: number; pay: PartyLedgerPayment };

/**
 * Chronological party ledger (oldest first): credit purchases add to balance owed,
 * payments reduce it. Includes running balance after each line.
 *
 * Opening balance before the earliest stored movement is inferred from
 * `currentBalanceOwed` so that ledger closes to the recorded balance when data is consistent.
 */
export function buildPartyCreditLedger(params: {
  currentBalanceOwed: number;
  sales: CreditSale[];
  payments: PartyLedgerPayment[];
}): PartyCreditLedgerDisplayRow[] {
  const { currentBalanceOwed, sales, payments } = params;

  const internal: InternalEv[] = [
    ...sales.map((sale) => ({
      kind: 'sale' as const,
      sortId: sale.id,
      dateMs: sale.date.toMillis(),
      sale,
    })),
    ...payments.map((pay) => ({
      kind: 'payment' as const,
      sortId: pay.id,
      dateMs: pay.dateMs,
      pay,
    })),
  ];
  internal.sort((a, b) => {
    const d = a.dateMs - b.dateMs;
    if (d !== 0) return d;
    return a.sortId.localeCompare(b.sortId);
  });

  let sumSales = 0;
  let sumPayments = 0;
  for (const s of sales) {
    sumSales += Number.isFinite(s.amount) ? s.amount : 0;
  }
  for (const p of payments) {
    sumPayments += Number.isFinite(p.amount) ? p.amount : 0;
  }
  sumSales = roundMoney2(sumSales);
  sumPayments = roundMoney2(sumPayments);

  const opening = roundMoney2(currentBalanceOwed - sumSales + sumPayments);

  const rows: PartyCreditLedgerDisplayRow[] = [];

  if (internal.length > 0 && Math.abs(opening) >= 0.005) {
    rows.push({
      kind: 'broughtForward',
      balanceAfter: opening,
    });
  }

  let balance = opening;
  for (const ev of internal) {
    if (ev.kind === 'sale') {
      const debit = Number.isFinite(ev.sale.amount) ? ev.sale.amount : 0;
      balance = roundMoney2(balance + debit);
      rows.push({
        kind: 'sale',
        id: ev.sale.id,
        dateMs: ev.dateMs,
        dateLabel: formatDdMmYyyyFromDate(ev.sale.date.toDate()),
        sale: ev.sale,
        debitRupees: roundMoney2(debit),
        balanceAfter: balance,
      });
    } else {
      const credit = Number.isFinite(ev.pay.amount) ? ev.pay.amount : 0;
      balance = roundMoney2(balance - credit);
      rows.push({
        kind: 'payment',
        id: ev.pay.id,
        dateMs: ev.dateMs,
        dateLabel: ev.pay.dateLabel,
        mode: ev.pay.mode,
        creditRupees: roundMoney2(credit),
        balanceAfter: balance,
      });
    }
  }

  return rows;
}
