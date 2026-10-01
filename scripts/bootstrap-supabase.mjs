/**
 * Seed a fresh Supabase project: fuel types, nozzles, a sample credit customer,
 * and optional Auth users + profiles from SEED_* variables in `.env`.
 *
 * Prerequisites:
 *   - Run `supabase/schema.sql` in the Supabase SQL editor first.
 *   - `.env` with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *     (service role is server-only — never prefix it with VITE_).
 *
 * Usage:
 *   npm run supabase:bootstrap
 *
 * Options:
 *   --data-only    Skip Auth user creation (only seed fuel, nozzles, sample customer).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

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

const env = { ...loadEnvFile(path.join(root, '.env')), ...process.env };

const url = (env.VITE_SUPABASE_URL ?? '').trim();
const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (service role must not use a VITE_ name).');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Same grid as local demo (`demoBackend.ts`). */
const fuelByMachineNozzle = [
  ['fuel-p', 'fuel-p', 'fuel-x', 'fuel-x'],
  ['fuel-d', 'fuel-d', 'fuel-p', 'fuel-p'],
  ['fuel-d', 'fuel-d', 'fuel-d', 'fuel-d'],
];

async function seedFuelTypesAndNozzles() {
  const now = new Date().toISOString();
  const fuels = [
    { id: 'fuel-p', name: 'PETROL', current_rate: 107.9, last_updated_at: now },
    { id: 'fuel-d', name: 'DIESEL', current_rate: 95.8, last_updated_at: now },
    { id: 'fuel-x', name: 'XP', current_rate: 112.5, last_updated_at: now },
  ];
  const { error: fuelError } = await supabase.from('fuel_types').upsert(fuels, { onConflict: 'id' });
  if (fuelError) {
    throw new Error(`fuel_types: ${fuelError.message}`);
  }

  const nozzles = [];
  for (let m = 1; m <= 3; m += 1) {
    for (let n = 1; n <= 4; n += 1) {
      nozzles.push({
        id: `nz-${m}-${n}`,
        machine_number: String(m),
        nozzle_number: String(n),
        fuel_type_id: fuelByMachineNozzle[m - 1][n - 1],
        is_active: true,
      });
    }
  }
  const { error: nozzleError } = await supabase.from('nozzles').upsert(nozzles, { onConflict: 'id' });
  if (nozzleError) {
    throw new Error(`nozzles: ${nozzleError.message}`);
  }
  console.log('Wrote fuel_types (fuel-p, fuel-d, fuel-x) and 12 nozzles.');
}

async function seedSampleCreditCustomer() {
  const { error } = await supabase.from('credit_customers').upsert(
    {
      id: 'cc-sample-1',
      name: 'Sample Credit Fleet',
      is_active: true,
      current_balance: 0,
    },
    { onConflict: 'id' },
  );
  if (error) {
    throw new Error(`credit_customers: ${error.message}`);
  }
  console.log('Wrote sample credit customer cc-sample-1.');
}

/**
 * @param {string} email
 * @param {string} password
 * @param {{ name: string; role: 'admin' | 'owner' | 'manager' | 'operator' }} profile
 */
async function ensureAuthUserAndProfile(email, password, profile) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    throw new Error(`list users: ${listError.message}`);
  }
  const existing = listed.users.find((user) => (user.email ?? '').toLowerCase() === email.toLowerCase());
  let uid = existing?.id;
  if (uid) {
    console.log('Auth user already exists:', email, '→', uid);
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: profile.name },
    });
    if (createError || !created.user) {
      throw new Error(`create user ${email}: ${createError?.message ?? 'no user returned'}`);
    }
    uid = created.user.id;
    console.log('Created Auth user:', email, '→', uid);
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: uid,
      name: profile.name,
      role: profile.role,
      email,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    throw new Error(`profiles: ${profileError.message}`);
  }
  console.log('Upserted profiles/', uid, `(${profile.role})`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dataOnly = args.has('--data-only');

  await seedFuelTypesAndNozzles();
  await seedSampleCreditCustomer();

  if (dataOnly) {
    console.log('Done (--data-only).');
    return;
  }

  const seeds = [
    ['SEED_ADMIN', 'admin'],
    ['SEED_OWNER', 'owner'],
    ['SEED_MANAGER', 'manager'],
    ['SEED_OPERATOR', 'operator'],
  ];

  let created = 0;
  for (const [prefix, role] of seeds) {
    const email = (env[`${prefix}_EMAIL`] ?? '').trim();
    const password = (env[`${prefix}_PASSWORD`] ?? '').trim();
    if (!email || !password) {
      continue;
    }
    const fallback = role.charAt(0).toUpperCase() + role.slice(1);
    await ensureAuthUserAndProfile(email, password, {
      name: (env[`${prefix}_NAME`] ?? '').trim() || fallback,
      role,
    });
    created += 1;
  }

  if (created === 0) {
    console.log(
      'No SEED_* credentials in .env — skipped Auth users. Set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (and optional owner, manager, operator), then re-run.',
    );
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
