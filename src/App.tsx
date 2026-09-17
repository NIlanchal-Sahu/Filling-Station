import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageFallback } from '@/components/layout/PageFallback';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const HomeRedirectPage = lazy(() =>
  import('@/pages/HomeRedirectPage').then((m) => ({ default: m.HomeRedirectPage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
);
const OwnerDashboardPage = lazy(() =>
  import('@/pages/owner/OwnerDashboardPage').then((m) => ({ default: m.OwnerDashboardPage })),
);
const OperatorDashboardPage = lazy(() =>
  import('@/pages/operator/OperatorDashboardPage').then((m) => ({ default: m.OperatorDashboardPage })),
);
const ManagerDashboardPage = lazy(() =>
  import('@/pages/manager/ManagerDashboardPage').then((m) => ({ default: m.ManagerDashboardPage })),
);
const CreditCustomersPage = lazy(() =>
  import('@/pages/manager/CreditCustomersPage').then((m) => ({ default: m.CreditCustomersPage })),
);
const CustomerDetailPage = lazy(() =>
  import('@/pages/manager/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
);
const LedgerPage = lazy(() => import('@/pages/manager/LedgerPage').then((m) => ({ default: m.LedgerPage })));
const DailyCashSheetPage = lazy(() =>
  import('@/pages/manager/DailyCashSheetPage').then((m) => ({ default: m.DailyCashSheetPage })),
);
const ReportsPage = lazy(() => import('@/pages/manager/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const FuelPricesPage = lazy(() =>
  import('@/pages/manager/FuelPricesPage').then((m) => ({ default: m.FuelPricesPage })),
);
const TeamPage = lazy(() => import('@/pages/manager/TeamPage').then((m) => ({ default: m.TeamPage })));
const DailyDipEntryPage = lazy(() =>
  import('@/pages/manager/DailyDipEntryPage').then((m) => ({ default: m.DailyDipEntryPage })),
);
const FuelStockHistoryPage = lazy(() =>
  import('@/pages/manager/FuelStockHistoryPage').then((m) => ({ default: m.FuelStockHistoryPage })),
);
const ReconciliationReviewPage = lazy(() =>
  import('@/pages/manager/ReconciliationReviewPage').then((m) => ({ default: m.ReconciliationReviewPage })),
);
const LubricantPage = lazy(() =>
  import('@/pages/manager/LubricantPage').then((m) => ({ default: m.LubricantPage })),
);
const FuelPurchasePage = lazy(() =>
  import('@/pages/manager/FuelPurchasePage').then((m) => ({ default: m.FuelPurchasePage })),
);
const StartShiftPage = lazy(() =>
  import('@/pages/shifts/StartShiftPage').then((m) => ({ default: m.StartShiftPage })),
);
const EndMetersPage = lazy(() => import('@/pages/shifts/EndMetersPage').then((m) => ({ default: m.EndMetersPage })));
const ReconciliationFormPage = lazy(() =>
  import('@/pages/shifts/ReconciliationFormPage').then((m) => ({ default: m.ReconciliationFormPage })),
);

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppLayout variant="public" />}>
          <Route path="/" element={<HomeRedirectPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<AppLayout variant="app" />}>
          <Route element={<ProtectedRoute requireRole={['operator', 'manager', 'admin']} />}>
            <Route path="shifts/new" element={<StartShiftPage />} />
            <Route path="shifts/:shiftId/meters" element={<EndMetersPage />} />
            <Route path="shifts/:shiftId/reconcile" element={<ReconciliationFormPage />} />
          </Route>

          <Route element={<ProtectedRoute requireRole="operator" />}>
            <Route path="operator" element={<OperatorDashboardPage />} />
            <Route path="operator/prices" element={<FuelPricesPage />} />
          </Route>

          <Route element={<ProtectedRoute requireRole="owner" />}>
            <Route path="owner" element={<OwnerDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute requireRole="admin" />}>
            <Route path="admin" element={<Outlet />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requireRole={['manager', 'admin', 'owner']} />}>
            <Route path="manager" element={<Outlet />}>
              <Route index element={<ManagerDashboardPage />} />
              <Route path="team" element={<Navigate to="/admin/team" replace />} />
              <Route path="credit" element={<CreditCustomersPage />} />
              <Route path="credit/:id" element={<CustomerDetailPage />} />
              <Route path="ledger" element={<LedgerPage />} />
              <Route path="daily-sheet" element={<DailyCashSheetPage />} />
              <Route path="fuel" element={<FuelPricesPage />} />
              <Route path="fuel-stock/daily" element={<DailyDipEntryPage />} />
              <Route path="fuel-stock/purchase" element={<FuelPurchasePage />} />
              <Route path="fuel-stock/:fuelTypeId" element={<FuelStockHistoryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reconciliations" element={<ReconciliationReviewPage />} />
              <Route path="lubricants" element={<LubricantPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
