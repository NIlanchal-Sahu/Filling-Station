import { useEffect, useMemo, useState } from 'react';
import { Paper, Stack } from '@mui/material';
import Grid from '@mui/material/Grid2';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { format } from 'date-fns';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuickActionBar } from '@/components/ui/QuickActionBar';
import { CashBankCollectionSummary } from '@/pages/manager/CashBankCollectionSummary';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import { getTodaySalesByFuelType, getTotalOutstandingCredit } from '@/services/aggregatesService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const ownerQuickActions = [
  { to: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon fontSize="small" /> },
  { to: '/manager/reconciliations', label: 'Reconciliations', icon: <FactCheckOutlinedIcon fontSize="small" /> },
  { to: '/manager/fuel-stock/daily', label: 'Fuel & stock', icon: <Inventory2OutlinedIcon fontSize="small" /> },
] as const;

export function OwnerDashboardPage() {
  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [salesTotal, setSalesTotal] = useState(0);
  const [openShifts, setOpenShifts] = useState(0);
  const [pendingRecon, setPendingRecon] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);

  useEffect(() => {
    let ok = true;
    setKpisLoading(true);
    void (async () => {
      try {
        const [sales, shiftStatus, stock, credit] = await Promise.all([
          getTodaySalesByFuelType(),
          getShiftStatusForPumpDay(todayIso),
          getFuelStockOverview(),
          getTotalOutstandingCredit(),
        ]);
        if (!ok) {
          return;
        }
        setSalesTotal(sales.reduce((sum, row) => sum + row.amount, 0));
        setOpenShifts(shiftStatus.totals.active);
        setPendingRecon(shiftStatus.totals.pendingReconciliation);
        setLowStock(stock.items.filter((i) => i.health === 'low' || i.health === 'critical').length);
        setCreditOutstanding(credit);
      } catch {
        if (ok) {
          setSalesTotal(0);
          setOpenShifts(0);
          setPendingRecon(0);
          setLowStock(0);
          setCreditOutstanding(0);
        }
      } finally {
        if (ok) {
          setKpisLoading(false);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [todayIso]);

  return (
    <Stack spacing={3.5} sx={{ pb: 4 }}>
      <PageHeader
        title="Owner dashboard"
        subtitle="Business overview — sales, shifts, stock, and collections at a glance."
      />

      <Grid container spacing={2}>
        {kpisLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 6, sm: 2.4 }}>
                <KpiStatSkeleton />
              </Grid>
            ))}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <KpiStatSkeleton />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Today's sales" value={fmtInr(salesTotal)} icon={PaymentsOutlinedIcon} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Open shifts" value={openShifts} icon={FactCheckOutlinedIcon} color="success" />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Pending recon" value={pendingRecon} icon={FactCheckOutlinedIcon} color="warning" />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Low stock tanks" value={lowStock} icon={WarningAmberOutlinedIcon} color="error" />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <KpiStat
                label="Credit outstanding"
                value={fmtInr(creditOutstanding)}
                icon={CreditCardOutlinedIcon}
                color="secondary"
              />
            </Grid>
          </>
        )}
      </Grid>

      <QuickActionBar actions={[...ownerQuickActions]} label="QUICK LINKS" />

      <DashboardSection
        title="Sales by fuel"
        subtitle="Revenue and volume split across MS, HSD, and XP from reconciled shifts."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <SalesByFuelChart pumpDayIso={todayIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Cash & bank collections"
        subtitle="Today's collections categorized by payment method."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CashBankCollectionSummary pumpDayIso={todayIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Shift activity"
        subtitle="Live shift status, attendants, and reconciliation progress."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TodayShiftStatusSection pumpDayIso={todayIso} />
        </Paper>
      </DashboardSection>
    </Stack>
  );
}
