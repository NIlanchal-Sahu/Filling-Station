const SUPABASE_ENV_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

function supabaseEnvLooksEmpty(): boolean {
  const env = import.meta.env as Record<string, string | undefined>;
  return SUPABASE_ENV_NAMES.every((k) => !(env[k] ?? '').trim());
}

/** Explicit: set `VITE_LOCAL_DEMO=true` in `.env` (recommended for clarity). */
export const EXPLICIT_LOCAL_DEMO =
  typeof import.meta.env.VITE_LOCAL_DEMO === 'string' &&
  import.meta.env.VITE_LOCAL_DEMO.toLowerCase() === 'true';

/**
 * Offline demo — no Supabase Auth or database; data in localStorage (`demoBackend`).
 * Enabled when `VITE_LOCAL_DEMO=true`, or when both Supabase env vars are empty.
 * Partial Supabase config still fails closed so a misconfigured production build is obvious.
 */
export const LOCAL_DEMO = EXPLICIT_LOCAL_DEMO || supabaseEnvLooksEmpty();
