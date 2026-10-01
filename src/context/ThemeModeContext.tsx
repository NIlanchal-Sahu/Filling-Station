import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createAppTheme, THEME_COLOR } from '@/theme/theme';

export type ThemeModePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pumpstock-theme-mode';

type ThemeModeContextValue = {
  preference: ThemeModePreference;
  resolvedMode: 'light' | 'dark';
  setPreference: (next: ThemeModePreference) => void;
  toggleLightDark: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readStoredPreference(): ThemeModePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'system';
}

function systemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(preference: ThemeModePreference): 'light' | 'dark' {
  return preference === 'system' ? systemMode() : preference;
}

function applyDocumentTheme(mode: 'light' | 'dark') {
  document.documentElement.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLOR[mode]);
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeModePreference>(() => readStoredPreference());
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>(() => resolveMode(readStoredPreference()));

  useEffect(() => {
    const next = resolveMode(preference);
    setResolvedMode(next);
    applyDocumentTheme(next);
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = systemMode();
      setResolvedMode(next);
      applyDocumentTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemeModePreference) => {
    setPreferenceState(next);
  }, []);

  const toggleLightDark = useCallback(() => {
    setPreferenceState((prev) => {
      const current = resolveMode(prev);
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  const value = useMemo(
    () => ({ preference, resolvedMode, setPreference, toggleLightDark }),
    [preference, resolvedMode, setPreference, toggleLightDark],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
}
