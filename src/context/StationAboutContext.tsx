import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStationAbout } from '@/services/stationAboutService';
import { defaultStationAbout, type StationAboutProfile } from '@/utils/stationAboutDefaults';

type StationAboutContextValue = {
  profile: StationAboutProfile;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StationAboutContext = createContext<StationAboutContextValue | null>(null);

export function StationAboutProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [profile, setProfile] = useState<StationAboutProfile>(defaultStationAbout());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getStationAbout();
      setProfile(next);
    } catch {
      setProfile(defaultStationAbout());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStationAbout()
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(defaultStationAbout());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid]);

  useEffect(() => {
    const name = profile.displayName.trim() || defaultStationAbout().displayName;
    document.title = name;
  }, [profile.displayName]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      refresh,
    }),
    [profile, loading, refresh],
  );

  return <StationAboutContext.Provider value={value}>{children}</StationAboutContext.Provider>;
}

export function useStationAbout(): StationAboutContextValue {
  const ctx = useContext(StationAboutContext);
  if (!ctx) {
    return {
      profile: defaultStationAbout(),
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
