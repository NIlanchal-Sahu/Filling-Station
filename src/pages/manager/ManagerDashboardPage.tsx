import { useMemo, useState } from 'react';

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
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { PageHeader } from '@/components/ui/PageHeader';
import { FloatingActionPanel } from '@/components/ui/FloatingActionPanel';
import { DashboardKpiGrid } from '@/components/dashboard/DashboardKpiGrid';
import { DashboardInsightsPanel } from '@/components/dashboard/DashboardInsightsPanel';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { demoResetStores } from '@/localDemo/demoBackend';
import { CashBankCollectionSummary } from '@/pages/manager/CashBankCollectionSummary';
import { TankStockDipSummary } from '@/pages/manager/TankStockDipSummary';
import { TodaySalesByShiftSection } from '@/pages/manager/TodaySalesByShiftSection';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';

function parseLocalYmd(iso: string): Date {
  return new Date(iso + 'T00:00:00');
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

  const { loading: kpisLoading, data: kpiData } = useDashboardKpis(reportIso);

  return (
    <>
      <Stack
        spacing={3.5}
        sx={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          pb: 4,
          pr: { xs: 0, sm: 4.5 },
        }}
      >
        <PageHeader
          title="Manager dashboard"
          subtitle={`${reportLabel}${isSelectedToday ? ' · Today' : ''}`}
          action={
            isSelectedToday ? (
              <Chip label="Live" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
            ) : null
          }
        />

        <Paper
          elevation={0}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
              sx={{
                width: { xs: '100%', sm: 'auto' },
                minWidth: { xs: 0, sm: 200 },
                maxWidth: '100%',
                '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
              }}
            />
          </Stack>
        </Paper>

        <DashboardKpiGrid loading={kpisLoading} data={kpiData} showStartShift />

      <DashboardSection
        title="Visual insights"
        subtitle="Fuel sales mix and payment collections for the selected pump day."
        contentReady={!kpisLoading}
      >
        <DashboardInsightsPanel pumpDayIso={reportIso} />
      </DashboardSection>

      <DashboardSection
        id="shift-performance"
        title="Shift performance"
        subtitle="Compare Shift 1 vs Shift 2 meter sales for the selected day."
        contentReady={!kpisLoading}
      >
        <TodaySalesByShiftSection pumpDayIso={reportIso} reportLabel={reportLabel} />
      </DashboardSection>

      <DashboardSection
        title="Cash & bank collections"
        subtitle="Today's collections categorized by payment method."
        contentReady={!kpisLoading}
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CashBankCollectionSummary pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Sales by fuel"
        subtitle="Revenue and volume split across MS, HSD, and XP from reconciled shifts."
        contentReady={!kpisLoading}
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <SalesByFuelChart pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Tank & inventory"
        subtitle="Dip readings, stock levels, and daily reconciliation."
        contentReady={!kpisLoading}
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TankStockDipSummary pumpDayIso={reportIso} reportLabel={reportLabel} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Shift activity"
        subtitle="Live shift status, attendants, and reconciliation progress."
        contentReady={!kpisLoading}
      >
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
      <FloatingActionPanel actions={[...managerQuickActions]} label="Shortcuts" />
    </>
  );
}
