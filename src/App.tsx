import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageFallback } from '@/components/layout/PageFallback';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const HomeRedirectPage = lazy(() =>
  import('@/pages/HomeRedirectPage').then((m) => ({ default: m.HomeRedirectPage })),
);
const OperatorDashboardPage = lazy(() =>
  import('@/pages/operator/OperatorDashboardPage').then((m) => ({ default: m.OperatorDashboardPage })),
);
const ManagerDashboardPage = lazy(() =>
  import('@/pages/manager/ManagerDashboardPage').then((m) => ({ default: m.ManagerDashboardPage })),
);
const ManagerLayoutWithNav = lazy(() =>
  import('@/pages/manager/ManagerLayoutExtras').then((m) => ({ default: m.ManagerLayoutWithNav })),
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
        <Route
          path="/login"
          element={
            <AppLayout showNav={false}>
              <LoginPage />
            </AppLayout>
          }
        />
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirectPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="shifts/new" element={<StartShiftPage />} />
            <Route path="shifts/:shiftId/meters" element={<EndMetersPage />} />
            <Route path="shifts/:shiftId/reconcile" element={<ReconciliationFormPage />} />
          </Route>
          <Route element={<ProtectedRoute requireRole="operator" />}>
            <Route path="operator" element={<OperatorDashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute requireRole={['manager', 'admin']} />}>
            <Route path="manager" element={<ManagerLayoutWithNav />}>
              <Route index element={<ManagerDashboardPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="credit" element={<CreditCustomersPage />} />
              <Route path="credit/:id" element={<CustomerDetailPage />} />
              <Route path="ledger" element={<LedgerPage />} />
              <Route path="daily-sheet" element={<DailyCashSheetPage />} />
              <Route path="fuel" element={<FuelPricesPage />} />
              <Route path="fuel-stock/daily" element={<DailyDipEntryPage />} />
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
