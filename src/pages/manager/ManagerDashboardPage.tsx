import { useEffect, useMemo, useState } from 'react';

import {
  alpha,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuickActionBar } from '@/components/ui/QuickActionBar';
import { demoResetStores } from '@/localDemo/demoBackend';
import { getTodaySalesByFuelType, getTotalOutstandingCredit } from '@/services/aggregatesService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { CashBankCollectionSummary } from '@/pages/manager/CashBankCollectionSummary';
import { TankStockDipSummary } from '@/pages/manager/TankStockDipSummary';
import { TodaySalesByShiftSection } from '@/pages/manager/TodaySalesByShiftSection';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';

function parseLocalYmd(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const managerQuickActions = [
  { to: '/manager/fuel-stock/daily', label: 'Daily dip entry', icon: <EditOutlinedIcon fontSize="small" /> },
  { to: '/manager/credit', label: 'Credit', icon: <CreditCardOutlinedIcon fontSize="small" /> },
  { to: '/manager/reconciliations', label: 'Reconciliations', icon: <FactCheckOutlinedIcon fontSize="small" /> },
  { to: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon fontSize="small" /> },
  { to: '/manager/daily-sheet', label: 'Daily sheet', icon: <PaymentsOutlinedIcon fontSize="small" /> },
] as const;

export function ManagerDashboardPage() {
  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

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
          getShiftStatusForPumpDay(reportIso),
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
  }, [reportIso]);

  return (
    <Stack spacing={3.5} sx={{ pb: 4 }}>
      <PageHeader
        title="Manager dashboard"
        subtitle={`${reportLabel}${isSelectedToday ? ' · Today' : ''}`}
        action={
          isSelectedToday ? (
            <Chip label="Live" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          ) : null
        }
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
              <KpiStat label="Sales (today)" value={fmtInr(salesTotal)} icon={PaymentsOutlinedIcon} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Open shifts" value={openShifts} icon={FactCheckOutlinedIcon} color="success" />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Pending recon" value={pendingRecon} icon={FactCheckOutlinedIcon} color="warning" />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <KpiStat label="Low stock" value={lowStock} icon={WarningAmberOutlinedIcon} color="error" />
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

      <Paper
        elevation={0}
        sx={{
          p: 1.75,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
            <TextField
              type="date"
              label="Pump day"
              value={reportIso}
              onChange={(e) => setReportIso(e.target.value)}
              size="small"
              slotProps={{
                htmlInput: { max: maxSelectableIso },
                inputLabel: { shrink: true },
              }}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </Stack>
        </Stack>
      </Paper>

      <QuickActionBar actions={[...managerQuickActions]} />

      <DashboardSection title="Shift performance">
        <TodaySalesByShiftSection pumpDayIso={reportIso} reportLabel={reportLabel} />
      </DashboardSection>

      <DashboardSection title="Cash & bank collections">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CashBankCollectionSummary pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection title="Sales by fuel">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <SalesByFuelChart pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection title="Tank & inventory">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TankStockDipSummary pumpDayIso={reportIso} reportLabel={reportLabel} />
        </Paper>
      </DashboardSection>

      <DashboardSection title="Shift activity">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TodayShiftStatusSection pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      {LOCAL_DEMO ? (
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'warning.light',
            bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
          }}
        >
          <CardContent sx={{ pt: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <RestartAltOutlinedIcon color="warning" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                Local demo reset
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720, lineHeight: 1.7 }}>
              Clears shifts, readings, reconciliations, ledger, and credit in this browser, then restores starter setup.
            </Typography>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestartAltOutlinedIcon />}
              onClick={() => {
                if (!window.confirm('Reset all local demo data in this browser? This cannot be undone.')) return;
                demoResetStores();
                window.location.reload();
              }}
              sx={{ borderRadius: 2 }}
            >
              Reset to initial demo state
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
