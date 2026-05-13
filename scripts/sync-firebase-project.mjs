/**
 * Writes `.firebaserc` so the Firebase CLI targets the same project as the Vite app (`VITE_FIREBASE_PROJECT_ID` in `.env`).
 * Run: npm run firebase:sync-project
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env — copy .env.example to .env and set VITE_FIREBASE_PROJECT_ID.');
  process.exit(1);
}

const text = fs.readFileSync(envPath, 'utf8');
const m = /^\s*VITE_FIREBASE_PROJECT_ID=(.+)\s*$/m.exec(text);
const raw = m?.[1]?.replace(/^['"]|['"]$/g, '').trim() ?? '';
if (!raw) {
  console.error('VITE_FIREBASE_PROJECT_ID is empty in .env');
  process.exit(1);
}

const out = path.join(root, '.firebaserc');
const json = { projects: { default: raw } };
fs.writeFileSync(out, JSON.stringify(json, null, 2) + '\n', 'utf8');
console.log('Wrote .firebaserc with default project:', raw);
