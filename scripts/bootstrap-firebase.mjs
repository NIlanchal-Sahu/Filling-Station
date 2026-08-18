/**
 * One-time / repeat-safe bootstrap for a real Firebase project (bypasses Firestore rules via Admin SDK).
 *
 * Prerequisites:
 *   - `.env` with `VITE_FIREBASE_PROJECT_ID` (and other VITE_* keys for the app; this script only needs project id).
 *   - Download a service account key (Firebase Console → Project settings → Service accounts → Generate new private key).
 *   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the full path of that JSON file before running.
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccount.json
 *   npm run firebase:bootstrap
 *
 * Options:
 *   --firestore-only     Skip Auth user creation (only seed fuel types, nozzles, sample credit customer).
 *
 * Optional `.env` keys (for Auth + `users/{uid}` profiles):
 *   SEED_MANAGER_EMAIL / SEED_MANAGER_PASSWORD / SEED_MANAGER_NAME
 *   SEED_OPERATOR_EMAIL / SEED_OPERATOR_PASSWORD / SEED_OPERATOR_NAME
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** @param {string} envPath @returns {Record<string, string>} */
function loadEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) {
    return out;
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnvFile(path.join(root, '.env'));

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (!credPath) {
  console.error(
    'Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the path of your Firebase service account JSON file.',
  );
  process.exit(1);
}
if (!fs.existsSync(credPath)) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS file not found:', credPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const projectIdFromEnv = (env.VITE_FIREBASE_PROJECT_ID ?? '').trim();
const projectId = projectIdFromEnv || String(serviceAccount.project_id ?? '').trim();
if (!projectId) {
  console.error('Could not determine project id. Set VITE_FIREBASE_PROJECT_ID in .env or use a service account JSON with project_id.');
  process.exit(1);
}
if (projectIdFromEnv && serviceAccount.project_id && projectIdFromEnv !== serviceAccount.project_id) {
  console.warn(
    'Warning: VITE_FIREBASE_PROJECT_ID (',
    projectIdFromEnv,
    ') differs from service account project_id (',
    serviceAccount.project_id,
    '). Using VITE_FIREBASE_PROJECT_ID.',
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId,
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/** Same grid as local demo (`demoBackend.ts`). */
const fuelByMachineNozzle = [
  ['fuel-p', 'fuel-p', 'fuel-x', 'fuel-x'],
  ['fuel-d', 'fuel-d', 'fuel-p', 'fuel-p'],
  ['fuel-d', 'fuel-d', 'fuel-d', 'fuel-d'],
];

async function seedFuelTypesAndNozzles() {
  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();

  const fuels = [
    { id: 'fuel-p', name: 'PETROL', rate: 107.9 },
    { id: 'fuel-d', name: 'DIESEL', rate: 95.8 },
    { id: 'fuel-x', name: 'XP', rate: 112.5 },
  ];
  for (const f of fuels) {
    batch.set(
      db.collection('fuelTypes').doc(f.id),
      { name: f.name, currentRate: f.rate, lastUpdatedAt: now },
      { merge: true },
    );
  }

  for (let m = 1; m <= 3; m += 1) {
    for (let n = 1; n <= 4; n += 1) {
      const id = `nz-${m}-${n}`;
      const fuelTypeId = fuelByMachineNozzle[m - 1][n - 1];
      batch.set(
        db.collection('nozzles').doc(id),
        {
          machineNumber: String(m),
          nozzleNumber: String(n),
          fuelTypeId,
          isActive: true,
        },
        { merge: true },
      );
    }
  }

  await batch.commit();
  console.log('Wrote fuelTypes (fuel-p, fuel-d, fuel-x) and 12 nozzle documents.');
}

async function seedSampleCreditCustomer() {
  await db
    .collection('creditCustomers')
    .doc('cc-sample-1')
    .set(
      {
        name: 'Sample Credit Fleet',
        isActive: true,
        currentBalance: 0,
      },
      { merge: true },
    );
  console.log('Wrote sample credit customer cc-sample-1.');
}

/**
 * @param {string} email
 * @param {string} password
 * @param {{ name: string; role: 'manager' | 'operator'; phone?: string | null }} profile
 */
async function ensureAuthUserAndProfile(email, password, profile) {
  let uid;
  try {
    const existing = await admin.auth().getUserByEmail(email);
    uid = existing.uid;
    console.log('Auth user already exists:', email, '→', uid);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'auth/user-not-found') {
      const created = await admin.auth().createUser({
        email,
        password,
        displayName: profile.name,
      });
      uid = created.uid;
      console.log('Created Auth user:', email, '→', uid);
    } else {
      throw e;
    }
  }

  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        name: profile.name,
        role: profile.role,
        phone: profile.phone ?? null,
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.log('Upserted Firestore users/', uid, `(${profile.role})`);
  return uid;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const firestoreOnly = args.has('--firestore-only');

  console.log('Project:', projectId);
  await seedFuelTypesAndNozzles();
  await seedSampleCreditCustomer();

  if (firestoreOnly) {
    console.log('Done (--firestore-only).');
    return;
  }

  const me = (env.SEED_MANAGER_EMAIL ?? '').trim();
  const mp = (env.SEED_MANAGER_PASSWORD ?? '').trim();
  const oe = (env.SEED_OPERATOR_EMAIL ?? '').trim();
  const op = (env.SEED_OPERATOR_PASSWORD ?? '').trim();

  if (me && mp) {
    await ensureAuthUserAndProfile(me, mp, {
      name: (env.SEED_MANAGER_NAME ?? '').trim() || 'Manager',
      role: 'manager',
    });
  }
  if (oe && op) {
    await ensureAuthUserAndProfile(oe, op, {
      name: (env.SEED_OPERATOR_NAME ?? '').trim() || 'Operator',
      role: 'operator',
    });
  }

  if (!(me && mp) && !(oe && op)) {
    console.log(
      'No SEED_* auth credentials in .env — skipped Auth / users collection. Re-run after setting SEED_MANAGER_EMAIL + SEED_MANAGER_PASSWORD (and optional operator).',
    );
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
