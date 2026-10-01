import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import { listAllLedgerForBalance } from '@/services/ledgerService';
import {
  defaultLedgerListSettings,
  mergeLedgerListSettings,
  normalizeLedgerCategory,
  type LedgerListSettings,
} from '@/utils/ledgerListDefaults';
import {
  demoGetLedgerListSettings,
  demoSaveLedgerListSettings,
} from '@/localDemo/demoBackend';

const LEDGER_LISTS_DOC_ID = 'ledgerLists';

export type { LedgerListSettings };

export async function getLedgerListSettings(): Promise<LedgerListSettings> {
  if (LOCAL_DEMO) {
    return mergeLedgerListSettings(demoGetLedgerListSettings());
  }
  const { data, error } = await getSupabase()
    .from('station_settings')
    .select('data')
    .eq('id', LEDGER_LISTS_DOC_ID)
    .maybeSingle();
  throwIfError(error, 'Load ledger lists');
  if (!data?.data) {
    return defaultLedgerListSettings();
  }
  const stored = data.data as { categories?: string[]; txnTypes?: LedgerListSettings['txnTypes'] };
  return mergeLedgerListSettings({
    categories: stored.categories,
    txnTypes: stored.txnTypes,
  });
}

export async function saveLedgerListSettings(
  input: LedgerListSettings,
  updatedBy: string,
): Promise<void> {
  const merged = mergeLedgerListSettings(input);
  if (LOCAL_DEMO) {
    demoSaveLedgerListSettings(merged);
    return;
  }
  const { error } = await getSupabase().from('station_settings').upsert(
    {
      id: LEDGER_LISTS_DOC_ID,
      data: {
        categories: merged.categories,
        txnTypes: merged.txnTypes,
      },
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  throwIfError(error, 'Save ledger lists');
}

function normalizeCategoryKey(category: string): string {
  return normalizeLedgerCategory(category);
}

export async function countLedgerCategoryUsage(category: string): Promise<number> {
  const key = normalizeCategoryKey(category);
  const rows = await listAllLedgerForBalance();
  return rows.filter((e) => normalizeCategoryKey(e.category) === key).length;
}

export async function countLedgerTxnTypeUsage(txnTypeId: string): Promise<number> {
  const id = txnTypeId.trim().toLowerCase();
  const rows = await listAllLedgerForBalance();
  return rows.filter((e) => (e.paymentChannel ?? '').toLowerCase() === id).length;
}
