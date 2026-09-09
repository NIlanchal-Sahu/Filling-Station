# UI refactor notes

Phased refresh of PumpStock layout, dashboards, and role-based navigation.

## Phases

| Phase | Status | Scope |
|-------|--------|-------|
| 1 | Done | Landing, login, app shell (sidebar, top bar, mobile nav) |
| 2 | Done | Four roles, permissions matrix, route guards, Firestore rules |
| 3 | Done | Dashboard UI — KPIs, shared components, worker touch UX |
| 4 | Done | Operational pages — `PageHeader`, responsive tables, owner read-only |
| 6 | Planned | Optional `src/features/` folder restructure |

## Route map by role

| Role | Home | Primary routes |
|------|------|----------------|
| Admin | `/admin` | `/admin/team`, `/admin/settings`, `/manager/reports` |
| Owner | `/owner` | `/manager/reports`, `/manager/reconciliations`, `/manager/fuel-stock/*`, `/manager/fuel` (read-only) |
| Manager | `/manager` | `/manager/*`, `/shifts/*` |
| Worker | `/operator` | `/shifts/new`, `/shifts/:id/meters`, `/shifts/:id/reconcile` |

Full permission details: [ROLES.md](./ROLES.md).

## Shared UI components

| Component | Use |
|-----------|-----|
| `PageHeader` | Page title, subtitle, optional action slot (replaces gradient heroes) |
| `KpiStat` / `KpiStatSkeleton` | Dashboard metric tiles and loading placeholders |
| `DashboardSection` | Section overline title + subtitle + content |
| `QuickActionBar` | Row of outlined navigation buttons |
| `EmptyState` | Icon, message, and primary CTA when no data |
| `ReadOnlyBanner` | Owner view-only notice on operational pages |
| `ResponsiveTableContainer` | Horizontal scroll + optional sticky first column for wide tables |
| `FilterToolbar` | Date/filter controls that stack vertically on `xs`, row on `sm+` |

## Operational page convention (Phase 4)

1. **`PageHeader`** at top with title, subtitle, and primary actions (Save, Refresh, Back).
2. **Summary cards** (cash-in-hand, search, KPIs) in bordered `Paper` below the header — not inside a gradient hero.
3. **Wide tables** wrapped in `ResponsiveTableContainer`; use `stickyFirstColumn` for date/label columns on reports and cash sheet.
4. **Owner read-only**: `ReadOnlyBanner` + disable save/edit controls on Reports, Fuel prices, Fuel purchase, Fuel stock history, Daily dip, Reconciliations.

## Breakpoint testing

Verify at **320px**, **375px**, **900px**, and **1200px**:

- Manager: Reports tabs scroll; ledger/credit tables scroll horizontally without page overflow
- Owner: read-only fuel and reports pages — no edit leaks
- Worker: shift flow buttons ≥ 48px tall, full-width on mobile
- Public: login and landing — no horizontal overflow

## Verification

```powershell
npm run typecheck
npm run build
```

## Theme

- Primary blue: `#0d47a1`
- Success green: `#2e7d32`
- Background: `#f5f7fa`
