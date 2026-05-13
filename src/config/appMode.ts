const FIREBASE_ENV_NAMES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function firebaseEnvLooksEmpty(): boolean {
  const env = import.meta.env as Record<string, string | undefined>;
  return FIREBASE_ENV_NAMES.every((k) => !(env[k] ?? '').trim());
}

/** Explicit: set `VITE_LOCAL_DEMO=true` in `.env` (recommended for clarity). */
export const EXPLICIT_LOCAL_DEMO =
  typeof import.meta.env.VITE_LOCAL_DEMO === 'string' &&
  import.meta.env.VITE_LOCAL_DEMO.toLowerCase() === 'true';

/**
 * Offline demo — no Firebase Auth/Firestore; data in localStorage (`demoBackend`).
 * Enabled when `VITE_LOCAL_DEMO=true`, **or** in dev when every Firebase env var is empty (no `.env` required).
 */
export const LOCAL_DEMO =
  EXPLICIT_LOCAL_DEMO || (import.meta.env.DEV === true && firebaseEnvLooksEmpty());
