# PumpStock

Web app for petrol pump operations: shifts and meter readings, end-of-shift reconciliation, credit customers, cash/expense ledger, and manager reports. Built with **React**, **TypeScript**, **Vite**, **MUI**, and **Firebase** (Auth + Firestore), with an **offline local demo** mode for development.

## Quick start (local)

```powershell
cd C:\Projects\pumpStock
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173/**).

### Local demo (no Firebase)

If you have **no** `VITE_FIREBASE_*` variables set, **`npm run dev`** already runs in **local demo** mode: data is stored in this browser (`localStorage` / `sessionStorage`).

Optional: copy `.env.example` to `.env` and set:

```env
VITE_LOCAL_DEMO=true
```

Leave all `VITE_FIREBASE_*` lines empty for demo.

**Demo sign-in** (any password):

| Email                 | Role     |
|-----------------------|----------|
| `manager@demo.local`  | Manager  |
| `operator@demo.local` | Operator |

### Production-style (Firebase)

1. Create a Firebase project and enable **Authentication** (Email/Password) and **Firestore**.
2. Copy `.env.example` to `.env` and fill every `VITE_FIREBASE_*` value from **Firebase Console ΓåÆ Project settings ΓåÆ Your apps**.
3. Set `VITE_LOCAL_DEMO=` empty or `false` (do **not** use `true` if you want real Firebase).
4. Run `npm run firebase:sync-project` to align `.firebaserc` with `VITE_FIREBASE_PROJECT_ID`.
5. Deploy rules and indexes when ready:

   ```powershell
   npm run firebase:deploy:firestore
   npm run firebase:deploy:hosting
   ```

   Hosting expects `dist` from `npm run build`.

### Deploy on Vercel

This app is the **Vite** project at the **repository root**. Do not set the Vercel Root Directory to `frontend/` (that folder is a separate Next.js app).

1. Import [NIlanchal-Sahu/Filling-Station](https://github.com/NIlanchal-Sahu/Filling-Station) in [Vercel](https://vercel.com/new).
2. Leave **Root Directory** empty. Framework should be **Vite** (`vercel.json` sets this).
3. Add environment variables (required at **build** time, not only runtime):

   | Name | Notes |
   |------|--------|
   | `VITE_FIREBASE_API_KEY` | Firebase web app config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web app config |
   | `VITE_FIREBASE_PROJECT_ID` | Firebase web app config |
   | `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web app config |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web app config |
   | `VITE_FIREBASE_APP_ID` | Firebase web app config |
   | `VITE_LOCAL_DEMO` | Leave empty/`false` for production. Set `true` only for an offline demo (browser storage). |

4. Deploy. After the first URL exists, add `your-project.vercel.app` (and any custom domain) to **Firebase Console → Authentication → Settings → Authorized domains**.

`vercel.json` rewrites unknown paths to `index.html` so React Router deep links work.

### Bootstrap data (recommended)

After Auth is enabled (**Email/Password**) and you have a **service account** JSON (Console ΓåÆ Project settings ΓåÆ Service accounts ΓåÆ Generate new private key):

1. Put Firebase config in `.env` (all `VITE_FIREBASE_*` values).
2. Set an environment variable to the key file path, then run the seed script:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your-service-account.json"
   npm run firebase:bootstrap -- --firestore-only
   ```

   That writes **fuel types** (PETROL / DIESEL / XP), **12 nozzles** (same layout as the local demo), and a **sample credit customer** ΓÇö safe to run more than once (`merge`).

3. To also create **Firebase Auth** users and matching **`users/{uid}`** profiles, add to `.env` (never commit real passwords):

   - `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` / optional `SEED_MANAGER_NAME`
   - `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` / optional `SEED_OPERATOR_NAME`

   Then run (same `GOOGLE_APPLICATION_CREDENTIALS` as above):

   ```powershell
   npm run firebase:bootstrap
   ```

   Sign in to the app with those emails and passwords. If you skip seeding, create Auth users manually and add Firestore `users/{uid}` docs with `role` `manager` or `operator` (uid must match Auth).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build ΓåÆ `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run firebase:sync-project` | Write `.firebaserc` from env |
| `npm run firebase:bootstrap` | Seed Firestore (+ optional Auth users via `SEED_*` in `.env`) |
| `npm run firebase:deploy` | Deploy Firestore + Hosting |

## Project layout (high level)

- `src/pages/manager/` ΓÇö dashboard, **team**, credit, ledger, fuel prices, reports, reconciliation review
- `src/pages/operator/` ΓÇö operator home
- `src/pages/shifts/` ΓÇö start shift, end meters, reconciliation form
- `src/localDemo/demoBackend.ts` ΓÇö in-browser persistence when not using Firebase

## License

Private / use per your organization.
