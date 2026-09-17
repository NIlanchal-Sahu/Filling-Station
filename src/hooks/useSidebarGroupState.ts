import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pumpstock-sidebar-groups';

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStored(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function useSidebarGroupState(groupLabel: string, defaultOpen: boolean) {
  const [open, setOpenState] = useState(() => {
    const stored = readStored()[groupLabel];
    return stored ?? defaultOpen;
  });

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      const all = readStored();
      all[groupLabel] = next;
      writeStored(all);
    },
    [groupLabel],
  );

  useEffect(() => {
    const stored = readStored()[groupLabel];
    if (stored !== undefined) {
      setOpenState(stored);
    }
  }, [groupLabel]);

  return [open, setOpen] as const;
}
