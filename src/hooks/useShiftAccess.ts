import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getShift } from '@/services/shiftsService';
import type { Shift } from '@/types/entities';

export function useShiftAccess(shiftId: string | undefined) {
  const { profile } = useAuth();
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId || !profile) {
      return;
    }
    let ok = true;
    (async () => {
      setError(null);
      try {
        const s = await getShift(shiftId);
        if (!ok) {
          return;
        }
        if (!s) {
          setShift(null);
          setAllowed(false);
          return;
        }
        setShift(s);
        const a = profile.role === 'manager' || s.operatorId === profile.id;
        setAllowed(a);
        if (!a) {
          setError('You do not have access to this shift.');
        }
      } catch (e) {
        if (ok) {
          setError(e instanceof Error ? e.message : 'Failed to load shift');
          setShift(null);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [shiftId, profile]);

  return { shift, allowed, error, profile };
}
