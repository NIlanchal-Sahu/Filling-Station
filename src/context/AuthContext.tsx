import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { LOCAL_DEMO } from '@/config/appMode';
import { getAuthInstance } from '@/lib/firebase';
import { getUser } from '@/services/usersService';
import type { User } from '@/types/entities';

const DEMO_SESSION_KEY = 'pumpstock-demo-session-uid';

function emailToDemoUid(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e === 'admin@demo.local') {
    return 'demo-admin';
  }
  if (e === 'manager@demo.local') {
    return 'demo-manager';
  }
  if (e === 'operator@demo.local') {
    return 'demo-operator';
  }
  return null;
}

/** Minimal shape for ProtectedRoute / HomeRedirect (`uid` only). */
function demoFirebaseUser(uid: string): FirebaseUser {
  return { uid } as FirebaseUser;
}

type AuthState = {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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
        setFirebaseUser(demoFirebaseUser(stored));
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
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setError(null);
      setFirebaseUser(u);
      if (u) {
        try {
          await loadProfile(u.uid);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      unsub();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      if (LOCAL_DEMO) {
        const uid = emailToDemoUid(email);
        if (!uid) {
          throw new Error('Use manager@demo.local or operator@demo.local (any password).');
        }
        const u = await getUser(uid);
        if (!u) {
          throw new Error('Demo user not found');
        }
        sessionStorage.setItem(DEMO_SESSION_KEY, uid);
        setFirebaseUser(demoFirebaseUser(uid));
        setProfile(u);
      } else {
        const auth = getAuthInstance();
        await signInWithEmailAndPassword(auth, email, password);
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
    const auth = getAuthInstance();
    await firebaseSignOut(auth);
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
