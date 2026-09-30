import {
  LEDGER_TXN_TYPE_ORDER,
  ledgerTxnTypeLabel,
  type LedgerPaymentChannel,
} from '@/types/entities';

/** Default ledger sheet categories (pump cash book). */
export const DEFAULT_LEDGER_CATEGORIES: readonly string[] = [
  'EXPENSES',
  'SALES',
  'TRANSFER',
  'RECEIVED',
  'LOCKER',
  'ODD BALANCE',
  'SALARY',
  'ADVANCE SALARY',
  'MAINTENANCE',
  'MISC',
  'LOAN',
  'OTHER',
] as const;

export type LedgerTxnTypeOption = {
  id: string;
  label: string;
};

export type LedgerListSettings = {
  categories: string[];
  txnTypes: LedgerTxnTypeOption[];
};

export function defaultLedgerTxnTypes(): LedgerTxnTypeOption[] {
  return LEDGER_TXN_TYPE_ORDER.map((id) => ({
    id,
    label: ledgerTxnTypeLabel(id as LedgerPaymentChannel, 'expense'),
  }));
}

export function defaultLedgerListSettings(): LedgerListSettings {
  return {
    categories: [...DEFAULT_LEDGER_CATEGORIES],
    txnTypes: defaultLedgerTxnTypes(),
  };
}

export function normalizeLedgerCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function slugFromTxnTypeLabel(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'custom_type';
}

export function mergeLedgerListSettings(partial: Partial<LedgerListSettings> | null | undefined): LedgerListSettings {
  const base = defaultLedgerListSettings();
  if (!partial) return base;
  const categories =
    Array.isArray(partial.categories) && partial.categories.length > 0
      ? [...new Set(partial.categories.map(normalizeLedgerCategory).filter(Boolean))]
      : base.categories;
  const txnTypes =
    Array.isArray(partial.txnTypes) && partial.txnTypes.length > 0
      ? partial.txnTypes
          .map((t) => ({
            id: (t.id ?? slugFromTxnTypeLabel(t.label ?? '')).trim().toLowerCase(),
            label: (t.label ?? t.id ?? '').trim().toUpperCase(),
          }))
          .filter((t) => t.id && t.label)
      : base.txnTypes;
  return { categories, txnTypes };
}
