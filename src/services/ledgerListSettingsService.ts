import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';
import { COLLECTIONS, getDb } from '@/lib/firebase';
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
  const ref = doc(getDb(), COLLECTIONS.stationSettings, LEDGER_LISTS_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return defaultLedgerListSettings();
  }
  const data = snap.data();
  return mergeLedgerListSettings({
    categories: data.categories as string[] | undefined,
    txnTypes: data.txnTypes as LedgerListSettings['txnTypes'] | undefined,
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
  const ref = doc(getDb(), COLLECTIONS.stationSettings, LEDGER_LISTS_DOC_ID);
  await setDoc(ref, {
    categories: merged.categories,
    txnTypes: merged.txnTypes,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
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
