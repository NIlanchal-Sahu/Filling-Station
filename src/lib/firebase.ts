import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { LOCAL_DEMO } from '@/config/appMode';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

/** Vite / `.env` names (what you set in the project root) */
const ENV_KEY_BY_FIREBASE: Record<keyof typeof firebaseConfig, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

function collectMissingConfig(): { missingEnvNames: string[] } {
  const missingEnvNames: string[] = [];
  (Object.keys(firebaseConfig) as (keyof typeof firebaseConfig)[]).forEach((k) => {
    if (!firebaseConfig[k]) {
      missingEnvNames.push(ENV_KEY_BY_FIREBASE[k]);
    }
  });
  return { missingEnvNames };
}

export function getFirebaseConfigStatus(): { ok: boolean; missing: string[] } {
  if (LOCAL_DEMO) {
    return { ok: true, missing: [] };
  }
  const { missingEnvNames } = collectMissingConfig();
  return { ok: missingEnvNames.length === 0, missing: missingEnvNames };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (LOCAL_DEMO) {
    throw new Error(
      'Firebase is disabled in demo mode. Add every VITE_FIREBASE_* env var and leave VITE_LOCAL_DEMO empty/false to use a real Firebase project.',
    );
  }
  if (!app) {
    const { ok, missing } = getFirebaseConfigStatus();
    if (!ok) {
      throw new Error('Firebase is not configured. Missing: ' + missing.join(', '));
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export { COLLECTIONS } from '@/constants/collections';
