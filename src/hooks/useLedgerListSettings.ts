import { useCallback, useEffect, useState } from 'react';
import {
  getLedgerListSettings,
  type LedgerListSettings,
} from '@/services/ledgerListSettingsService';
import { defaultLedgerListSettings } from '@/utils/ledgerListDefaults';

export function useLedgerListSettings() {
  const [settings, setSettings] = useState<LedgerListSettings>(() => defaultLedgerListSettings());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await getLedgerListSettings();
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ledger lists');
      setSettings(defaultLedgerListSettings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    settings,
    categories: settings.categories,
    txnTypes: settings.txnTypes,
    loading,
    error,
    reload,
    setSettings,
  };
}
