# PumpStock

Web app for petrol pump operations: shifts and meter readings, end-of-shift reconciliation, credit customers, cash/expense ledger, and manager reports. Built with **React**, **TypeScript**, **Vite**, **MUI**, and **Supabase** (Auth + Postgres), with an **offline local demo** mode for development.

## Quick start (local)

```powershell
cd C:\Projects\pumpStock
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173/**).

### Local demo (no Supabase)

If you have **no** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` set, the app already runs in **demo** mode: data is stored in this browser (`localStorage` / `sessionStorage`).

Optional: copy `.env.example` to `.env` and set:

```env
VITE_LOCAL_DEMO=true
```

Leave both Supabase lines empty for demo.

**Demo sign-in** (any password):

| Email                 | Role     |
|-----------------------|----------|
| `admin@demo.local`    | Admin    |
| `owner@demo.local`    | Owner    |
| `manager@demo.local`  | Manager  |
| `operator@demo.local` | Worker   |

See [`docs/ROLES.md`](docs/ROLES.md) for the full permission matrix.

### Production-style (Supabase)

1. Create a Supabase project (Mumbai / `ap-south-1` if it is offered). Enable **Email** auth and turn **Confirm email** off so staff can sign in immediately.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). That creates the tables, row level security, and the private `staff-photos` bucket.
3. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**. Put `SUPABASE_SERVICE_ROLE_KEY` in `.env` for the seed script only — never as a `VITE_` variable.
4. Set `VITE_LOCAL_DEMO=` empty or `false`.
5. Seed fuel, nozzles, and staff: `npm run supabase:bootstrap`.

### Deploy on Vercel

This app is the **Vite** project at the **repository root**. Do not set the Vercel Root Directory to `frontend/` (that folder is a separate Next.js app).

1. Import [NIlanchal-Sahu/Filling-Station](https://github.com/NIlanchal-Sahu/Filling-Station) in [Vercel](https://vercel.com/new).
2. Leave **Root Directory** empty. Framework should be **Vite** (`vercel.json` sets this).
3. Environment variables (Vite inlines them at **build** time):

   - **Demo (no Supabase):** leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset (or empty). The live site signs in with `admin@demo.local`, `owner@demo.local`, `manager@demo.local`, or `operator@demo.local` and stores data in the browser.
   - **Real Supabase:** add the keys below, then redeploy:

   | Name | Notes |
   |------|--------|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |
   | `VITE_LOCAL_DEMO` | Leave empty/`false` when using Supabase. |

   Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It is only for `npm run supabase:bootstrap` on your machine.

4. Deploy. Email/password sign-in does not need an authorized-domain list. Add the site URL under **Authentication → URL configuration** only if you later send password-reset emails.

`vercel.json` rewrites unknown paths to `index.html` so React Router deep links work.

### Bootstrap data (recommended)

After `supabase/schema.sql` has been run and `.env` has `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
npm run supabase:bootstrap -- --data-only
```

That writes **fuel types** (PETROL / DIESEL / XP), **12 nozzles** (same layout as the local demo), and a **sample credit customer**. Safe to run more than once.

To also create Auth users and matching `profiles` rows, add to `.env` (never commit real passwords):

- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / optional `SEED_ADMIN_NAME`
- `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / optional `SEED_OWNER_NAME`
- `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` / optional `SEED_MANAGER_NAME`
- `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` / optional `SEED_OPERATOR_NAME`

Then run:

```powershell
npm run supabase:bootstrap
```

Sign in with those emails and passwords. Blank `SEED_*` emails are skipped. To add someone later, create the user in **Authentication → Users**, copy the user id, and link it on the Team page.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run supabase:bootstrap` | Seed fuel, nozzles, sample customer, and optional Auth users |

## Project layout (high level)

- `src/pages/manager/` — dashboard, **team**, credit, ledger, fuel prices, reports, reconciliation review
- `src/pages/operator/` — operator home
- `src/pages/shifts/` — start shift, end meters, reconciliation form
- `src/localDemo/demoBackend.ts` — in-browser persistence when Supabase is not configured
- `supabase/schema.sql` — tables, indexes, row level security, staff photo bucket

## License

Private / use per your organization.
