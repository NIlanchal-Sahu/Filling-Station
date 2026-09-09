# Roles & permissions

PumpStock uses four roles stored in Firestore `users/{uid}.role` (must match Firebase Auth uid).

## Role summary

| Role | Code | Home route | Purpose |
|------|------|------------|---------|
| Admin | `admin` | `/admin` | Team, system settings, environment checklist |
| Owner | `owner` | `/owner` | Business KPIs, reports, read-only ops views, backdated corrections |
| Manager | `manager` | `/manager` | Day-to-day pump operations (write) |
| Worker | `operator` | `/operator` | Shifts, meters, reconciliation (today only) |

## Demo accounts (local demo mode)

| Email | Role |
|-------|------|
| `admin@demo.local` | Admin |
| `owner@demo.local` | Owner |
| `manager@demo.local` | Manager |
| `operator@demo.local` | Worker |

Any password works in demo mode.

## Permission matrix

| Permission | Admin | Owner | Manager | Worker |
|------------|:-----:|:-----:|:-------:|:------:|
| View dashboard | yes | yes | yes | yes |
| View reports | yes | yes | yes | no |
| View operations | yes | yes | yes | own shift |
| Edit shifts | yes | no | yes | own |
| Edit credit / ledger / fuel | yes | no | yes | limited |
| Approve reconciliation | yes | yes | yes | no |
| Backdate entries | yes | yes | no | no |
| Manage team | yes | no | no | no |
| Manage settings | yes | no | no | no |

Implementation: [`src/utils/permissions.ts`](../src/utils/permissions.ts)

## Route map (high level)

- **Admin:** `/admin`, `/admin/team`, `/admin/settings`, `/manager/reports` (read)
- **Owner:** `/owner`, `/manager/reports`, `/manager/reconciliations`, `/manager/fuel-stock/*`, `/manager/fuel` (read-only UI)
- **Manager:** `/manager/*` except `/manager/team` (redirects to `/admin/team`)
- **Worker:** `/operator`, `/shifts/*`

## Firestore rules

- **Owner:** read operational collections; no writes on pump data
- **Admin:** write on ops data; exclusive write on `users`
- **Manager / worker:** unchanged from prior rules (worker limited to own shifts)

See [`firestore.rules`](../firestore.rules).
