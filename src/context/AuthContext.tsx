import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/services/usersService';
import type { User } from '@/types/entities';

const DEMO_SESSION_KEY = 'pumpstock-demo-session-uid';

function emailToDemoUid(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e === 'admin@demo.local') {
    return 'demo-admin';
  }
  if (e === 'owner@demo.local') {
    return 'demo-owner';
  }
  if (e === 'manager@demo.local') {
    return 'demo-manager';
  }
  if (e === 'operator@demo.local') {
    return 'demo-operator';
  }
  return null;
}

/** Minimal session shape for route guards (`uid` only). */
export type SessionUser = { uid: string };

function demoSessionUser(uid: string): SessionUser {
  return { uid };
}

type AuthState = {
  firebaseUser: SessionUser | null;
  profile: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [firebaseUser, setFirebaseUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    const u = await getUser(uid);
    setProfile(u);
  }, []);

  useEffect(() => {
    if (LOCAL_DEMO) {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        setError(null);
        const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (!stored) {
          setFirebaseUser(null);
          setProfile(null);
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        setFirebaseUser(demoSessionUser(stored));
        try {
          const u = await getUser(stored);
          if (cancelled) {
            return;
          }
          if (!u) {
            sessionStorage.removeItem(DEMO_SESSION_KEY);
            setFirebaseUser(null);
            setProfile(null);
          } else {
            setProfile(u);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : 'Failed to load profile');
            setProfile(null);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const supabase = getSupabase();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setError(null);
      if (!uid) {
        setFirebaseUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setFirebaseUser({ uid });
      // Avoid awaiting Supabase calls inside the auth callback (it can deadlock the client).
      window.setTimeout(() => {
        void loadProfile(uid)
          .catch((e: unknown) => {
            setError(e instanceof Error ? e.message : 'Failed to load profile');
            setProfile(null);
          })
          .finally(() => {
            setLoading(false);
          });
      }, 0);
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      if (LOCAL_DEMO) {
        const uid = emailToDemoUid(email);
        if (!uid) {
          throw new Error('Use admin@demo.local, owner@demo.local, manager@demo.local, or operator@demo.local (any password).');
        }
        const u = await getUser(uid);
        if (!u) {
          throw new Error('Demo user not found');
        }
        sessionStorage.setItem(DEMO_SESSION_KEY, uid);
        setFirebaseUser(demoSessionUser(uid));
        setProfile(u);
      } else {
        const supabase = getSupabase();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          throw new Error(signInError.message);
        }
      }
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message ?? e)
          : 'Sign-in failed';
      setError(msg);
      throw new Error(msg, { cause: e });
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (LOCAL_DEMO) {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      setFirebaseUser(null);
      setProfile(null);
      return;
    }
    const supabase = getSupabase();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(signOutError.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (firebaseUser) {
      await loadProfile(firebaseUser.uid);
    }
  }, [firebaseUser, loadProfile]);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      error,
      signIn,
      signOut,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, error, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook used across the tree; fast-refresh wants components-only files. */
// eslint-disable-next-line react-refresh/only-export-components -- useAuth is the public API for this module
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
