import { format } from 'date-fns';
import type { LedgerEntry } from '@/types/entities';

export function transferNameKey(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isTransferBookEntry(entry: LedgerEntry): boolean {
  const c = entry.category.trim().toUpperCase();
  if (c !== 'TRANSFER' && c !== 'RECEIVED' && c !== 'LOCKER') {
    return false;
  }
  const n = entry.paidToOrReceivedFrom.trim().toLowerCase();
  if (!n) {
    return false;
  }
  if (n.startsWith('due received:') || n.startsWith('loan from') || n.startsWith('loan repayment')) {
    return false;
  }
  return true;
}

/** Locker is a name; category LOCKER only when the typed name is locker. */
export function transferCategoryForName(name: string): 'LOCKER' | 'TRANSFER' {
  return transferNameKey(name) === 'LOCKER' ? 'LOCKER' : 'TRANSFER';
}

export type TransferNameSummary = {
  key: string;
  displayName: string;
  lastDateIso: string;
  paid: number;
  received: number;
  running: number;
};

export function summarizeTransferNames(rows: LedgerEntry[]): TransferNameSummary[] {
  const map = new Map<
    string,
    { displayName: string; lastMs: number; lastDateIso: string; paid: number; received: number }
  >();
  const sorted = [...rows.filter(isTransferBookEntry)].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  for (const e of sorted) {
    const raw = e.paidToOrReceivedFrom.trim();
    const key = transferNameKey(raw);
    const paid = e.type === 'expense' ? e.amount : 0;
    const received = e.type === 'income' ? e.amount : 0;
    const ms = e.date.toMillis();
    const lastDateIso = format(e.date.toDate(), 'yyyy-MM-dd');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { displayName: raw, lastMs: ms, lastDateIso, paid, received });
    } else {
      prev.paid += paid;
      prev.received += received;
      if (ms >= prev.lastMs) {
        prev.lastMs = ms;
        prev.lastDateIso = lastDateIso;
        prev.displayName = raw;
      }
    }
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      displayName: v.displayName,
      lastDateIso: v.lastDateIso,
      paid: v.paid,
      received: v.received,
      running: v.paid - v.received,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type TransferBookLine = LedgerEntry & { run: number };

export function transferBookLines(rows: LedgerEntry[], nameKey: string): TransferBookLine[] {
  const lines = rows
    .filter((e) => isTransferBookEntry(e) && transferNameKey(e.paidToOrReceivedFrom) === nameKey)
    .sort((a, b) => {
      const d = a.date.toMillis() - b.date.toMillis();
      if (d !== 0) return d;
      const ac = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const bc = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return ac - bc;
    });
  let run = 0;
  return lines.map((e) => {
    run += e.type === 'expense' ? e.amount : -e.amount;
    return { ...e, run };
  });
}

export function uniqueTransferNames(rows: LedgerEntry[]): string[] {
  const set = new Set<string>();
  for (const e of rows) {
    if (!isTransferBookEntry(e)) continue;
    const n = e.paidToOrReceivedFrom.trim();
    if (n) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
